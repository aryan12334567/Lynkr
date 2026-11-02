// U7 + U17: the Outreach workspace's pure logic (node:test cannot parse JSX, so every rule lives in lib/outreach/ui-*.ts),
// and the request bodies the screens send, driven through the real timeline and calendar routes on PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { outreachVersion } from "../lib/outreach/flags";

const href = (p: string) => new URL(p, import.meta.url).href;
const authStub = `export const accountsConfigured = () => true;
export async function sessionUser(req) { const id = req.headers.get("x-test-user"); return id ? { id, email: id + "@test.local", dodoCustomerId: null } : null; }`;
const dbStub = `export * from ${JSON.stringify(href("../lib/db.ts"))};
export const getDb = () => globalThis.__lynkrTestDb;
export const cloudReady = async () => true;`;
register("data:text/javascript," + encodeURIComponent(`
const root = ${JSON.stringify(href("../"))};
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

const { pgliteDb } = await import("../lib/db");
const { addContact } = await import("../lib/outreach/contacts-db");
const { summarize, NOTE_MAX: SERVER_NOTE_MAX } = await import("../lib/outreach/timeline");
const { addBusinessDays } = await import("../lib/outreach/followup");
const { addDays, todayIST } = await import("../lib/ist");
const tabs = await import("../lib/outreach/ui-tabs");
const board = await import("../lib/outreach/ui-board");
const goalsUi = await import("../lib/outreach/ui-goals");
const person = await import("../lib/outreach/ui-person");
const tl = await import("../lib/outreach/ui-timeline");
const meeting = await import("../lib/outreach/ui-meeting");
const demo = await import("../lib/outreach/ui-demo");
type Db = import("../lib/db").Db;

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
const timelineRoute = await import("../app/api/outreach/timeline/route");
const calendarRoute = await import("../app/api/outreach/calendar/route");
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
/** The screens' `send`, wired to the real handlers instead of fetch. */
function routeSend(user = "a"): import("../lib/outreach/ui-timeline").Send {
  return async (req) => {
    const headers = { "content-type": "application/json", "x-forwarded-for": "10.2.2.2", "x-test-user": user };
    const handler = req.route === "timeline" ? timelineRoute.POST : calendarRoute.PATCH;
    const res = await handler(new Request("http://localhost/api", { method: req.route === "timeline" ? "POST" : "PATCH", headers, body: JSON.stringify(req.body) }));
    const json = (await res.json()) as Json;
    if (!res.ok) throw Object.assign(new Error(json.error), { status: res.status });
    const get = await timelineRoute.GET(new Request(`http://localhost/api?contactId=${req.contactId}`, { headers }));
    const full = (await get.json()) as Json;
    return { events: full.events, contact: full.contact, event: json.event, replayed: Boolean(json.replayed) };
  };
}

test("outreach switch defaults to v1 except preview, and accepts overrides", () => {
  const env = process.env;
  try {
    process.env = { ...env }; delete process.env.LYNKR_OUTREACH; delete process.env.VERCEL_ENV;
    assert.equal(outreachVersion(), "v1"); process.env.VERCEL_ENV = "preview"; assert.equal(outreachVersion(), "v2");
    process.env.LYNKR_OUTREACH = "v1"; assert.equal(outreachVersion(), "v1");
    process.env.VERCEL_ENV = "production"; process.env.LYNKR_OUTREACH = "v2"; assert.equal(outreachVersion(), "v2");
  } finally { process.env = env; }
});

test("U7 tabs: v2 drops Connect, v1 is unchanged, Profile fix stays removed", () => {
  const label = (v2: boolean) => tabs.tabIds(v2).map((id) => tabs.TAB_LABEL[id]);
  assert.deepEqual(label(true), ["Today", "Story Vault", "Outreach", "Posts & comments", "This week", "Check a message"]);
  assert.deepEqual(label(false), ["Today", "Story Vault", "Outreach", "Posts & comments", "This week", "Connect", "Check a message"]);
});

