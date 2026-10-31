import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { addBusinessDays, afterMeeting, nextAction, ratesByGoal, replySummary, suggest, TIMINGS } from "../lib/outreach/followup";
import { allowsReferralAsk, recordMeetsGoal } from "../lib/outreach/goals";
import { addContact, getContact } from "../lib/outreach/contacts-db";
import { listEvents, recordEvent, type InsertOp, type TimelineEvent, type TimelineOp } from "../lib/outreach/timeline";
import { pgliteDb, type Db } from "../lib/db";

const at = (day: string) => new Date(`${day}T12:00:00+05:30`);
test("3B7 uses IST business days and stops after reply or follow-up", () => {
  const contact = { status: "messaged", messagedAt: "2026-11-02T10:00:00+05:30" };
  assert.equal(addBusinessDays("2026-11-02", 3), "2026-11-05");
  assert.deepEqual(nextAction(contact, at("2026-11-05")), { kind: "second_person", day: "2026-11-05" });
  assert.deepEqual(nextAction(contact, at("2026-11-11")), { kind: "follow_up", day: "2026-11-11" });
  assert.equal(nextAction({ ...contact, repliedAt: "2026-11-04T12:00:00+05:30" }, at("2026-11-11")), null);
  assert.equal(nextAction({ ...contact, followUpSent: true }, at("2026-11-12")), null);
  assert.equal(addBusinessDays("2026-11-06", 3), "2026-11-11");
});
test("old unanswered invitations and honest rates", () => {
  assert.deepEqual(nextAction({ status: "invited", invitedAt: "2026-11-02T10:00:00+05:30" }, at("2026-11-23")), { kind: "withdraw", day: "2026-11-23" });
  assert.equal(replySummary(3, 4), "3 of 4");
  assert.equal(replySummary(3, 5), "3 of 5 (60%)");
});

// ---- U15: next-step rules through the real write path (PGlite + recordEvent) ----

const sql = (name: string) => readFileSync(new URL(`../scripts/migrations/${name}`, import.meta.url), "utf8");
async function fresh() {
  const pg = new PGlite();
  await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
  for (const f of ["001_vertical1.sql", "002_outreach.sql", "005_outreach_timeline.sql"]) await pg.exec(sql(f));
  return { pg, db: pgliteDb(pg) };
}
const base = { name: "Priya", bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1" } as const;
const D = (d: number, h = 5, m = 0) => new Date(Date.UTC(2026, 10, d, h, m)); // 5:00Z is 10:30 IST on that day in November 2026
let n = 0;
const ins = (contactId: string, kind: InsertOp["kind"], doneAt: Date, extra: Partial<InsertOp> = {}): InsertOp => ({ type: "insert", opId: `u15-${++n}`, contactId, kind, doneAt, ...extra });
const rec = (db: Db, o: TimelineOp, now: Date) => recordEvent(db, "a", o, { now });
const due = (events: TimelineEvent[], kind: string) => events.filter((e) => e.kind === kind && e.status === "due");
const iso = (d: Date | null) => d?.toISOString();

test("AE9: a message sent Mon 2 Nov asks 'Did Priya reply?' on Thu 5 Nov, the follow-up question on Wed 11 Nov, the close question on Fri 20 Nov, and nothing closes without a tap", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const sent = await rec(db, ins(c.id, "message_sent", D(2)), D(2));
  const second = due(sent.events, "second_person")[0];
  const follow = due(sent.events, "follow_up")[0];
  assert.equal(iso(second.dueAt), D(5).toISOString()); // Thursday 5 Nov, 10:30 IST
  assert.equal(iso(follow.dueAt), D(11).toISOString()); // Wednesday 11 Nov
  assert.match(second.rule!, /No reply recorded from Priya in 3 business days\. Did Priya reply\?/);
  assert.match(second.rule!, /second person/);
  assert.match(follow.rule!, /No reply recorded from Priya in 7 business days\. Did Priya reply\?/);
  assert.equal(second.triggerId, sent.event.id);
  assert.equal(iso(sent.contact.nextActionAt), D(5).toISOString());
  assert.equal(due(sent.events, "closed").length, 0);

  // The follow-up goes out on 11 Nov: the close question comes 7 business days later, Fri 20 Nov.
  const fu = await rec(db, { type: "update", eventId: follow.id, patch: { done: true, doneAt: D(11) } }, D(11));
  const close = due(fu.events, "closed")[0];
  assert.equal(iso(close.dueAt), D(20).toISOString());
  assert.match(close.rule!, /Did Priya reply\?.*Close: no response/);
  assert.equal(close.triggerId, follow.id);

  // Nothing closes without a tap: even long after the due date the contact is not closed.
  const later = await rec(db, ins(c.id, "why", D(21), { note: "x" }), D(21));
  assert.equal(later.contact.closedAt, null);
  assert.equal(later.contact.outcome, null);
  assert.equal(later.contact.status, "messaged");
  assert.equal(due(later.events, "closed").length, 1);

  // The tap: Close finishes the contact and withdraws what was still due.
  const tapped = await rec(db, ins(c.id, "closed", D(22)), D(22));
  assert.equal(tapped.contact.outcome, "no_response");
  assert.equal(tapped.events.filter((e) => e.status === "due").length, 0);
  await pg.close();
});

