// Unit tests for the weekly plan (acceptance tests P1–P9 in research/acceptance-tests.md).
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_COUNTS,
  DEFAULT_TIMES,
  addFollowUp,
  followUpDue,
  newPlan,
  parsePlanChat,
  planWeekStart,
  setStatus,
  withCounts,
} from "../lib/plan";
import { buildIcs, googleCalendarUrl } from "../lib/ics";
import { addDays, weekdayIndex } from "../lib/ist";

const FRI = "2026-10-16"; // a Friday

test("P1 default plan: 3 messages, 2 comments, 1 post on Mon–Fri of the plan week", () => {
  const p = newPlan(FRI);
  const count = (k: string) => p.items.filter((i) => i.kind === k).length;
  assert.equal(count("message"), 3);
  assert.equal(count("comment"), 2);
  assert.equal(count("post"), 1);
  for (const it of p.items) {
    assert.ok(weekdayIndex(it.day) <= 4, `${it.id} on a weekend`);
    assert.ok(it.day >= p.weekStart && it.day <= addDays(p.weekStart, 4), `${it.id} outside the week`);
    assert.equal(it.status, "draft");
  }
});

test("P2 which week: Mon–Wed this week, Thu–Sun next week", () => {
  assert.equal(planWeekStart("2026-10-12"), "2026-10-12"); // Mon
  assert.equal(planWeekStart("2026-10-14"), "2026-10-12"); // Wed
  assert.equal(planWeekStart("2026-10-15"), "2026-10-19"); // Thu
  assert.equal(planWeekStart(FRI), "2026-10-19");
  assert.equal(planWeekStart("2026-10-18"), "2026-10-19"); // Sun
});

test("P3 tags and draft links", () => {
  const p = withCounts(newPlan(FRI), { posts: 3, comments: 2, messages: 3 });
  const posts = p.items.filter((i) => i.kind === "post").sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(posts.map((i) => i.tag), ["proof", "setback", "observation"]);
  assert.deepEqual(posts.map((i) => i.draftId), ["post:0", "post:1", "post:2"]);
  const msgs = p.items.filter((i) => i.kind === "message").sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(msgs.map((i) => i.draftId), ["out:referral", "out:hm", "out:referral"]);
  assert.ok(msgs.every((i) => i.tag === "outreach"));
});

test("P4 changing counts keeps the status of surviving items", () => {
  let p = newPlan(FRI);
  p = setStatus(p, "message-0", "scheduled");
  p = withCounts(p, { ...p.counts, posts: 2 });
  assert.equal(p.items.find((i) => i.id === "message-0")?.status, "scheduled");
  assert.equal(p.items.filter((i) => i.kind === "post").length, 2);
});

test("P5 chat parser", () => {
  const c = DEFAULT_COUNTS;
  const t = DEFAULT_TIMES;
  assert.equal(parsePlanChat("2 posts", c, t).counts.posts, 2);
  assert.equal(parsePlanChat("no comments please", c, t).counts.comments, 0);
  assert.equal(parsePlanChat("more outreach", c, t).counts.messages, 4);
  assert.equal(parsePlanChat("2 more posts", c, t).counts.posts, 3);
  assert.equal(parsePlanChat("fewer posts", c, t).counts.posts, 0);
  assert.equal(parsePlanChat("posts at 8am", c, t).times.post, "08:00");
  assert.equal(parsePlanChat("comments at 1:30 pm", c, t).times.comment, "13:30");
  const both = parsePlanChat("2 posts, no comments", c, t);
  assert.deepEqual(both.counts, { posts: 2, comments: 0, messages: 3 });
  const nope = parsePlanChat("make it better", c, t);
  assert.equal(nope.understood, false);
  assert.deepEqual(nope.counts, c);
});

test("P6 bounds", () => {
  const c = DEFAULT_COUNTS;
  const t = DEFAULT_TIMES;
  const big = parsePlanChat("20 posts", c, t);
  assert.equal(big.counts.posts, 5);
  assert.match(big.reply, /Capped/);
  assert.equal(parsePlanChat("-3 messages", c, t).counts.messages, 0);
  assert.equal(parsePlanChat("no messages", c, t).counts.messages, 0);
});

