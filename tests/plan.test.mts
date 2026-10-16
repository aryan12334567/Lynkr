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