test("the same events through recordEvent give the dates the old nextAction rule gives (AE6)", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const r = await rec(db, ins(c.id, "message_sent", new Date("2026-11-02T10:00:00+05:30")), D(2));
  const days = (kind: string) => new Date(due(r.events, kind)[0].dueAt!.getTime() + 330 * 60_000).toISOString().slice(0, 10);
  assert.equal(days("second_person"), nextAction({ status: "messaged", messagedAt: "2026-11-02T10:00:00+05:30" }, at("2026-11-05"))!.day);
  assert.equal(days("follow_up"), nextAction({ status: "messaged", messagedAt: "2026-11-02T10:00:00+05:30" }, at("2026-11-11"))!.day);
  await pg.close();
});

test("rerunning suggest over the stored events gives nothing, and recording the same op twice adds nothing", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const op = ins(c.id, "message_sent", D(2));
  const first = await rec(db, op, D(2));
  assert.equal(first.events.length, 3);
  assert.deepEqual(suggest((await getContact(db, "a", c.id))!, await listEvents(db, "a", c.id), D(3)), []);
  await rec(db, ins(c.id, "why", D(3)), D(3));
  assert.equal((await listEvents(db, "a", c.id)).length, 4);
  assert.equal((await rec(db, op, D(4))).replayed, true);
  assert.equal((await listEvents(db, "a", c.id)).length, 4);
  await pg.close();
});

test("a reply recorded on 4 Nov supersedes the pending suggestions with reason reply", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  await rec(db, ins(c.id, "message_sent", D(2)), D(2));
  const r = await rec(db, ins(c.id, "reply", D(4)), D(4));
  const sup = r.events.filter((e) => e.status === "superseded");
  assert.deepEqual(sup.map((e) => e.kind).sort(), ["follow_up", "second_person"]);
  assert.ok(sup.every((e) => e.supersededReason === "reply"));
  assert.equal(r.contact.nextActionAt, null);
  assert.equal(r.contact.status, "replied");
  await pg.close();
});

test("a reply also supersedes a pending close question and a pending withdraw", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const sent = await rec(db, ins(c.id, "message_sent", D(2)), D(2));
  const fu = await rec(db, { type: "update", eventId: due(sent.events, "follow_up")[0].id, patch: { done: true, doneAt: D(11) } }, D(11));
  assert.equal(due(fu.events, "closed").length, 1);
  const r = await rec(db, ins(c.id, "reply", D(12)), D(12));
  assert.equal(r.events.filter((e) => e.status === "due").length, 0);
  assert.equal(r.events.find((e) => e.kind === "closed")!.supersededReason, "reply");
  assert.ok(r.events.filter((e) => e.status === "superseded").every((e) => e.supersededReason === "reply"));

  const other = await addContact(db, "a", base);
  const inv = await rec(db, ins(other.id, "invite_sent", D(1)), D(1));
  assert.equal(due(inv.events, "withdraw").length, 1);
  const replied = await rec(db, ins(other.id, "reply", D(12)), D(12));
  assert.equal(replied.events.find((e) => e.kind === "withdraw")!.supersededReason, "reply");
  await pg.close();
});