test("R1: interview goals arrive pre-selected, saved goals win, one tap saves", () => {
  const fromInterview = goalsUi.initialGoals([], ["job", "mentor"]);
  assert.deepEqual(fromInterview.selected, ["job", "mentor"]);
  assert.equal(fromInterview.source, "interview");
  assert.equal(goalsUi.canSave(fromInterview.selected), true);
  const saved = goalsUi.initialGoals(["clients"], ["job"]);
  assert.deepEqual(saved.selected, ["clients"]);
  assert.equal(saved.source, "saved");
  assert.equal(goalsUi.initialGoals([], []).source, "none");
  assert.equal(goalsUi.canSave([]), false);
  assert.deepEqual(goalsUi.toggleGoal(["job"], "mentor"), ["job", "mentor"]);
  assert.deepEqual(goalsUi.toggleGoal(["job", "mentor"], "job"), ["mentor"]);
  assert.equal(goalsUi.GOAL_CHIPS.length, 10);
  assert.equal(goalsUi.contactGoal([]), "network");
  assert.equal(goalsUi.contactGoal(["mentor", "job"]), "mentor");
});

test("PeopleBoard: columns by derived stage, Tier 1 filter, Boosters filter", () => {
  const c = (id: string, status: string, tier: "tier_1" | "tier_2", repliedAt: string | null = null) => ({ id, name: id, status, tier, repliedAt, company: null, role: null, nextActionAt: null }) as never;
  const list = [c("a", "invited", "tier_2"), c("b", "invited", "tier_1"), c("c", "replied", "tier_2", "2026-11-01T00:00:00Z"), c("d", "meeting", "tier_1", "2026-11-01T00:00:00Z")];
  const cols = board.groupByStage(list);
  assert.deepEqual(cols.map((x) => x.id), ["to_contact", "invited", "accepted", "messaged", "replied", "meeting", "outcome"]);
  assert.deepEqual(cols.find((x) => x.id === "invited")!.contacts.map((x: { id: string }) => x.id), ["b", "a"], "Tier 1 first");
  assert.deepEqual(board.filterContacts(list, { tier1: true, boosters: false }).map((x: { id: string }) => x.id), ["b", "d"]);
  assert.deepEqual(board.filterContacts(list, { tier1: false, boosters: true }).map((x: { id: string }) => x.id), ["c", "d"]);
  assert.deepEqual(board.filterContacts(list, { tier1: true, boosters: true }).map((x: { id: string }) => x.id), ["d"]);
  assert.equal(board.isBooster(list[0]), false);
});

test("R8: Open profile when the link is known, Find on LinkedIn (name and company) when not", () => {
  const known = person.profileLink({ name: "Priya Nair", company: "Razorpay", profileUrl: "https://www.linkedin.com/in/priya/" });
  assert.deepEqual(known, { href: "https://www.linkedin.com/in/priya/", label: "Open profile", known: true });
  const find = person.profileLink({ name: "Priya Nair", company: "Razorpay", profileUrl: null });
  assert.equal(find.label, "Find on LinkedIn");
  const url = new URL(find.href);
  assert.equal(url.hostname, "www.linkedin.com");
  assert.equal(url.searchParams.get("keywords"), "Priya Nair Razorpay");
});

