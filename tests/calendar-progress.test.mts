// Calendar plan U6 (R18, R19, AE4): "7 of 9 done" and the streak.
import { test } from "node:test";
import assert from "node:assert/strict";
import { STREAK_THRESHOLD, isoWeek, progressLine, reachedThreshold, streak, weekFinished, weekProgress, type WeekCount } from "../lib/calendar/progress";

const TODAY = "2026-11-12"; // a Thursday; this week starts 2026-11-09
const W = (monday: string) => monday;
const item = (status: string, superseded = false) => ({ status, superseded });

test("progress counts done over planned, and replaced or dismissed items are not planned", () => {
  assert.deepEqual(weekProgress([item("done"), item("done"), item("draft"), item("scheduled")]), { planned: 4, done: 2 });
  assert.deepEqual(weekProgress([item("done"), item("draft", true), item("done", true)]), { planned: 1, done: 1 });
  assert.deepEqual(weekProgress([]), { planned: 0, done: 0 });
});

test("the threshold is 70 percent, inclusive, and zero planned never reaches it", () => {
  assert.equal(STREAK_THRESHOLD, 0.7);
  assert.equal(reachedThreshold({ planned: 10, done: 7 }), true);
  assert.equal(reachedThreshold({ planned: 10, done: 6 }), false);
  assert.equal(reachedThreshold({ planned: 9, done: 7 }), true);
  assert.equal(reachedThreshold({ planned: 0, done: 0 }), false);
});

test("AE4: 7 of 9 gives a flame; 4 of 9 resets the streak at week end and says keep going during the week", () => {
  const flame = streak({ [W("2026-11-02")]: { planned: 9, done: 7 } }, TODAY);
  assert.equal(flame.weeks.find((w) => w.weekStart === "2026-11-02")?.flame, true);
  assert.equal(flame.weeks.find((w) => w.weekStart === "2026-11-02")?.label, "Week 45: 7 of 9, streak kept");
  assert.equal(flame.streak, 1);
  const low = streak({ [W("2026-10-26")]: { planned: 9, done: 8 }, [W("2026-11-02")]: { planned: 9, done: 4 } }, TODAY);
  assert.equal(low.streak, 0, "the last finished week is below 70%, so the streak is reset");
  assert.equal(low.weeks.find((w) => w.weekStart === "2026-11-02")?.flame, false);
  assert.equal(progressLine({ planned: 9, done: 4 }, false), "4 of 9 — keep going");
  assert.equal(progressLine({ planned: 9, done: 4 }, true), "4 of 9 done", "a finished week is not told to keep going");
  assert.equal(progressLine({ planned: 9, done: 7 }, false), "7 of 9 done");
  assert.equal(progressLine({ planned: 0, done: 0 }, false), "Nothing planned this week");
  assert.ok(!/fail|miss|behind|lazy/i.test(progressLine({ planned: 9, done: 0 }, false)), "never shames");
});

test("the streak counts consecutive flame weeks back from the last finished week", () => {
  const by: Record<string, WeekCount> = { "2026-11-02": { planned: 5, done: 4 }, "2026-10-26": { planned: 5, done: 5 }, "2026-10-19": { planned: 5, done: 1 }, "2026-10-12": { planned: 5, done: 5 } };
  const s = streak(by, TODAY);
  assert.equal(s.streak, 2, "two flames, then a week below 70% stops it");
  assert.deepEqual(s.weeks.map((w) => w.weekStart), ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"], "oldest first, current week last");
});

test("a skipped week with no plan does not reset the streak", () => {
  const s = streak({ "2026-11-02": { planned: 5, done: 5 }, "2026-10-26": { planned: 0, done: 0 }, "2026-10-12": { planned: 5, done: 4 } }, TODAY);
  assert.equal(s.streak, 2, "10-19 has no key and 10-26 has nothing planned: both are skipped, 10-12 still counts");
  assert.ok(!s.weeks.some((w) => w.weekStart === "2026-10-19" || w.weekStart === "2026-10-26"));
});

test("the current week shows progress without a flame until it reaches 70%", () => {
  const behind = streak({ "2026-11-09": { planned: 9, done: 4 } }, TODAY);
  const cur = behind.weeks.at(-1)!;
  assert.equal(cur.current, true);
  assert.equal(cur.flame, false);
  assert.equal(cur.label, "Week 46: 4 of 9 so far");
  assert.equal(behind.currentKept, false);
  const ahead = streak({ "2026-11-09": { planned: 9, done: 7 } }, TODAY);
  assert.equal(ahead.currentKept, true);
  assert.equal(ahead.weeks.at(-1)!.label, "Week 46: 7 of 9, streak kept");
  assert.equal(ahead.streak, 0, "the current week is not a finished week, so it is not in the count yet");
});

test("a new user with no finished week sees the first week and no flame", () => {
  const s = streak({}, TODAY);
  assert.equal(s.first, true);
  assert.equal(s.streak, 0);
  assert.equal(s.weeks.length, 1);
  assert.equal(s.weeks[0].flame, false);
  assert.equal(streak({ "2026-11-09": { planned: 3, done: 3 } }, TODAY).first, true, "only the current week exists");
});

test("only the last 6 finished weeks are shown", () => {
  const by: Record<string, WeekCount> = {};
  for (let i = 1; i <= 10; i++) { const d = new Date(Date.UTC(2026, 10, 9) - i * 7 * 86_400_000).toISOString().slice(0, 10); by[d] = { planned: 4, done: 4 }; }
  const s = streak(by, TODAY);
  assert.equal(s.weeks.length, 7, "6 finished + the current week");
  assert.equal(s.streak, 6, "the streak counts what is shown");
});

test("a week is finished only after its Sunday", () => {
  assert.equal(weekFinished("2026-11-02", "2026-11-08"), false, "Sunday itself is still the week");
  assert.equal(weekFinished("2026-11-02", "2026-11-09"), true);
  assert.equal(weekFinished("2026-11-09", TODAY), false);
});

test("ISO week numbers", () => {
  assert.equal(isoWeek("2026-11-02"), 45);
  assert.equal(isoWeek("2026-11-09"), 46);
  assert.equal(isoWeek("2026-12-28"), 53);
  assert.equal(isoWeek("2027-01-04"), 1);
});
