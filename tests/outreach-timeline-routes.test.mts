// U16: the timeline, calendar and to-do routes, through the real handlers and PGlite.
// The session is replaced the way a route test must: the loader below swaps lib/auth.ts for a stand-in that reads the
// signed-in user from the `x-test-user` header, and lets lib/db.ts hand out the PGlite handle. Nothing else is replaced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { addContact } from "../lib/outreach/contacts-db";
import { pgliteDb, type Db } from "../lib/db";
import { calendarItems, calendarRow, meetingEvent, outreachGoogleCalendarUrl, outreachIcs } from "../lib/outreach/calendar";

const href = (p: string) => new URL(p, import.meta.url).href;
const root = href("../");
const authStub = `export const accountsConfigured = () => true;
export async function sessionUser(req) { const id = req.headers.get("x-test-user"); return id ? { id, email: id + "@test.local", dodoCustomerId: null } : null; }`;
const dbStub = `export * from ${JSON.stringify(href("../lib/db.ts"))};
export const getDb = () => globalThis.__lynkrTestDb;
export const cloudReady = async () => true;`;
register("data:text/javascript," + encodeURIComponent(`
const root = ${JSON.stringify(root)};
const authUrl = ${JSON.stringify(href("../lib/auth.ts"))}, dbUrl = ${JSON.stringify(href("../lib/db.ts"))};
const stub = (src) => "data:text/javascript," + encodeURIComponent(src);
export async function resolve(specifier, context, next) {
  let r;
  if (specifier.startsWith("@/")) { const h = root + specifier.slice(2); try { r = await next(h, context); } catch { r = await next(h + ".ts", context); } }
  else r = await next(specifier, context);
  if (context.parentURL && context.parentURL.startsWith("data:")) return r;
  if (r.url === authUrl) return { ...r, url: stub(${JSON.stringify(authStub)}), shortCircuit: true };
  if (r.url === dbUrl) return { ...r, url: stub(${JSON.stringify(dbStub)}), shortCircuit: true };
  return r;
}`));

const sql = (name: string) => readFileSync(new URL(`../scripts/migrations/${name}`, import.meta.url), "utf8");
async function fresh() {
  const pg = new PGlite();
  await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
  for (const f of ["001_vertical1.sql", "002_outreach.sql", "005_outreach_timeline.sql"]) await pg.exec(sql(f));
  const db = pgliteDb(pg) as Db;
  (globalThis as { __lynkrTestDb?: Db }).__lynkrTestDb = db;
  return { pg, db };
}
const people = { bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1" } as const;
const DAY = 86_400_000;
const ago = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const ahead = (d: number) => new Date(Date.now() + d * DAY).toISOString();
const dayOf = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 10);
let n = 0;
const op = () => `op-${Date.now()}-${++n}`;