test("U17 timeline rows: R38 order, text status, superseded steps announced as Replaced by <date>", () => {
  const today = todayIST();
  const mk = (o: Partial<import("../lib/outreach/ui-timeline").UiEvent> & { id: string; kind: string }) => ({ contactId: "c", status: "done", dueAt: null, doneAt: null, meetingAt: null, happened: null, rating: null, note: null, rule: null, supersededReason: null, supersedesId: null, triggerId: null, opId: o.id, createdAt: "2026-11-01T00:00:00Z", ...o }) as import("../lib/outreach/ui-timeline").UiEvent;
  const events = [
    mk({ id: "i", kind: "invite_sent", doneAt: "2026-11-04T05:00:00Z" }),
    mk({ id: "old", kind: "thank_you", status: "superseded", dueAt: "2026-11-13T05:00:00Z", supersededReason: "moved" }),
    mk({ id: "new", kind: "thank_you", status: "due", dueAt: "2026-11-14T05:00:00Z", rule: "Send a thank-you note the next business day.", supersedesId: "old" }),
    mk({ id: "dis", kind: "check_in", status: "superseded", dueAt: "2026-11-20T05:00:00Z", supersededReason: "dismissed" }),
  ];
  const rows = tl.timelineRows(events, new Date("2026-11-10T05:00:00Z"));
  assert.deepEqual(rows.map((r) => r.event.id), ["i", "old", "new", "dis"], "date order");
  const old = rows[1];
  assert.equal(old.statusText, "Replaced by 14 Nov");
  assert.equal(old.struck, true);
  assert.equal(rows[3].statusText, "Dismissed");
  assert.equal(rows[0].statusText, "Done 4 Nov");
  assert.match(rows[2].statusText, /^Suggested for 14 Nov/);
  assert.equal(rows[2].onCalendar, true);
  assert.deepEqual(tl.stepActions(rows[2]), ["change_date", "not_now"]);
  assert.deepEqual(tl.stepActions(rows[0]), []);
  assert.equal(tl.nextStep(events)!.id, "new");
  void today;
});

test("AE7: a linked comment shows as the why line, then the recorded steps", () => {
  assert.equal(tl.whyLine({ whyText: "You commented on their post on 3 Nov", whySource: "comment" }).text, "Why: You commented on their post on 3 Nov");
  assert.equal(tl.whyLine({ whyText: null, whySource: null }).empty, true);
  assert.equal(tl.whyProblem("x".repeat(201)) !== null, true);
  assert.equal(tl.whyProblem("x".repeat(200)), null);
});

test("a new contact shows only the why line and Record Invite sent; later stages offer the records valid for them", () => {
  assert.deepEqual(tl.recordChoices("to_contact", { hasEvents: false, pendingMeeting: false }), ["invite_sent"]);
  assert.deepEqual(tl.recordChoices("invited", { hasEvents: true, pendingMeeting: false }), ["accepted", "message_sent", "closed"]);
  assert.ok(tl.recordChoices("messaged", { hasEvents: true, pendingMeeting: false }).includes("reply"));
  assert.ok(!tl.recordChoices("messaged", { hasEvents: true, pendingMeeting: false }).includes("invite_sent"));
  assert.deepEqual(tl.recordChoices("outcome", { hasEvents: true, pendingMeeting: false }), []);
});

test("lapsed users read the timeline but cannot record", () => {
  assert.deepEqual(tl.timelineAccess(true), { canRecord: false, notice: "Subscribe to record steps" });
  assert.deepEqual(tl.timelineAccess(false), { canRecord: true, notice: "" });
});

test("R40 date rules: done records never in the future, meeting booked may be", () => {
  assert.equal(tl.doneDateProblem("2026-11-05", "2026-11-05"), null);
  assert.equal(tl.doneDateProblem("2026-11-04", "2026-11-05"), null);
  assert.match(tl.doneDateProblem("2026-11-06", "2026-11-05")!, /today or earlier/);
  assert.match(tl.doneDateProblem("", "2026-11-05")!, /date/i);
  assert.equal(tl.moveDateProblem("2026-11-04", "2026-11-05") !== null, true);
  assert.equal(tl.moveDateProblem("2026-11-05", "2026-11-05"), null);
  const future = tl.recordRequest("c1", "invite_sent", "2099-01-01", "op-aaaaaaaa");
  assert.equal(future.ok, false);
  assert.equal(tl.recordRequest("c1", "meeting_booked", "2099-01-01", "op-aaaaaaaa", "18:00").ok, true);
});

test("the note stops at 280 characters, with a live count", () => {
  assert.equal(tl.NOTE_MAX, SERVER_NOTE_MAX);
  assert.equal(tl.noteCount("x".repeat(281)), "281 / 280");
  assert.match(tl.noteProblem("x".repeat(281))!, /280/);
  assert.equal(tl.noteProblem("x".repeat(280)), null);
});

