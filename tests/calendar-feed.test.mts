import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeed, feedProgress, type FeedInput } from "../lib/calendar/feed";
import { PICK_SOMEONE } from "../lib/calendar/sources";
import { planForWeek } from "../lib/plan";
import type { CalendarItem as Step } from "../lib/outreach/calendar";

// 2026-11-09 is a Monday. IST is UTC+5:30, so 10:30 IST is 05:00Z.
const MON = "2026-11-09";
const OK = { plan: "ok", outreach: "ok", posts: "off", comments: "ok" } as const;
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:30`).toISOString();
const step = (id: string, kind: Step["kind"], day: string, hhmm: string, person: string, status: Step["status"] = "due"): Step =>
  ({ id, contactId: `c-${person}`, person, kind, at: at(day, hhmm), status, goal: "job", rule: null });

function input(over: Partial<FeedInput> = {}): FeedInput {
  // 1 post, 2 comments, 3 messages: the standard week.
  const plan = planForWeek(MON);
  return { weeks: [{ plan, why: "The standard week", label: "Find a job" }], steps: [], posted: 0, currentWeek: MON, access: { paid: true }, from: MON, to: "2026-11-15", sources: { ...OK }, ...over };
}
const byDay = <T extends { day: string }>(items: T[], day: string): T[] => items.filter((i) => i.day === day);

test("AE2: Wednesday's message slot shows the follow-up, the other two say pick someone, Thursday's meeting is an extra item", () => {
  const plan = planForWeek(MON);
  const msgDays = plan.items.filter((i) => i.kind === "message").map((i) => i.day);
  assert.equal(msgDays.length, 3);
  const wed = "2026-11-11", thu = "2026-11-12";
  // Make sure one message slot falls on Wednesday for this fixture.
  const withWed = { ...plan, items: plan.items.map((i, n) => (i.kind === "message" && n === plan.items.findIndex((x) => x.kind === "message") ? { ...i, day: wed } : i)) };
  const { items } = buildFeed(input({ weeks: [{ plan: withWed, why: null, label: null }], steps: [step("e1", "follow_up", wed, "10:30", "Priya"), step("e2", "meeting", thu, "15:00", "Priya")] }));
  const msgs = items.filter((i) => i.fills || (i.owner === "plan" && i.kind === "message"));
  const filled = msgs.filter((i) => i.fills);
  assert.equal(filled.length, 1);
  assert.equal(filled[0].title, "Follow-up · Priya");
  assert.equal(filled[0].day, wed);
  assert.equal(msgs.filter((i) => i.title === PICK_SOMEONE).length, 2);
  const meeting = items.find((i) => i.kind === "meeting");
  assert.ok(meeting && !meeting.fills, "a meeting never fills a slot");
  assert.equal(meeting?.day, thu);
});

test("steps beyond the day's slots appear beside them, and a slot filled by a step counts once", () => {
  const plan = planForWeek(MON);
  const d = plan.items.find((i) => i.kind === "message")!.day;
  const steps = [step("a", "message", d, "09:00", "A"), step("b", "check_in", d, "10:00", "B"), step("c", "thank_you", d, "11:00", "C"), step("d", "follow_up", d, "12:00", "D")];
  const { items } = buildFeed(input({ steps }));
  const today = byDay(items, d);
  const outreach = today.filter((i) => i.owner === "outreach");
  assert.equal(outreach.length, 4, "all four steps show");
  const slotsToday = plan.items.filter((i) => i.kind === "message" && i.day === d).length;
  assert.equal(outreach.filter((i) => i.fills).length, slotsToday, "only as many steps as there are slots take a slot");
  assert.equal(today.filter((i) => i.owner === "plan" && i.kind === "message").length, 0, "no empty message slot left on a day that is full");
});

test("two comments marked posted this week mark both comment slots done, in date order; none posted marks none", () => {
  const some = buildFeed(input({ posted: 2 })).items.filter((i) => i.kind === "comment");
  assert.equal(some.length, 2);
  assert.ok(some.every((i) => i.status === "done" && i.statusText === "Posted"));
  const none = buildFeed(input({ posted: 0 })).items.filter((i) => i.kind === "comment");
  assert.ok(none.every((i) => i.status === "draft"));
  const one = buildFeed(input({ posted: 1 })).items.filter((i) => i.kind === "comment").sort((a, b) => a.day.localeCompare(b.day));
  assert.deepEqual(one.map((i) => i.status), ["done", "draft"], "the earlier slot is marked first");
});

test("a comment count never marks another week's slots, and null (Commenter off) marks nothing", () => {
  const next = "2026-11-16";
  const nextPlan = planForWeek(next);
  const feed = buildFeed(input({ weeks: [{ plan: planForWeek(MON), why: null, label: null }, { plan: nextPlan, why: null, label: null }], posted: 2, to: "2026-11-22" }));
  assert.ok(feed.items.filter((i) => i.kind === "comment" && i.day >= next).every((i) => i.status === "draft"));
  assert.ok(buildFeed(input({ posted: null })).items.filter((i) => i.kind === "comment").every((i) => i.status === "draft"));
});

test("a source that failed is reported and contributes nothing; the rest still show", () => {
  const sources = { ...OK, outreach: "unavailable" } as const;
  const feed = buildFeed(input({ steps: null, sources: { ...sources } }));
  assert.equal(feed.sources.outreach, "unavailable");
  assert.ok(feed.items.length > 0, "plan slots still show");
  assert.ok(feed.items.every((i) => i.owner === "plan"));
});

test("a lapsed or free account sees outreach items it cannot move; its plan slots stay movable", () => {
  const { items } = buildFeed(input({ access: { paid: false }, steps: [step("m", "meeting", "2026-11-12", "15:00", "Priya")] }));
  const meeting = items.find((i) => i.kind === "meeting")!;
  assert.equal(meeting.movable, false);
  assert.match(meeting.lockedReason ?? "", /subscription/i);
  assert.ok(items.filter((i) => i.owner === "plan" && i.status !== "done").every((i) => i.movable));
});

test("a replaced step is shown as replaced, not moveable, and not counted as planned", () => {
  const { items } = buildFeed(input({ steps: [step("old", "meeting", "2026-11-11", "15:00", "Priya", "superseded"), step("new", "meeting", "2026-11-12", "15:00", "Priya")] }));
  const old = items.find((i) => i.id === "outreach:old")!;
  assert.equal(old.status, "replaced");
  assert.equal(old.movable, false);
  const p = feedProgress(items, MON);
  const noOld = feedProgress(items.filter((i) => i.id !== "outreach:old"), MON);
  assert.deepEqual(p, noOld, "the replaced step changes nothing");
});

test("a published, a posted and a sent step each count as done; a message slot filled by a step counts once", () => {
  const plan = planForWeek(MON);
  const d = plan.items.find((i) => i.kind === "message")!.day;
  const { items } = buildFeed(input({ steps: [step("s", "message", d, "10:30", "A", "done")], posted: 1 }));
  const p = feedProgress(items, MON);
  assert.equal(p.planned, 6, "1 post + 2 comments + 3 messages, the filled slot counted once");
  assert.equal(p.done, 2, "one comment posted, one message sent");
});

test("the window is applied by day, inclusive", () => {
  const feed = buildFeed(input({ from: "2026-11-10", to: "2026-11-10" }));
  assert.ok(feed.items.length > 0 && feed.items.every((i) => i.day === "2026-11-10"));
});

test("outreach steps in a week with no plan still show", () => {
  const { items } = buildFeed(input({ weeks: [], steps: [step("x", "follow_up", "2026-11-12", "10:30", "Priya")] }));
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Follow-up · Priya");
});
