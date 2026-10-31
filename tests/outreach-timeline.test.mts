import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { addContact, contactPatch, deleteContact, getContact, updateContact } from "../lib/outreach/contacts-db";
import { listEvents, recordEvent, TimelineError, type InsertOp, type Suggest, type TimelineOp } from "../lib/outreach/timeline";
import { deleteAll, exportAll, pgliteDb, poolDb, transaction, type Db } from "../lib/db";

const sql = (name: string) => readFileSync(new URL(`../scripts/migrations/${name}`, import.meta.url), "utf8");
async function fresh() {
  const pg = new PGlite();
  await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
  for (const f of ["001_vertical1.sql", "002_outreach.sql", "005_outreach_timeline.sql"]) await pg.exec(sql(f));
  return { pg, db: pgliteDb(pg) };
}
const input = { name: "Priya", bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1" } as const;
const NOW = new Date("2026-11-10T10:00:00Z");
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 5, 0, 0)); // 5 Nov 2026 05:00Z is 10:30 IST
let n = 0;
const op = (contactId: string, kind: InsertOp["kind"], doneAt: Date, extra: Partial<InsertOp> = {}): InsertOp => ({ type: "insert", opId: `op-${++n}`, contactId, kind, doneAt, ...extra });
const rec = (db: Db, user: string, o: TimelineOp, opts?: { suggest?: Suggest }) => recordEvent(db, user, o, { now: NOW, ...opts });

test("invite_sent, accepted and message_sent give status messaged with the three dates", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  await rec(db, "a", op(c.id, "invite_sent", day(1)));
  await rec(db, "a", op(c.id, "accepted", day(3)));
  const r = await rec(db, "a", op(c.id, "message_sent", day(4)));
  assert.equal(r.contact.status, "messaged");
  assert.equal(r.contact.invitedAt?.toISOString(), day(1).toISOString());
  assert.equal(r.contact.acceptedAt?.toISOString(), day(3).toISOString());
  assert.equal(r.contact.messagedAt?.toISOString(), day(4).toISOString());
  assert.equal((await getContact(db, "a", c.id))?.status, "messaged");
  assert.equal(r.events.length, 3);
  await pg.close();
});

test("recording an older invite_sent after message_sent leaves the status at messaged", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  await rec(db, "a", op(c.id, "message_sent", day(5)));
  const r = await rec(db, "a", op(c.id, "invite_sent", day(1)));
  assert.equal(r.contact.status, "messaged");
  assert.equal(r.contact.invitedAt?.toISOString(), day(1).toISOString());
  assert.equal(r.contact.messagedAt?.toISOString(), day(5).toISOString());
  // Even an earlier stage dated later (acceptance noticed on day 6) doesn't pull the status back.
  assert.equal((await rec(db, "a", op(c.id, "accepted", day(6)))).contact.status, "messaged");
  await pg.close();
});

test("the same op twice leaves one event and returns the existing row", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  const once = op(c.id, "invite_sent", day(1));
  const first = await rec(db, "a", once);
  const again = await rec(db, "a", once);
  assert.equal(first.replayed, false);
  assert.equal(again.replayed, true);
  assert.equal(again.event.id, first.event.id);
  assert.equal((await listEvents(db, "a", c.id)).length, 1);
  // The id is unique per user: another user may reuse it, the same user can't reuse it on another contact.
  const c2 = await addContact(db, "a", input);
  await assert.rejects(() => rec(db, "a", { ...once, contactId: c2.id }), (e) => e instanceof TimelineError && e.code === "conflict");
  const other = await addContact(db, "b", input);
  assert.equal((await rec(db, "b", { ...once, contactId: other.id })).replayed, false);
  await pg.close();
});

test("undoing a wrong accepted marks it superseded and takes the status back to invited", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  await rec(db, "a", op(c.id, "invite_sent", day(1)));
  const acc = await rec(db, "a", op(c.id, "accepted", day(3)));
  assert.equal(acc.contact.status, "accepted");
  const undone = await rec(db, "a", { type: "supersede", eventId: acc.event.id, reason: "undone" });
  assert.equal(undone.event.status, "superseded");
  assert.equal(undone.event.supersededReason, "undone");
  assert.equal(undone.contact.status, "invited");
  assert.equal(undone.contact.acceptedAt, null);
  assert.equal((await rec(db, "a", { type: "supersede", eventId: acc.event.id, reason: "undone" })).replayed, true);
  assert.equal((await listEvents(db, "a", c.id)).length, 2);
  await pg.close();
});