test("P7 follow-up due after 5 days without a reply", () => {
  const sent = new Date("2026-10-19T05:00:00Z");
  let p = setStatus(newPlan(FRI), "message-0", "done", sent);
  const msg = () => p.items.find((i) => i.id === "message-0")!;
  assert.equal(followUpDue(msg(), new Date("2026-10-23T05:00:00Z")), false); // 4 days
  assert.equal(followUpDue(msg(), new Date("2026-10-24T05:00:00Z")), true); // 5 days
  p = { ...p, items: p.items.map((i) => (i.id === "message-0" ? { ...i, replied: true } : i)) };
  assert.equal(followUpDue(msg(), new Date("2026-10-25T05:00:00Z")), false);
  const withFollow = addFollowUp(p, "message-0", "2026-10-24");
  assert.equal(withFollow.items.filter((i) => i.kind === "follow_up").length, 1);
  assert.equal(addFollowUp(withFollow, "message-0").items.filter((i) => i.kind === "follow_up").length, 1);
});

test("P8 .ics is valid and in UTC", () => {
  const ics = buildIcs(
    [{ uid: "post-0", title: "Post: proof, of work; now", description: "Line one\nLine two, with a comma; and semicolon " + "x".repeat(120), day: "2026-10-19", time: "09:00" }],
    new Date("2026-10-16T00:00:00Z"),
  );
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1);
  assert.match(ics, /DTSTART:20261019T033000Z/);
  assert.match(ics, /DTEND:20261019T034500Z/);
  assert.match(ics, /SUMMARY:Post: proof\\, of work\\; now/);
  assert.match(ics, /Line one\\nLine two\\, with a comma\\; and/);
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, `long line: ${line}`);
});

test("P9 Google Calendar link", () => {
  const url = new URL(googleCalendarUrl({ uid: "x", title: "Send outreach", description: "hi", day: "2026-10-19", time: "09:00" }));
  assert.equal(url.searchParams.get("dates"), "20261019T033000Z/20261019T034500Z");
  assert.equal(url.searchParams.get("text"), "Send outreach");
});

// ---- U20: Today, the Monday to-do and the weekly plan under outreach v2 ----
import { calendarItems, mondayTodo, type CalendarRow } from "../lib/outreach/calendar";
import { ALL_CAUGHT_UP, answersFor, bodyFor, dueNow, isMonday, offerPlanFollowUp, opId, withoutAnswered } from "../lib/outreach/ui-today";
import type { PlanItem } from "../lib/plan";

const MON = new Date("2026-11-02T05:00:00Z"); // Monday 10:30 IST
const TUE = new Date("2026-11-03T05:00:00Z");
const row = (o: Partial<CalendarRow> & Pick<CalendarRow, "id" | "kind">): CalendarRow => ({
  contactId: "c1", person: "Priya", goal: "job", status: "due", dueAt: null, doneAt: null, meetingAt: null, rule: null, ...o,
});
// AE11: a Thursday meeting with no answer, and an invite 22 days old with no record.
const meeting = row({ id: "m1", kind: "meeting_booked", status: "done", doneAt: new Date("2026-10-27T05:00:00Z"), meetingAt: new Date("2026-10-29T12:30:00Z") });
const withdraw = row({ id: "w1", contactId: "c2", person: "Arjun", kind: "withdraw", dueAt: new Date("2026-11-01T05:00:00Z"), rule: "Accepted? If not, withdraw the invite." });

