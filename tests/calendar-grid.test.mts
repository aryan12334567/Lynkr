import { test } from "node:test";
import assert from "node:assert/strict";
import { MONTH_CHIPS, chipStatus, chipSummary, dateProblem, daysWithItems, dropAllowed, groupByDay, monthCells, monthSlice, weekDays } from "../lib/calendar/grid";
import type { FeedItem } from "../lib/calendar/types";

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: "plan:2026-11-09:post-0", owner: "plan", kind: "post", day: "2026-11-10", time: "09:00", status: "draft", statusText: "Draft",
  title: "Proof of work", label: "Job seeker", why: null, href: "#app/posts", movable: true, gated: true, ...over,
});

test("a week is Monday to Sunday and a month grid is six Monday-first weeks", () => {
  assert.deepEqual(weekDays("2026-11-09"), ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
  const { first, days } = monthCells("2026-11-18");
  assert.equal(first, "2026-11-01");
  assert.equal(days.length, 42);
  assert.equal(days[0], "2026-10-26", "1 Nov 2026 is a Sunday, so the grid starts on Monday 26 Oct");
  assert.equal(new Date(`${days[0]}T00:00:00Z`).getUTCDay(), 1);
});

test("a month cell with 7 items shows 3 chips and +4 more", () => {
  const list = Array.from({ length: 7 }, (_, i) => item({ id: `x${i}` }));
  const { shown, more } = monthSlice(list);
  assert.equal(shown.length, MONTH_CHIPS);
  assert.equal(more, 4);
  assert.deepEqual(monthSlice(list.slice(0, 2)), { shown: list.slice(0, 2), more: 0 });
});

test("items group by day in time order", () => {
  const g = groupByDay([item({ id: "b", time: "12:30" }), item({ id: "a", time: "09:00" }), item({ id: "c", day: "2026-11-11" })]);
  assert.deepEqual(g.get("2026-11-10")?.map((i) => i.id), ["a", "b"]);
  assert.equal(g.get("2026-11-11")?.length, 1);
});

test("drops: a past day, the same day, and an item that cannot move are all refused", () => {
  const today = "2026-11-10";
  assert.equal(dropAllowed(item(), "2026-11-11", today), true);
  assert.equal(dropAllowed(item(), "2026-11-09", today), false, "past");
  assert.equal(dropAllowed(item(), "2026-11-10", today), false, "same day");
  assert.equal(dropAllowed(item({ movable: false }), "2026-11-12", today), false);
  assert.equal(dropAllowed(item({ day: "2026-11-13" }), "2026-11-10", today), true, "today is allowed");
});

test("Change date rejects a past day and a past time today, inline", () => {
  assert.match(dateProblem("2026-11-09", "10:00", "2026-11-10", "09:00") ?? "", /passed/);
  assert.match(dateProblem("2026-11-10", "08:00", "2026-11-10", "09:00") ?? "", /passed/);
  assert.equal(dateProblem("2026-11-10", "09:00", "2026-11-10", "09:00"), null);
  assert.equal(dateProblem("2026-11-12", "07:00", "2026-11-10", "09:00"), null);
  assert.match(dateProblem("", "07:00", "2026-11-10", "09:00") ?? "", /Pick a date/);
});

test("a chip's words carry type, time, status and goal; a replaced item names where it went", () => {
  assert.equal(chipSummary(item()), "Proof of work, 09:00 IST, Draft, for Job seeker");
  assert.equal(chipStatus(item({ status: "replaced", statusText: "Replaced", replacedBy: "2026-11-12" })), "Replaced by 12 Nov");
  assert.equal(chipStatus(item({ status: "replaced", statusText: "Replaced" })), "Replaced");
});

test("dots for the phone strip skip replaced items", () => {
  const set = daysWithItems([item(), item({ day: "2026-11-11", status: "replaced" })]);
  assert.deepEqual([...set], ["2026-11-10"]);
});