test("accepted on day 10 supersedes the 21-day withdraw question", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const inv = await rec(db, ins(c.id, "invite_sent", D(1)), D(1));
  const w = due(inv.events, "withdraw")[0];
  assert.equal(iso(w.dueAt), new Date(Date.UTC(2026, 10, 22, 5, 0)).toISOString()); // 21 days after 1 Nov
  assert.match(w.rule!, /Accepted\?/);
  assert.match(w.rule!, /withdraw/);
  const acc = await rec(db, ins(c.id, "accepted", D(10)), D(10));
  const after = acc.events.find((e) => e.id === w.id)!;
  assert.equal(after.status, "superseded");
  assert.equal(after.supersededReason, "finished");
  assert.equal(acc.contact.nextActionAt, null);
  await pg.close();
});

test("undoing message_sent supersedes the suggestions it triggered, and recording it again suggests anew", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const sent = await rec(db, ins(c.id, "message_sent", D(2)), D(2));
  const undone = await rec(db, { type: "supersede", eventId: sent.event.id, reason: "undone" }, D(3));
  const rest = undone.events.filter((e) => e.kind !== "message_sent");
  assert.equal(rest.length, 2);
  assert.ok(rest.every((e) => e.status === "superseded" && e.supersededReason === "undone"));
  assert.equal(undone.contact.status, "to_contact");
  assert.equal(undone.contact.nextActionAt, null);
  const again = await rec(db, ins(c.id, "message_sent", D(3)), D(3));
  assert.equal(due(again.events, "second_person").length, 1);
  assert.equal(iso(due(again.events, "second_person")[0].dueAt), D(6).toISOString());
  await pg.close();
});

test("'Not now' on a second-person step means it isn't suggested again", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const sent = await rec(db, ins(c.id, "message_sent", D(2)), D(2));
  const second = due(sent.events, "second_person")[0];
  const dismissed = await rec(db, { type: "supersede", eventId: second.id, reason: "dismissed" }, D(5));
  assert.equal(due(dismissed.events, "second_person").length, 0);
  // Later records re-run the rules: the dismissed rule stays dismissed, the follow-up is untouched.
  const next = await rec(db, ins(c.id, "why", D(6)), D(6));
  assert.equal(next.events.filter((e) => e.kind === "second_person").length, 1);
  assert.equal(next.events.find((e) => e.id === second.id)!.supersededReason, "dismissed");
  assert.equal(due(next.events, "follow_up").length, 1);
  await pg.close();
});

test("changing a step's date keeps one live step and does not bring the original back", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const sent = await rec(db, ins(c.id, "message_sent", D(2)), D(2));
  const second = due(sent.events, "second_person")[0];
  const moved = await rec(db, ins(c.id, "second_person", D(2), { status: "due", dueAt: D(9), triggerId: sent.event.id, rule: second.rule!, supersedes: { id: second.id, reason: "moved" } }), D(4));
  assert.equal(due(moved.events, "second_person").length, 1);
  assert.equal(iso(due(moved.events, "second_person")[0].dueAt), D(9).toISOString());
  assert.equal(moved.events.filter((e) => e.kind === "second_person").length, 2);
  await pg.close();
});

test("a second message replaces the first message's pending steps", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  await rec(db, ins(c.id, "message_sent", D(2)), D(2));
  const r = await rec(db, ins(c.id, "message_sent", D(4)), D(4));
  assert.equal(due(r.events, "second_person").length, 1);
  assert.equal(iso(due(r.events, "second_person")[0].dueAt), D(9).toISOString()); // 3 business days after Wed 4 Nov
  assert.equal(due(r.events, "follow_up").length, 1);
  await pg.close();
});

test("AE12: a network contact rated good has no referral-ask step and Goal reached is pre-ticked; a job contact gets the referral-ask choice", async () => {
  const net = afterMeeting("network", { happened: "yes", rating: "good", at: D(12) });
  assert.equal(net.goalReachedPreticked, true);
  assert.ok(!net.steps.some((s) => s.choice === "referral_ask"));
  const job = afterMeeting("job", { happened: "yes", rating: "good", at: D(12) });
  assert.equal(job.goalReachedPreticked, false);
  assert.ok(job.steps.some((s) => s.choice === "referral_ask" && s.kind === "referral_ask"));
  assert.ok(afterMeeting("referral", { happened: "yes", rating: "good", at: D(12) }).steps.some((s) => s.choice === "referral_ask"));
  for (const g of ["network", "clients", "hiring", "funding", "buy_business", "partner", "mentor", "reconnect"]) {
    assert.ok(!afterMeeting(g, { happened: "yes", rating: "good", at: D(12) }).steps.some((s) => s.choice === "referral_ask"), g);
  }
  assert.equal(allowsReferralAsk("job"), true);
  assert.equal(allowsReferralAsk("network"), false);

  // Through the write path: the thank-you lands the next business day.
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", { ...base, goal: "network" });
  const booked = await rec(db, ins(c.id, "meeting_booked", D(5), { meetingAt: D(12, 12, 30) }), D(5));
  const done = await rec(db, ins(c.id, "meeting_done", D(12, 15, 30), { happened: "yes", rating: "good" }), D(12, 15, 30));
  const thanks = due(done.events, "thank_you")[0];
  assert.equal(iso(thanks.dueAt), D(13).toISOString());
  assert.equal(thanks.triggerId, done.event.id);
  assert.equal(booked.event.kind, "meeting_booked");
  await pg.close();
});

