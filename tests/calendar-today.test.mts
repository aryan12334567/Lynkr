import { test } from "node:test";
import assert from "node:assert/strict";
import { mixWords, todayRow, todaySlice, weekRing } from "../lib/calendar/today";
import type { FeedItem } from "../lib/calendar/types";

const item = (id: string, day: string, over: Partial<FeedItem> = {}): FeedItem => ({
  id, owner: "plan", kind: "comment", day, time: "12:30", status: "draft", statusText: "Draft", title: "Comment", label: null, why: null, href: "#app/posts", movable: true, gated: true, ...over,
});
const TODAY = "2026-11-11"; // Wednesday

test("Today shows today's open items and the overdue ones, not finished, replaced or future items", () => {
  const items = [
    item("a", TODAY), item("b", TODAY, { status: "done", statusText: "Posted" }), item("c", "2026-11-10"), item("d", "2026-11-12"),
    item("e", TODAY, { status: "replaced", statusText: "Replaced" }), item("f", "2026-11-09", { status: "due", statusText: "Due" }),
  ];
  const s = todaySlice(items, TODAY);
  assert.deepEqual(s.today.map((i) => i.id), ["a"]);
  assert.deepEqual(s.overdue.map((i) => i.id), ["f", "c"].sort((x, y) => (x === "f" ? -1 : 1) - (y === "f" ? -1 : 1)), "oldest first");
});

test("the ring is the week's done over planned, as the week screen counts it", () => {
  const items = [
    item("a", "2026-11-09", { status: "done", statusText: "Posted" }), item("b", "2026-11-10"), item("c", "2026-11-12"),
    item("old", "2026-11-11", { status: "replaced", statusText: "Replaced" }), item("next", "2026-11-17"),
  ];
  assert.deepEqual(weekRing(items, TODAY), { planned: 3, done: 1 });
});

test("the plan card says the calculated mix, not the fixed sentence", () => {
  assert.equal(mixWords({ posts: 1, comments: 2, messages: 3 }), "3 messages, 2 comments and 1 post");
  assert.equal(mixWords({ posts: 0, comments: 1, messages: 2 }), "2 messages, 1 comment and 0 posts");
  assert.doesNotMatch(mixWords({ posts: 0, comments: 4, messages: 7 }), /Three messages, two comments and one post/);
});

test("an overdue row says how late; a row for today does not", () => {
  assert.equal(todayRow(item("x", "2026-11-09"), TODAY).late, "2 days late");
  assert.equal(todayRow(item("x", "2026-11-10"), TODAY).late, "1 day late");
  assert.equal(todayRow(item("x", TODAY), TODAY).late, null);
  assert.equal(todayRow(item("x", TODAY, { status: "scheduled", statusText: "Reminder set" }), TODAY).status, "Reminder set");
});