test("ui status derivation agrees with the server's summary for any order of records", () => {
  const e = (id: string, kind: string, doneAt: string | null, status = "done", extra: object = {}) => ({ id, kind, status, doneAt, dueAt: null, meetingAt: null, happened: null, rating: null, note: null, rule: null, supersededReason: null, supersedesId: null, triggerId: null, opId: id, createdAt: "2026-11-01T00:00:00Z", contactId: "c", userId: "a", ...extra });
  const list = [e("1", "message_sent", "2026-11-06T05:00:00Z"), e("2", "invite_sent", "2026-11-04T05:00:00Z"), e("3", "accepted", "2026-11-06T05:00:00Z", "superseded"), e("4", "reply", "2026-11-09T05:00:00Z")];
  const server = summarize(list.map((x) => ({ ...x, doneAt: new Date(x.doneAt!), createdAt: new Date(x.createdAt), dueAt: null, meetingAt: null })) as never).status;
  assert.equal(tl.deriveStatus(list as never), server);
  assert.equal(server, "replied");
});

test("demo mode (R37): a seeded timeline with done, due, superseded steps and a pending meeting card", () => {
  const now = new Date("2026-11-20T09:00:00Z");
  const seed = demo.demoSeed(now);
  const rows = tl.timelineRows(seed.events, now);
  const tones = new Set(rows.map((r) => r.tone));
  for (const tone of ["done", "suggested", "superseded"]) assert.ok(tones.has(tone as never), tone);
  assert.ok(rows.some((r) => r.statusText.startsWith("Replaced by ")));
  assert.equal(tl.pendingMeeting(seed.events, now) !== null, true);
  assert.equal(seed.contact.id.startsWith("demo-"), true);
  assert.ok(seed.contact.whyText);
});

test("demo backend records locally and the retry of one op writes one event", async () => {
  const now = new Date("2026-11-20T09:00:00Z");
  const d = demo.createDemoApi(now);
  const req = tl.recordRequest("demo-priya", "message_sent", "2026-11-19", "op-demo-0001", undefined, "2026-11-20");
  assert.equal(req.ok, true);
  if (!req.ok) return;
  const before = d.events().length;
  await d.send(req.req);
  await d.send(req.req);
  assert.equal(d.events().length, before + 1);
});

test("meeting card: Moved needs a new time, the first answer is required, the note stops at 280", () => {
  const f = meeting.initialForm();
  assert.equal(meeting.formState(f, "job", "2026-11-12").canSave, false);
  assert.equal(meeting.formState({ ...f, happened: "yes" }, "job", "2026-11-12").canSave, true);
  assert.equal(meeting.formState({ ...f, happened: "moved" }, "job", "2026-11-12").canSave, false);
  assert.equal(meeting.formState({ ...f, happened: "moved", movedDay: "2026-11-15", movedTime: "17:00" }, "job", "2026-11-12").canSave, true);
  assert.equal(meeting.formState({ ...f, happened: "yes", note: "x".repeat(281) }, "job", "2026-11-12").canSave, false);
  const useful = meeting.onHappened(f, "yes", "job", new Date("2026-11-12T16:00:00Z"));
  assert.equal(useful.next, "thank_you", "the recommended step starts selected");
  const network = meeting.onRating(meeting.onHappened(f, "yes", "network", new Date()), "good", "network", new Date());
  assert.equal(network.goalReached, true, "AE12: a Useful network meeting ticks Goal reached");
  const job = meeting.onRating(meeting.onHappened(f, "yes", "job", new Date()), "good", "job", new Date());
  assert.equal(job.goalReached, false, "AE8: not for a job contact");
  assert.ok(meeting.nextChoices("job", { ...f, happened: "yes", rating: "good" }, new Date()).some((s) => s.choice === "referral_ask"));
  assert.ok(!meeting.nextChoices("network", { ...f, happened: "yes", rating: "good" }, new Date()).some((s) => s.choice === "referral_ask"));
});