test("a summary rewrite that fails rolls back the inserted event", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  await rec(db, "a", op(c.id, "invite_sent", day(1)));
  await pg.exec(`create function boom() returns trigger language plpgsql as $$ begin raise exception 'summary failed'; end $$;
    create trigger contacts_boom before update on contacts for each row execute function boom();`);
  await assert.rejects(() => rec(db, "a", op(c.id, "accepted", day(2))), /summary failed/);
  assert.equal((await listEvents(db, "a", c.id)).length, 1);
  await pg.exec("drop trigger contacts_boom on contacts");
  assert.equal((await rec(db, "a", op(c.id, "accepted", day(2)))).contact.status, "accepted");
  await pg.close();
});

test("a failing suggestion also rolls back the user's event, and suggestions are applied before the summary", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  const broken: Suggest = () => [{ type: "insert", opId: "s-bad", contactId: c.id, kind: "follow_up", status: "due" }]; // no due date
  await assert.rejects(() => rec(db, "a", op(c.id, "message_sent", day(2)), { suggest: broken }), (e) => e instanceof TimelineError && e.code === "invalid");
  assert.equal((await listEvents(db, "a", c.id)).length, 0);
  assert.equal((await getContact(db, "a", c.id))?.status, "to_contact");

  const seen: number[] = [];
  const due = new Date("2026-11-12T05:00:00Z");
  const asks: Suggest = (contact, events) => {
    seen.push(events.length);
    return events.some((e) => e.kind === "message_sent") ? [{ type: "insert", opId: "s-1", contactId: contact.id, kind: "follow_up", status: "due", dueAt: due, rule: "No reply recorded in 3 business days." }] : [];
  };
  const r = await rec(db, "a", op(c.id, "message_sent", day(2)), { suggest: asks });
  assert.deepEqual(seen, [1]);
  assert.equal(r.contact.status, "messaged");
  assert.equal(r.contact.nextActionAt?.toISOString(), due.toISOString());
  const rule = r.events.find((e) => e.status === "due");
  assert.equal(rule?.rule, "No reply recorded in 3 business days.");
  await pg.close();
});

test("user B can't record on, read or undo user A's contact", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  const mine = await rec(db, "a", op(c.id, "invite_sent", day(1), { note: "private" }));
  await assert.rejects(() => rec(db, "b", op(c.id, "accepted", day(2))), (e) => e instanceof TimelineError && e.code === "not_found");
  await assert.rejects(() => rec(db, "b", { type: "supersede", eventId: mine.event.id, reason: "undone" }), (e) => e instanceof TimelineError && e.code === "not_found");
  await assert.rejects(() => rec(db, "b", { type: "update", eventId: mine.event.id, patch: { note: "x" } }), (e) => e instanceof TimelineError && e.code === "not_found");
  assert.deepEqual(await listEvents(db, "b", c.id), []);
  const stored = await listEvents(db, "a", c.id);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].status, "done");
  assert.equal(stored[0].note, "private");
  assert.equal((await getContact(db, "a", c.id))?.status, "invited");
  await pg.close();
});

test("deleting a contact removes its events; delete my data removes all; export includes them with notes", async () => {
  const { pg, db } = await fresh();
  const c1 = await addContact(db, "a", input), c2 = await addContact(db, "a", input), cb = await addContact(db, "b", input);
  await rec(db, "a", op(c1.id, "invite_sent", day(1)));
  await rec(db, "a", op(c2.id, "meeting_booked", day(1), { meetingAt: new Date("2026-11-20T05:00:00Z"), note: "ask about the SQL project" }));
  await rec(db, "b", op(cb.id, "invite_sent", day(1)));

  const exported = (await exportAll(db, "a")) as { outreach_events: Record<string, unknown>[] };
  assert.equal(exported.outreach_events.length, 2);
  assert.ok(exported.outreach_events.some((e) => e.note === "ask about the SQL project"));
  assert.ok(exported.outreach_events.every((e) => !("user_id" in e)));

  assert.equal(await deleteContact(db, "a", c1.id), true);
  assert.equal((await pg.query("select 1 from outreach_events where contact_id = $1", [c1.id])).rows.length, 0);
  assert.equal((await pg.query("select 1 from outreach_events where user_id = 'a'")).rows.length, 1);

  const counts = await deleteAll(db, "a");
  assert.equal(counts.outreach_events, 1);
  assert.equal((await pg.query("select 1 from outreach_events where user_id = 'a'")).rows.length, 0);
  assert.equal((await pg.query("select 1 from outreach_events where user_id = 'b'")).rows.length, 1);
  await pg.close();
});