async function routes() {
  return {
    timeline: await import("../app/api/outreach/timeline/route"),
    calendar: await import("../app/api/outreach/calendar/route"),
    todo: await import("../app/api/outreach/todo/route"),
  };
}
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(handler: (r: Request) => Promise<Response>, method: string, path: string, user: string | null, body?: unknown): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-forwarded-for": "10.1.1.1" };
  if (user) headers["x-test-user"] = user;
  const res = await handler(new Request(`http://localhost${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
}
async function withPaywall<T>(run: () => Promise<T>): Promise<T> {
  const keys = ["LYNKR_PAYWALL", "DODO_PAYMENTS_API_KEY"] as const;
  const before = keys.map((k) => process.env[k]);
  process.env.LYNKR_PAYWALL = "1"; delete process.env.DODO_PAYMENTS_API_KEY;
  try { return await run(); } finally { keys.forEach((k, i) => { if (before[i] === undefined) delete process.env[k]; else process.env[k] = before[i]!; }); }
}

test("AE11: an unanswered meeting and an invite 22 days old fill the to-do, meeting first; answering both empties it", async () => {
  const { pg, db } = await fresh();
  const { timeline, todo } = await routes();
  const priya = await addContact(db, "a", { ...people, name: "Priya" });
  const ravi = await addContact(db, "a", { ...people, name: "Ravi" });
  // Booked a week ago for a meeting 4 days ago; Ravi was invited 22 days ago with nothing recorded since.
  const booked = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: priya.id, kind: "meeting_booked", doneAt: ago(7), meetingAt: ago(4) });
  assert.equal(booked.status, 201);
  const invite = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: ravi.id, kind: "invite_sent", doneAt: ago(22) });
  assert.equal(invite.status, 201);

  const list = await call(todo.GET, "GET", "/api/outreach/todo", "a");
  assert.equal(list.status, 200);
  assert.deepEqual(list.json.items.map((i: Json) => [i.group, i.person, i.kind]), [["meeting", "Priya", "meeting"], ["question", "Ravi", "withdraw"]]);
  assert.match(list.json.items[1].rule, /Accepted\?/);
  assert.equal(list.json.empty, false);

  const done = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: priya.id, kind: "meeting_done", happened: "yes", rating: "good" });
  assert.equal(done.status, 201);
  const accepted = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: ravi.id, kind: "accepted" });
  assert.equal(accepted.status, 201);
  const after = await call(todo.GET, "GET", "/api/outreach/todo", "a");
  assert.deepEqual(after.json.items, []);
  assert.equal(after.json.empty, true);
  assert.equal(after.json.message, "All caught up this week");
  // The thank-you the answer suggested is due later, so it is not owed yet.
  assert.ok(done.json.events.some((e: Json) => e.kind === "thank_you" && e.status === "due"));
  await pg.close();
});

test("the timeline GET shows the meeting card for a booked meeting more than an hour past, and not before", async () => {
  const { pg, db } = await fresh();
  const { timeline } = await routes();
  const c = await addContact(db, "a", { ...people, name: "Priya" });
  const soon = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "meeting_booked", meetingAt: new Date(Date.now() - 30 * 60_000).toISOString() });
  assert.equal(soon.status, 201);
  assert.equal((await call(timeline.GET, "GET", `/api/outreach/timeline?contactId=${c.id}`, "a")).json.meetingCard, null);
  const old = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "meeting_booked", meetingAt: ago(1) });
  const got = await call(timeline.GET, "GET", `/api/outreach/timeline?contactId=${c.id}`, "a");
  assert.equal(got.status, 200);
  assert.equal(got.json.meetingCard.eventId, old.json.event.id);
  assert.equal(got.json.events.length, 2);
  await pg.close();
});

test("the feed returns due and done items with goal and rule, and superseded ones flagged, not dropped", async () => {
  const { pg, db } = await fresh();
  const { timeline, calendar } = await routes();
  const c = await addContact(db, "a", { ...people, name: "Priya", goal: "referral" });
  await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "message_sent", doneAt: ago(2) });
  const thanks = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "thank_you", status: "due", dueAt: ahead(3).slice(0, 10), rule: "Send a thank-you note." });
  assert.equal(thanks.status, 201);
  const gone = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "check_in", status: "due", dueAt: ahead(10).slice(0, 10) });
  await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "supersede", eventId: gone.json.event.id, reason: "dismissed" });

  const feed = await call(calendar.GET, "GET", `/api/outreach/calendar?from=${ago(10).slice(0, 10)}&to=${ahead(30).slice(0, 10)}`, "a");
  assert.equal(feed.status, 200);
  const byKind = Object.fromEntries(feed.json.items.map((i: Json) => [i.kind, i]));
  assert.deepEqual(Object.keys(byKind[ "message" ]).sort(), ["at", "contactId", "goal", "id", "kind", "person", "rule", "status"]);
  assert.equal(byKind.message.status, "done");
  assert.equal(byKind.thank_you.status, "due");
  assert.equal(byKind.thank_you.goal, "referral");
  assert.equal(byKind.thank_you.rule, "Send a thank-you note.");
  assert.equal(byKind.thank_you.person, "Priya");
  assert.equal(byKind.check_in.status, "superseded");
  await pg.close();
});

test("AE10: a move supersedes the old date and adds the new; the same op_id returns the original result", async () => {
  const { pg, db } = await fresh();
  const { timeline, calendar } = await routes();
  const c = await addContact(db, "a", { ...people, name: "Priya" });
  const thanks = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "thank_you", status: "due", dueAt: "2099-11-13" });
  const move = { op_id: "move-thanks-1", id: thanks.json.event.id, day: "2099-11-14" };
  const first = await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", "a", move);
  assert.equal(first.status, 200);
  assert.equal(first.json.replayed, false);
  assert.equal(first.json.previous.status, "superseded");
  assert.equal(dayOf(first.json.previous.at), "2099-11-13");
  assert.equal(first.json.item.status, "due");
  assert.equal(dayOf(first.json.item.at), "2099-11-14");
  assert.equal(first.json.item.at, "2099-11-14T05:00:00.000Z"); // 10:30 IST

  const again = await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", "a", move);
  assert.equal(again.status, 200);
  assert.equal(again.json.replayed, true);
  assert.equal(again.json.item.id, first.json.item.id);
  const rows = await pg.query<{ n: number }>("select count(*)::int as n from outreach_events where contact_id = $1", [c.id]);
  assert.equal(rows.rows[0].n, 2);

  // The retry key can't be reused for another item; a superseded item can't be moved again.
  assert.equal((await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", "a", { ...move, id: first.json.item.id })).status, 409);
  assert.equal((await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", "a", { ...move, op_id: "move-thanks-2" })).status, 409);
  // Another user can't move it.
  assert.equal((await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", "b", { op_id: "move-b-12345", id: first.json.item.id, day: "2099-11-20" })).status, 404);
  // Bad bodies are refused.
  assert.equal((await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", "a", { op_id: "x", id: "y", day: "tomorrow" })).status, 400);
  await pg.close();
});

test("moving a meeting keeps its time of day and supersedes the old booking", async () => {
  const { pg, db } = await fresh();
  const { timeline, calendar } = await routes();
  const c = await addContact(db, "a", { ...people, name: "Priya" });
  const m = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "meeting_booked", meetingAt: "2099-12-01T09:30:00.000Z" });
  const moved = await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", "a", { op_id: "move-meet-001", id: m.json.event.id, day: "2099-12-03" });
  assert.equal(moved.status, 200);
  assert.equal(moved.json.item.kind, "meeting");
  assert.equal(moved.json.item.at, "2099-12-03T09:30:00.000Z");
  assert.equal(moved.json.previous.status, "superseded");
  await pg.close();
});

test("a lapsed session can read its timeline, calendar and to-do, but gets 402 on POST and PATCH and nothing is written", async () => {
  const { pg, db } = await fresh();
  const { timeline, calendar, todo } = await routes();
  const c = await addContact(db, "a", { ...people, name: "Priya" });
  const seeded = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "thank_you", status: "due", dueAt: "2099-11-13" });
  await withPaywall(async () => {
    assert.equal((await call(timeline.GET, "GET", `/api/outreach/timeline?contactId=${c.id}`, "a")).status, 200);
    assert.equal((await call(calendar.GET, "GET", "/api/outreach/calendar", "a")).status, 200);
    assert.equal((await call(todo.GET, "GET", "/api/outreach/todo", "a")).status, 200);
    const post = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "message_sent" });
    assert.equal(post.status, 402);
    assert.equal(post.json.code, "subscription_required");
    assert.equal((await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", "a", { op_id: "lapsed-move-1", id: seeded.json.event.id, day: "2099-11-20" })).status, 402);
  });
  const rows = await pg.query<{ n: number; s: string }>("select count(*)::int as n, min(status) as s from outreach_events");
  assert.equal(rows.rows[0].n, 1);
  assert.equal(rows.rows[0].s, "due");
  await pg.close();
});

test("R47: a lapsed session can still list its contacts, but cannot add, change or remove them", async () => {
  const { pg, db } = await fresh();
  const contacts = await import("../app/api/outreach/contacts/route");
  const c = await addContact(db, "a", { ...people, name: "Priya" });
  await withPaywall(async () => {
    const list = await call(contacts.GET, "GET", "/api/outreach/contacts", "a");
    assert.equal(list.status, 200);
    assert.deepEqual(list.json.contacts.map((x: { id: string }) => x.id), [c.id]);
    assert.equal((await call(contacts.GET, "GET", "/api/outreach/contacts", null)).status, 401);
    const add = await call(contacts.POST, "POST", "/api/outreach/contacts", "a", { name: "Ravi", ...people });
    assert.equal(add.status, 402);
    assert.equal((await call(contacts.PATCH, "PATCH", "/api/outreach/contacts", "a", { id: c.id, name: "X" })).status, 402);
    assert.equal((await call(contacts.DELETE, "DELETE", "/api/outreach/contacts", "a", { id: c.id })).status, 402);
  });
  const rows = await pg.query<{ n: number }>("select count(*)::int as n from contacts");
  assert.equal(rows.rows[0].n, 1);
  await pg.close();
});

test("without a session every route says to sign in", async () => {
  const { pg } = await fresh();
  const { timeline, calendar, todo } = await routes();
  assert.equal((await call(timeline.GET, "GET", "/api/outreach/timeline?contactId=x", null)).status, 401);
  assert.equal((await call(timeline.POST, "POST", "/api/outreach/timeline", null, {})).status, 401);
  assert.equal((await call(calendar.GET, "GET", "/api/outreach/calendar", null)).status, 401);
  assert.equal((await call(calendar.PATCH, "PATCH", "/api/outreach/calendar", null, {})).status, 401);
  assert.equal((await call(todo.GET, "GET", "/api/outreach/todo", null)).status, 401);
  await pg.close();
});

test("a window over six months is clamped to one month back and five ahead, not rejected", async () => {
  const { pg, db } = await fresh();
  const { timeline, calendar } = await routes();
  const c = await addContact(db, "a", { ...people, name: "Priya" });
  for (const [kind, d] of [["thank_you", ago(60)], ["check_in", ahead(20)], ["reschedule", ahead(400)]] as const) {
    const r = await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind, status: "due", dueAt: d.slice(0, 10) });
    assert.equal(r.status, 201);
  }
  const wide = await call(calendar.GET, "GET", "/api/outreach/calendar?from=2000-01-01&to=2100-01-01", "a");
  assert.equal(wide.status, 200);
  assert.equal(wide.json.clamped, true);
  assert.deepEqual(wide.json.items.map((i: Json) => i.kind), ["check_in"]);
  const spanDays = (new Date(wide.json.to).getTime() - new Date(wide.json.from).getTime()) / DAY;
  assert.ok(spanDays > 175 && spanDays < 190, `window was ${spanDays} days`);
  const plain = await call(calendar.GET, "GET", "/api/outreach/calendar", "a");
  assert.equal(plain.json.clamped, false);
  assert.equal((await call(calendar.GET, "GET", "/api/outreach/calendar?from=nope", "a")).status, 400);
  await pg.close();
});

test("a user only sees and changes their own timeline, calendar and to-do", async () => {
  const { pg, db } = await fresh();
  const { timeline, calendar, todo } = await routes();
  const mine = await addContact(db, "a", { ...people, name: "Priya" });
  await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: mine.id, kind: "invite_sent", doneAt: ago(30) });
  assert.equal((await call(timeline.GET, "GET", `/api/outreach/timeline?contactId=${mine.id}`, "b")).status, 404);
  assert.equal((await call(timeline.POST, "POST", "/api/outreach/timeline", "b", { type: "insert", op_id: op(), contactId: mine.id, kind: "accepted" })).status, 404);
  assert.deepEqual((await call(calendar.GET, "GET", "/api/outreach/calendar", "b")).json.items, []);
  assert.equal((await call(todo.GET, "GET", "/api/outreach/todo", "b")).json.empty, true);
  assert.equal((await call(todo.GET, "GET", "/api/outreach/todo", "a")).json.empty, false);
  await pg.close();
});

test("POST validates its body: future done dates, unknown fields, bad dates and a foreign trigger are refused", async () => {
  const { pg, db } = await fresh();
  const { timeline } = await routes();
  const c = await addContact(db, "a", { ...people, name: "Priya" });
  const post = (b: unknown) => call(timeline.POST, "POST", "/api/outreach/timeline", "a", b);
  assert.equal((await post({ type: "insert", op_id: op(), contactId: c.id, kind: "message_sent", doneAt: ahead(3) })).status, 400);
  assert.equal((await post({ type: "insert", op_id: op(), contactId: c.id, kind: "message_sent", extra: 1 })).status, 400);
  assert.equal((await post({ type: "insert", op_id: op(), contactId: c.id, kind: "message_sent", doneAt: "2026-13-45" })).status, 400);
  assert.equal((await post({ type: "insert", op_id: op(), contactId: c.id, kind: "nope" })).status, 400);
  assert.equal((await post({ type: "insert", op_id: op(), contactId: c.id, kind: "meeting_done" })).status, 400);
  assert.equal((await post({ type: "insert", op_id: op(), contactId: c.id, kind: "meeting_done", happened: "yes", note: "x".repeat(281) })).status, 400);
  assert.equal((await post({ type: "supersede", eventId: "x", reason: "moved" })).status, 400);
  assert.equal((await post({ type: "insert", op_id: op(), contactId: c.id, kind: "thank_you", status: "due", dueAt: "2099-01-01", triggerId: "no-such-event" })).status, 404);
  // A done date of today or earlier is fine, as a bare date too; undo strikes the record out.
  const ok = await post({ type: "insert", op_id: op(), contactId: c.id, kind: "message_sent", doneAt: dayOf(ago(2)) });
  assert.equal(ok.status, 201);
  const undo = await post({ type: "supersede", eventId: ok.json.event.id, reason: "undone" });
  assert.equal(undo.status, 200);
  assert.equal(undo.json.event.status, "superseded");
  assert.equal(undo.json.contact.status, "to_contact");
  // Same op_id twice: one event, 200 the second time.
  const key = op();
  const a = await post({ type: "insert", op_id: key, contactId: c.id, kind: "invite_sent" });
  const b = await post({ type: "insert", op_id: key, contactId: c.id, kind: "invite_sent" });
  assert.equal(a.status, 201); assert.equal(b.status, 200); assert.equal(b.json.event.id, a.json.event.id);
  await pg.close();
});

test("the meeting's .ics has the person's name and time, and no attendee unless one was entered", async () => {
  const { pg, db } = await fresh();
  const { timeline, calendar } = await routes();
  const c = await addContact(db, "a", { ...people, name: "Priya Shah" });
  await call(timeline.POST, "POST", "/api/outreach/timeline", "a", { type: "insert", op_id: op(), contactId: c.id, kind: "meeting_booked", meetingAt: "2099-11-12T09:30:00.000Z" });
  const feed = await call(calendar.GET, "GET", "/api/outreach/calendar?from=2099-11-01&to=2099-11-30", "a");
  // A window in 2099 is outside what the Calendar shows, so read the item through the mapper from the same rows.
  assert.deepEqual(feed.json.items, []);
  const rows = await pg.query("select e.id, e.contact_id, e.kind, e.status, e.due_at, e.done_at, e.meeting_at, e.rule, c.name, c.goal from outreach_events e join contacts c on c.id = e.contact_id");
  const item = calendarItems(rows.rows.map((r) => calendarRow(r as Record<string, unknown>)))[0];
  assert.equal(item.kind, "meeting");
  const ics = outreachIcs([meetingEvent(item)], new Date("2099-01-01T00:00:00Z"));
  assert.match(ics, /SUMMARY:Meeting scheduled: Priya Shah/);
  assert.match(ics, /DTSTART:20991112T093000Z/);
  assert.doesNotMatch(ics, /ATTENDEE/);
  assert.match(outreachIcs([meetingEvent(item, { attendeeEmail: "priya@example.com" })]), /ATTENDEE:mailto:priya@example.com/);
  assert.equal(new URL(outreachGoogleCalendarUrl(meetingEvent(item))).searchParams.has("add"), false);
  await pg.close();
});