test("AE8 (UI, real routes): Yes, Useful, Act on what they suggested, with a note gives two due items; a retry adds nothing", async () => {
  const { db } = await fresh();
  const priya = await addContact(db, "a", { ...people, name: "Priya" });
  const send = routeSend();
  const booked = await send({ route: "timeline", contactId: priya.id, body: { type: "insert", op_id: "op-booked-01", contactId: priya.id, kind: "meeting_booked", doneAt: ago(2), meetingAt: ago(0.1) } });
  assert.ok(tl.pendingMeeting(booked.events, new Date()), "the card is owed");
  const note = "Send her my SQL project; she'll pass it to the hiring manager";
  const form = { ...meeting.initialForm(), happened: "yes" as const, rating: "good" as const, next: "act_on_it" as const, goalReached: false, note };
  const ctx = { contactId: priya.id, goal: "job", bookedEventId: booked.event!.id, form, baseOp: "op-card-0001", now: new Date() };
  const first = await meeting.answerMeeting(send, ctx);
  const again = await meeting.answerMeeting(send, ctx);
  assert.equal(again.events.length, first.events.length, "a retry writes nothing new");
  const due = first.events.filter((e) => e.status === "due");
  assert.deepEqual(due.map((e) => e.kind).sort(), ["follow_up", "thank_you"]);
  const today = todayIST();
  const dayOf = (iso: string) => todayIST(new Date(iso));
  assert.equal(dayOf(due.find((e) => e.kind === "thank_you")!.dueAt!), addBusinessDays(today, 1));
  assert.equal(dayOf(due.find((e) => e.kind === "follow_up")!.dueAt!), addDays(today, 7));
  assert.equal(first.contact!.goalReachedAt, null);
  const done = first.events.find((e) => e.kind === "meeting_done")!;
  assert.equal(done.note, note);
  assert.equal(tl.pendingMeeting(first.events, new Date()), null, "the card is gone once answered");
  const row = tl.timelineRows(first.events, new Date()).find((r) => r.event.id === done.id)!;
  assert.match(row.noteLine!, /^Your note, \d+ \w{3}: Send her my SQL project/);
});

test("Moved replaces the old meeting, and the card returns after the new time", async () => {
  const { db } = await fresh();
  const c = await addContact(db, "a", { ...people, name: "Ravi" });
  const send = routeSend();
  const booked = await send({ route: "timeline", contactId: c.id, body: { type: "insert", op_id: "op-booked-02", contactId: c.id, kind: "meeting_booked", doneAt: ago(2), meetingAt: ago(0.1) } });
  const day = addDays(todayIST(), 3);
  const form = { ...meeting.initialForm(), happened: "moved" as const, movedDay: day, movedTime: "17:00" };
  const out = await meeting.answerMeeting(send, { contactId: c.id, goal: "job", bookedEventId: booked.event!.id, form, baseOp: "op-card-0002", now: new Date() });
  const rows = tl.timelineRows(out.events, new Date());
  assert.ok(rows.some((r) => r.statusText.startsWith("Replaced by ")));
  assert.equal(tl.pendingMeeting(out.events, new Date()), null, "the new time is in the future, so no card yet");
  assert.equal(tl.pendingMeeting(out.events, new Date(Date.now() + 4 * DAY)) !== null, true);
});