test("AE8 dates: Useful meeting on 12 Nov gives thank-you 13 Nov, act-on-it 19 Nov, check-in 4 weeks, and Goal reached is not ticked for a job contact", () => {
  const r = afterMeeting("job", { happened: "yes", rating: "good", at: D(12, 15, 30) });
  const by = Object.fromEntries(r.steps.map((s) => [s.choice, s]));
  assert.equal(iso(by.thank_you.dueAt), D(13).toISOString());
  assert.equal(by.thank_you.recommended, true);
  assert.equal(iso(by.act_on_it.dueAt), D(19).toISOString());
  assert.equal(by.act_on_it.kind, "follow_up");
  assert.equal(iso(by.check_in.dueAt), new Date(Date.UTC(2026, 11, 10, 5, 0)).toISOString()); // 4 weeks on: 10 Dec
  assert.equal(r.goalReachedPreticked, false);
  assert.equal(r.steps.filter((s) => s.recommended).length, 1);
});

test("a meeting with no rating uses the OK row, and a Not useful meeting offers only thank-you and close", async () => {
  const none = afterMeeting("job", { happened: "yes", rating: null, at: D(12) });
  const ok = afterMeeting("job", { happened: "yes", rating: "neutral", at: D(12) });
  assert.deepEqual(none, ok);
  assert.deepEqual(ok.steps.map((s) => s.choice), ["thank_you", "check_in", "close"]);
  assert.equal(iso(ok.steps[1].dueAt), new Date(Date.UTC(2026, 11, 24, 5, 0)).toISOString()); // 6 weeks on: 24 Dec
  assert.equal(ok.goalReachedPreticked, false);
  assert.deepEqual(afterMeeting("job", { happened: "yes", rating: "bad", at: D(12) }).steps.map((s) => s.choice), ["thank_you", "close"]);
  assert.equal(ok.steps[2].dueAt, null); // Close is a record taken at once, not a dated step

  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const r = await rec(db, ins(c.id, "meeting_done", D(12), { happened: "yes" }), D(12));
  assert.equal(iso(due(r.events, "thank_you")[0].dueAt), D(13).toISOString());
  await pg.close();
});

test("a Friday no-show suggests a reschedule message on Monday and offers Close", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const r = await rec(db, ins(c.id, "meeting_done", D(6), { happened: "no_show" }), D(6)); // Fri 6 Nov
  const resched = due(r.events, "reschedule")[0];
  assert.equal(iso(resched.dueAt), D(9).toISOString()); // Mon 9 Nov
  assert.equal(due(r.events, "thank_you").length, 0);
  assert.match(resched.rule!, /no-show/i);
  const after = afterMeeting("job", { happened: "no_show", rating: null, at: D(6) });
  assert.deepEqual(after.steps.map((s) => s.choice), ["reschedule", "close"]);
  assert.equal(iso(after.steps[0].dueAt), D(9).toISOString());
  assert.deepEqual(afterMeeting("job", { happened: "moved", rating: null, at: D(6) }), { steps: [], goalReachedPreticked: false });
  await pg.close();
});

test("undoing the meeting answer withdraws the thank-you it suggested", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  const r = await rec(db, ins(c.id, "meeting_done", D(12), { happened: "yes", rating: "good" }), D(12));
  const u = await rec(db, { type: "supersede", eventId: r.event.id, reason: "undone" }, D(12));
  assert.equal(due(u.events, "thank_you").length, 0);
  assert.equal(u.events.find((e) => e.kind === "thank_you")!.supersededReason, "undone");
  await pg.close();
});