test("U20 v2 off: WeekPlan offers the follow-up; v2 on: it does not (CO-2)", () => {
  const sent: PlanItem = { id: "message-0", kind: "message", tag: "outreach", draftId: "out:referral", day: "2026-10-19", time: "10:30", status: "done", doneAt: "2026-10-19T05:00:00Z" };
  const due = followUpDue(sent, new Date("2026-10-27T05:00:00Z"));
  assert.equal(due, true);
  assert.equal(offerPlanFollowUp(false, due, false), true);
  assert.equal(offerPlanFollowUp(undefined, due, false), true);
  assert.equal(offerPlanFollowUp(true, due, false), false);
  assert.equal(offerPlanFollowUp(false, due, true), false); // already added: unchanged v1 rule
});

test("U20 Monday with two open items: the to-do lists the meeting first", () => {
  assert.equal(isMonday(MON), true);
  assert.equal(isMonday(TUE), false);
  const todo = mondayTodo([meeting, withdraw], MON);
  assert.deepEqual(todo.items.map((i) => i.id), ["m1", "w1"]);
  assert.deepEqual(todo.items.map((i) => i.group), ["meeting", "question"]);
});

test("U20 Tuesday: an overdue item still shows in the Today list, a future one does not", () => {
  const later = row({ id: "t1", kind: "thank_you", dueAt: new Date("2026-11-06T05:00:00Z") });
  const list = dueNow(calendarItems([withdraw, later]), TUE);
  assert.deepEqual(list.map((i) => i.id), ["w1"]);
});

test("U20 a meeting later today stays out; one an hour past is owed", () => {
  const soon = row({ id: "m2", kind: "meeting_booked", status: "done", doneAt: new Date("2026-11-01T05:00:00Z"), meetingAt: new Date("2026-11-03T12:30:00Z") });
  assert.deepEqual(dueNow(calendarItems([soon]), TUE), []);
  assert.deepEqual(dueNow(calendarItems([meeting]), TUE).map((i) => i.id), ["m1"]);
});

test("U20 an answered item disappears without a reload; an empty list says so", () => {
  const items = mondayTodo([meeting, withdraw], MON).items;
  const left = withoutAnswered(items, new Set(["m1"]));
  assert.deepEqual(left.map((i) => i.id), ["w1"]);
  assert.equal(withoutAnswered(left, new Set(["m1", "w1"])).length, 0);
  assert.equal(mondayTodo([], MON).message, "All caught up this week");
  assert.equal(ALL_CAUGHT_UP, "All caught up this week");
});

test("U20 answers record through the timeline with a stable op_id, so a retry never duplicates", () => {
  const w = { id: "w1", kind: "withdraw" as const, contactId: "c2" };
  const yes = bodyFor(w, "yes");
  assert.deepEqual(yes, { type: "insert", op_id: "today:w1:yes", contactId: "c2", kind: "accepted" });
  assert.deepEqual(bodyFor(w, "yes"), yes); // same tap, same op_id
  assert.equal(opId("w1", "yes"), opId("w1", "yes"));
  assert.equal(bodyFor(w, "no"), null); // "Not yet" only reveals the step
  assert.deepEqual(answersFor(w).map((a) => a.id), ["yes", "no"]);
  assert.deepEqual(answersFor(w, true).map((a) => a.id), ["done", "not_now"]);
  assert.equal((bodyFor({ id: "f1", kind: "follow_up", contactId: "c1" }, "yes") as { kind?: string } | null)?.kind, "reply");
  assert.equal((bodyFor({ id: "f1", kind: "follow_up", contactId: "c1" }, "done") as { kind?: string } | null)?.kind, "follow_up");
  assert.deepEqual(bodyFor({ id: "t1", kind: "thank_you", contactId: "c1" }, "not_now"), { type: "supersede", eventId: "t1", reason: "dismissed" });
  assert.deepEqual(bodyFor({ id: "m1", kind: "meeting", contactId: "c1" }, "met_good"),
    { type: "insert", op_id: "today:m1:met_good", contactId: "c1", kind: "meeting_done", triggerId: "m1", happened: "yes", rating: "good" });
  assert.equal((bodyFor({ id: "m1", kind: "meeting", contactId: "c1" }, "no_show") as { kind?: string } | null)?.kind, "meeting_done");
});