test("records and taps through the real route: a retry never duplicates, a future done date is refused", async () => {
  const { db } = await fresh();
  const c = await addContact(db, "a", { ...people, name: "Meera" });
  const send = routeSend();
  const rec = tl.recordRequest(c.id, "invite_sent", todayIST(), "op-invite-0001");
  if (!rec.ok) throw new Error(rec.message);
  const one = await send(rec.req);
  const two = await send(rec.req);
  assert.equal(two.events.length, one.events.length);
  assert.equal(two.replayed, true);
  assert.equal(two.contact!.status, "invited");
  // The UI refuses it first; the server agrees.
  const sneaky = { route: "timeline" as const, contactId: c.id, body: { type: "insert", op_id: "op-future-0001", contactId: c.id, kind: "accepted", status: "done", doneAt: addDays(todayIST(), 3) } };
  await assert.rejects(send(sneaky), /today or earlier/);
  // Not now, Undo, Mark done and Change date.
  const msg = tl.recordRequest(c.id, "message_sent", todayIST(), "op-msg-0001");
  if (!msg.ok) throw new Error(msg.message);
  const afterMsg = await send(msg.req);
  const q = afterMsg.events.find((e) => e.kind === "second_person" && e.status === "due")!;
  const moved = await send(tl.moveRequest(c.id, q.id, addDays(todayIST(), 10), undefined, "op-move-0001"));
  assert.equal(moved.events.find((e) => e.id === q.id)!.status, "superseded");
  const replacement = moved.events.find((e) => e.supersedesId === q.id)!;
  const dismissed = await send(tl.dismissRequest(c.id, replacement.id));
  assert.equal(dismissed.events.find((e) => e.id === replacement.id)!.supersededReason, "dismissed");
  const undone = await send(tl.undoRequest(c.id, one.event!.id));
  assert.equal(undone.events.find((e) => e.id === one.event!.id)!.supersededReason, "undone");
  const fu = afterMsg.events.find((e) => e.kind === "follow_up" && e.status === "due")!;
  const marked = await send(tl.completeRequest(c.id, fu.id, todayIST()));
  assert.equal(marked.events.find((e) => e.id === fu.id)!.status, "done");
});

test("a lapsed account reads the timeline and is refused writes with a 402 the screen turns into the subscribe note", async () => {
  const { db } = await fresh();
  const c = await addContact(db, "a", { ...people, name: "Asha" });
  const prev = [process.env.LYNKR_PAYWALL, process.env.DODO_PAYMENTS_API_KEY];
  process.env.LYNKR_PAYWALL = "1"; delete process.env.DODO_PAYMENTS_API_KEY;
  try {
    const rec = tl.recordRequest(c.id, "invite_sent", todayIST(), "op-lapsed-001");
    if (!rec.ok) throw new Error(rec.message);
    await assert.rejects(routeSend()(rec.req), (e: Error & { status?: number }) => e.status === 402);
    const read = await timelineRoute.GET(new Request(`http://localhost/api?contactId=${c.id}`, { headers: { "x-test-user": "a" } }));
    assert.equal(read.status, 200);
  } finally { if (prev[0] === undefined) delete process.env.LYNKR_PAYWALL; else process.env.LYNKR_PAYWALL = prev[0]; if (prev[1] !== undefined) process.env.DODO_PAYMENTS_API_KEY = prev[1]; }
});

test("Mark sent: a note uses one of the notes left and records the invite; a message records message sent", () => {
  assert.deepEqual(person.sentPlan({ channel: "connection_note" }, 3), { kind: "invite_sent", noteUsed: true, notesLeft: 2 });
  assert.deepEqual(person.sentPlan({ channel: "connection_note" }, 0), { kind: "invite_sent", noteUsed: true, notesLeft: 0 });
  assert.deepEqual(person.sentPlan({ channel: "linkedin_message" }, 3), { kind: "message_sent", noteUsed: false, notesLeft: 3 });
  assert.deepEqual(person.sentPlan({ channel: "connection_note" }, undefined), { kind: "invite_sent", noteUsed: true, notesLeft: undefined });
  assert.equal(person.angleValue("direct_ask"), "angle_direct_ask");
  assert.equal(person.angleValue("Their work!"), "angle_their_work");
});

test("verdicts decide what can be copied", () => {
  assert.equal(person.canCopy("Do not send yet"), false);
  assert.equal(person.canCopy("Edit before sending"), true);
  assert.equal(person.canCopy("Looks ready for your review"), true);
  assert.equal(person.verdictTone("Do not send yet"), "bad");
});