test("migration 005 runs twice cleanly and a contact with status meeting saves", async () => {
  const { pg, db } = await fresh();
  await pg.exec(sql("005_outreach_timeline.sql"));
  await pg.exec(sql("005_outreach_timeline.sql"));
  const c = await addContact(db, "a", { ...input, whyText: "You commented on their post on 3 Nov", whySource: "comment" });
  assert.equal(c.whyText, "You commented on their post on 3 Nov");
  assert.equal((await updateContact(db, "a", c.id, { status: "meeting" }))?.status, "meeting");
  const m = await rec(db, "a", op(c.id, "meeting_booked", day(5), { meetingAt: new Date("2026-11-14T05:00:00Z") }));
  assert.equal(m.contact.status, "meeting");
  await assert.rejects(() => updateContact(db, "a", c.id, { status: "nonsense" as never }), /contacts_status_check/);
  await assert.rejects(() => addContact(db, "a", { ...input, whyText: "x".repeat(201) }));
  await pg.close();
});

test("the contacts PATCH body rejects status, outcome, stage dates and nextActionAt", () => {
  const id = "3f0f6f6e-5b0a-4a3e-9d57-0b1d6f3c9a11";
  assert.equal(contactPatch.safeParse({ id, name: "Priya B", whyText: "Met at the SQL meetup" }).success, true);
  for (const field of [{ status: "invited" }, { status: "meeting" }, { outcome: "positive" }, { invitedAt: "2026-11-01T00:00:00Z" }, { acceptedAt: null }, { messagedAt: "2026-11-01T00:00:00Z" }, { repliedAt: null }, { outcomeAt: null }, { nextActionAt: "2026-11-01T00:00:00Z" }, { goalReachedAt: null }, { closedAt: null }]) {
    assert.equal(contactPatch.safeParse({ id, ...field }).success, false, JSON.stringify(field));
  }
});

test("done steps can't be dated in the future, notes stop at 280, a meeting needs its time and an answer", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  const invalid = (e: unknown) => e instanceof TimelineError && e.code === "invalid";
  await assert.rejects(() => rec(db, "a", op(c.id, "invite_sent", new Date("2026-11-11T05:00:00Z"))), invalid);
  await assert.rejects(() => rec(db, "a", op(c.id, "invite_sent", day(1), { note: "x".repeat(281) })), invalid);
  assert.equal((await rec(db, "a", op(c.id, "invite_sent", day(1), { note: "x".repeat(280) }))).events.length, 1);
  await assert.rejects(() => rec(db, "a", op(c.id, "meeting_booked", day(1))), invalid);
  await assert.rejects(() => rec(db, "a", op(c.id, "meeting_done", day(1))), invalid);
  await assert.rejects(() => rec(db, "a", op(c.id, "reply", day(1), { rating: "good" })), invalid);
  // A meeting booked for a future date is fine, and so is a done record dated today.
  assert.equal((await rec(db, "a", op(c.id, "meeting_booked", day(9), { meetingAt: new Date("2026-11-30T05:00:00Z") }))).contact.status, "meeting");
  await pg.close();
});