test("Goal reached supersedes every due event", async () => {
  const { pg, db } = await fresh();
  const c = await addContact(db, "a", base);
  await rec(db, ins(c.id, "message_sent", D(2)), D(2));
  await rec(db, ins(c.id, "meeting_done", D(6), { happened: "yes", rating: "good" }), D(6));
  const r = await rec(db, ins(c.id, "goal_reached", D(6)), D(6));
  assert.equal(r.events.filter((e) => e.status === "due").length, 0);
  const sup = r.events.filter((e) => e.status === "superseded");
  assert.equal(sup.length, 3);
  assert.ok(sup.every((e) => e.supersededReason === "finished"));
  assert.equal(r.contact.nextActionAt, null);
  assert.equal(r.contact.outcome, "positive");
  await pg.close();
});

test("R40 success mapping: Reply meets reconnect; a Useful meeting meets the conversation goals only", () => {
  assert.equal(recordMeetsGoal("reconnect", { kind: "reply" }), true);
  assert.equal(recordMeetsGoal("network", { kind: "reply" }), false);
  for (const g of ["network", "clients", "hiring", "funding", "buy_business", "partner"]) {
    assert.equal(recordMeetsGoal(g, { kind: "meeting_done", happened: "yes", rating: "good" }), true, g);
    assert.equal(recordMeetsGoal(g, { kind: "meeting_done", happened: "yes", rating: "neutral" }), false, g);
    assert.equal(recordMeetsGoal(g, { kind: "meeting_done", happened: "no_show", rating: "good" }), false, g);
  }
  for (const g of ["job", "referral", "mentor", "reconnect"]) assert.equal(recordMeetsGoal(g, { kind: "meeting_done", happened: "yes", rating: "good" }), false, g);
});

test("timings are the D-O2 defaults", () => {
  assert.deepEqual({ ...TIMINGS }, {
    secondPersonBusinessDays: 3, followUpBusinessDays: 7, closeBusinessDays: 7, withdrawDays: 21,
    thankYouBusinessDays: 1, rescheduleBusinessDays: 1, actOnItDays: 7, checkInUsefulDays: 28, checkInOkDays: 42, referralAskDays: 7,
  });
});

test("rates by goal show meetings and goal reached with counts, and 'n of m' below 5", async () => {
  const { pg, db } = await fresh();
  const mk = async (goal: "job" | "network", steps: Array<[InsertOp["kind"], number, Partial<InsertOp>?]>) => {
    const c = await addContact(db, "a", { ...base, goal });
    let last = await getContact(db, "a", c.id);
    for (const [kind, d, extra] of steps) last = (await rec(db, ins(c.id, kind, D(d), extra ?? {}), D(d))).contact;
    return { contact: (await getContact(db, "a", c.id))!, events: await listEvents(db, "a", c.id), _: last };
  };
  const rows = [
    await mk("job", [["message_sent", 2], ["reply", 3], ["meeting_done", 5, { happened: "yes", rating: "good" }]]),
    await mk("job", [["message_sent", 2]]),
    await mk("job", [["message_sent", 2], ["reply", 4]]),
    await mk("network", [["message_sent", 2], ["reply", 3], ["meeting_done", 5, { happened: "yes", rating: "good" }], ["goal_reached", 5]]),
    await mk("network", [["invite_sent", 2]]),
  ];
  const rates = Object.fromEntries(ratesByGoal(rows).map((r) => [r.goal, r]));
  assert.deepEqual({ ...rates.job }, { goal: "job", contacted: 3, replied: 2, meetings: 1, goalReached: 0, reply: "2 of 3", meeting: "1 of 3", goalReachedRate: "0 of 3" });
  assert.deepEqual({ ...rates.network }, { goal: "network", contacted: 1, replied: 1, meetings: 1, goalReached: 1, reply: "1 of 1", meeting: "1 of 1", goalReachedRate: "1 of 1" });
  assert.ok(!/%/.test(rates.job.reply + rates.job.meeting + rates.job.goalReachedRate));

  // At five or more, the percentage is added.
  const five = Array.from({ length: 5 }, (_, i) => ({ contact: { goal: "job", messagedAt: D(2), repliedAt: i < 2 ? D(3) : null, goalReachedAt: null }, events: [] as TimelineEvent[] }));
  assert.equal(ratesByGoal(five)[0].reply, "2 of 5 (40%)");
  assert.equal(ratesByGoal(five)[0].meeting, "0 of 5 (0%)");
  await pg.close();
});
