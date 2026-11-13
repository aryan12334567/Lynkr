import { test } from "node:test";
import assert from "node:assert/strict";
import { buildIcs } from "../lib/ics";
import { dueReminders, eventFor, googleUrlFor, weekEvents } from "../lib/calendar/reminders";
import type { FeedItem } from "../lib/calendar/types";

const item = (id: string, over: Partial<FeedItem> = {}): FeedItem => ({
  id, owner: "plan", kind: "comment", day: "2026-11-12", time: "09:00", status: "scheduled", statusText: "Reminder set", title: "Comment", label: null, why: null, href: "#app/posts", movable: true, gated: true, ...over,
});

test("the week's calendar file has one event for every open item of every owner, and none for done or replaced ones", () => {
  const items = [
    item("plan:w:post-0", { kind: "post", status: "draft" }),
    item("post:p1", { owner: "post", kind: "post", status: "scheduled", title: "Proof of work" }),
    item("outreach:e1", { owner: "outreach", kind: "meeting", status: "due", title: "Meeting · Priya" }),
    item("plan:w:c", { status: "done", statusText: "Posted" }),
    item("outreach:old", { owner: "outreach", status: "replaced", statusText: "Replaced" }),
  ];
  const events = weekEvents(items);
  assert.equal(events.length, 3);
  const ics = buildIcs(events);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 3);
  assert.doesNotMatch(ics, /Posted|Replaced/);
});

test("a post that publishes itself says so; a plan slot or an outreach step is a reminder to act yourself", () => {
  const own = eventFor(item("post:p1", { owner: "post", kind: "post", title: "Proof of work", time: "09:00" }));
  assert.match(own.title, /publishes itself at 09:00/);
  assert.doesNotMatch(own.title, /reminder/i);
  assert.match(own.description, /publishes this post itself/);
  const mine = eventFor(item("plan:w:c", { title: "Comment" }));
  assert.match(mine.title, /reminder/i);
  assert.doesNotMatch(mine.title, /publishes itself/);
  assert.match(mine.description, /never posts or sends/);
});

test("a meeting's Google link carries no attendee", () => {
  const url = googleUrlFor(item("outreach:e1", { owner: "outreach", kind: "meeting", title: "Meeting · Priya" }));
  const u = new URL(url);
  assert.equal(u.hostname, "calendar.google.com");
  assert.equal(u.searchParams.get("add"), null);
  assert.doesNotMatch(decodeURIComponent(url), /mailto:|@/);
});

test("in-tab reminders fire only for items that are due, open, scheduled and not shown yet", () => {
  const now = new Date("2026-11-12T04:00:00Z").getTime(); // 09:30 IST on the 12th
  const items = [
    item("due", { time: "09:00" }), item("later", { time: "15:00" }), item("shown", { time: "09:00" }),
    item("draft", { time: "09:00", status: "draft", statusText: "Draft" }), item("done", { time: "09:00", status: "done", statusText: "Posted" }),
  ];
  assert.deepEqual(dueReminders(items, now, new Set(["shown"])).map((i) => i.id), ["due"]);
});