test("an unanswered meeting is the next step; answering it, moving it and finishing change the summary", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", input);
  const at1 = new Date("2026-11-14T05:00:00Z"), at2 = new Date("2026-11-18T05:00:00Z");
  const booked = await rec(db, "a", op(c.id, "meeting_booked", day(5), { meetingAt: at1 }));
  assert.equal(booked.contact.nextActionAt?.toISOString(), at1.toISOString());

  // Change the date: the old booking is struck out and the new one is the next step.
  const moved = await rec(db, "a", op(c.id, "meeting_booked", day(6), { meetingAt: at2, supersedes: { id: booked.event.id, reason: "moved" } }));
  assert.equal(moved.contact.nextActionAt?.toISOString(), at2.toISOString());
  const old = moved.events.find((e) => e.id === booked.event.id);
  assert.equal(old?.status, "superseded");
  assert.equal(old?.supersededReason, "moved");
  assert.equal(moved.event.supersedesId, booked.event.id);

  // A due item and the meeting: the earlier of the two is next.
  const d = new Date("2026-11-13T05:00:00Z");
  const withDue = await rec(db, "a", op(c.id, "check_in", day(6), { status: "due", dueAt: d }));
  assert.equal(withDue.contact.nextActionAt?.toISOString(), d.toISOString());
  const done = await rec(db, "a", { type: "update", eventId: withDue.event.id, patch: { done: true, doneAt: day(8) } });
  assert.equal(done.event.status, "done");
  assert.equal(done.contact.nextActionAt?.toISOString(), at2.toISOString());

  // Answering the meeting clears it; closing finishes the contact.
  const answered = await rec(db, "a", op(c.id, "meeting_done", day(9), { happened: "yes", rating: "good", note: "Wants a thank-you" }));
  assert.equal(answered.contact.nextActionAt, null);
  assert.equal(answered.contact.status, "meeting");
  const fin = await rec(db, "a", op(c.id, "goal_reached", day(9)));
  assert.equal(fin.contact.status, "outcome");
  assert.equal(fin.contact.outcome, "positive");
  assert.equal(fin.contact.goalReachedAt?.toISOString(), day(9).toISOString());
  assert.equal(fin.contact.outcomeAt?.toISOString(), day(9).toISOString());
  assert.equal(fin.contact.nextActionAt, null);
  const closed = await rec(db, "a", op((await addContact(db, "a", input)).id, "closed", day(9)));
  assert.equal(closed.contact.status, "outcome");
  assert.equal(closed.contact.closedAt?.toISOString(), day(9).toISOString());
  assert.equal(closed.contact.outcome, "no_response");
  await pg.close();
});

test("transaction works on a pool (BEGIN/COMMIT/ROLLBACK on one client) and joins when nested", async () => {
  const pg = new PGlite();
  await pg.exec("create table t (v int)");
  const log: string[] = [];
  let released = 0;
  const pool = {
    query: async (t: string, p?: unknown[]) => { log.push(`pool:${t.slice(0, 12)}`); return pg.query(t, p); },
    connect: async () => ({ query: async (t: string, p?: unknown[]) => { log.push(`client:${t.slice(0, 12)}`); return pg.query(t, p); }, release: () => { released++; } }),
  };
  const db = poolDb(pool);
  await transaction(db, async (tx) => { await tx.query("insert into t values (1)"); await transaction(tx, async (inner) => { await inner.query("insert into t values (2)"); }); });
  await assert.rejects(() => transaction(db, async (tx) => { await tx.query("insert into t values (3)"); throw new Error("nope"); }), /nope/);
  assert.deepEqual((await pg.query<{ v: number }>("select v from t order by v")).rows.map((r) => r.v), [1, 2]);
  assert.deepEqual(log.filter((l) => /BEGIN|COMMIT|ROLLBACK/.test(l)), ["client:BEGIN", "client:COMMIT", "client:BEGIN", "client:ROLLBACK"]);
  assert.ok(log.filter((l) => l.startsWith("pool:")).length === 0);
  assert.equal(released, 2);
  await assert.rejects(async () => transaction({ query: async () => ({ rows: [] }) }, async () => 1), /cannot open a transaction/);
  await pg.close();
});

test("transaction on PGlite rolls back when the function throws", async () => {
  const pg = new PGlite();
  await pg.exec("create table t (v int)");
  const db = pgliteDb(pg);
  await assert.rejects(() => transaction(db, async (tx) => { await tx.query("insert into t values (1)"); throw new Error("stop"); }), /stop/);
  assert.equal((await pg.query("select * from t")).rows.length, 0);
  await pg.close();
});
