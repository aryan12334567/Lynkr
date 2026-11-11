// Calendar plan U1 (R10 to R13): the week's mix from goals and time, the why line, and recalculation that never touches
// what is in progress.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_COUNTS, LIMITS, WEEK_MIX, applyMix, goalFamily, planForPerson, planForWeek, setStatus, updateItem, weekMix, whyThisWeek, withCounts, type GoalFamily } from "../lib/plan";
import { WEEKLY_TIMES } from "../lib/schemas";

const MON = "2026-11-02";
const total = (c: { posts: number; comments: number; messages: number }) => c.posts + c.comments + c.messages;

test("AE1: a job seeker gets 1 / 2 / 3 on 30 minutes and 1 / 3 / 5 on an hour", () => {
  assert.deepEqual(weekMix(goalFamily({ outreachGoals: ["job"] }), "30m"), { posts: 1, comments: 2, messages: 3 });
  assert.deepEqual(weekMix(goalFamily({ outreachGoals: ["job"] }), "1h"), { posts: 1, comments: 3, messages: 5 });
});

test("the family: the first Outreach goal with a family wins, then the bucket, then the interview wants", () => {
  assert.equal(goalFamily({ outreachGoals: ["clients"], bucket: "fresher" }), "freelancer");
  assert.equal(goalFamily({ bucket: "networker" }), "visibility");
  assert.equal(goalFamily({ outreachGoals: ["clients", "job"] }), "freelancer", "the first one picked wins");
  assert.equal(goalFamily({ outreachGoals: ["job", "clients"] }), "job_seeker");
  assert.equal(goalFamily({ outreachGoals: ["hiring", "funding", "reconnect"], bucket: "experienced" }), "job_seeker", "goals with no family are skipped");
  assert.equal(goalFamily({ outreachGoals: ["mentor"] }), "visibility");
  assert.equal(goalFamily({ bucket: "founder" }), "freelancer");
  assert.equal(goalFamily({ bucket: "switcher" }), "job_seeker");
  assert.equal(goalFamily({ wants: ["network"] }), "visibility");
  assert.equal(goalFamily({ wants: ["internship"] }), "job_seeker");
  assert.equal(goalFamily({ wants: ["clients"] }), "freelancer");
  assert.equal(goalFamily({ bucket: "fresher", wants: ["network"] }), "job_seeker", "a bucket outranks the wants");
});

test("nothing known gives the standard week", () => {
  assert.equal(goalFamily({}), null);
  assert.deepEqual(weekMix(null, "2h"), DEFAULT_COUNTS);
  assert.match(whyThisWeek(weekMix(null), {}), /standard week/i);
  assert.deepEqual(planForPerson("2026-11-02", {}).counts, DEFAULT_COUNTS);
});

test("an unknown or missing weekly time is 30 minutes", () => {
  assert.deepEqual(weekMix("job_seeker"), weekMix("job_seeker", "30m"));
  assert.deepEqual(weekMix("job_seeker", "bogus" as never), weekMix("job_seeker", "30m"));
});

test("every cell of the table is a whole number within LIMITS, and more time never means fewer actions", () => {
  for (const family of Object.keys(WEEK_MIX) as GoalFamily[]) {
    let last = -1;
    for (const time of WEEKLY_TIMES) {
      const c = WEEK_MIX[family][time];
      for (const k of ["posts", "comments", "messages"] as const) assert.ok(Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= LIMITS[k], `${family} ${time} ${k}`);
      assert.deepEqual(weekMix(family, time), c);
      assert.ok(total(c) >= last, `${family} ${time}`);
      last = total(c);
    }
  }
});

test("the why line names the family, the time and the counts, leaves out zero counts, and says so when the person changed the week", () => {
  const job = whyThisWeek(weekMix("job_seeker", "30m"), { outreachGoals: ["job"], weeklyTime: "30m" });
  assert.equal(job, "Job seeker, 30 minutes a week: 3 messages (outreach first), 2 comments to warm your targets, 1 post to show your proof.");
  const vis = whyThisWeek(weekMix("visibility", "15m"), { bucket: "networker", weeklyTime: "15m" });
  assert.ok(vis.startsWith("Visibility builder, 15 minutes a week:") && !/message/.test(vis), vis);
  assert.match(whyThisWeek(weekMix("freelancer", "2h"), { outreachGoals: ["clients"], weeklyTime: "2h" }), /^Freelancer, 2 hours or more a week:/);
  const changed = whyThisWeek({ posts: 2, comments: 3, messages: 1 }, { outreachGoals: ["job"], weeklyTime: "30m" }, true);
  assert.equal(changed, "Changed by you: 1 message, 3 comments, 2 posts this week.");
  assert.ok(!/Job seeker/.test(changed), "a changed week names no rule");
  assert.equal(whyThisWeek({ posts: 0, comments: 0, messages: 0 }, {}, true), "Changed by you: no actions this week.");
});

test("a new week takes the mix for the person", () => {
  const plan = planForPerson("2026-11-03", { outreachGoals: ["clients"], weeklyTime: "1h" });
  assert.deepEqual(plan.counts, { posts: 2, comments: 4, messages: 3 });
  assert.equal(plan.items.length, 9);
  assert.equal(plan.weekStart, MON);
});

test("recalculating changes only Draft slots: Scheduled and done slots keep their day, time and status", () => {
  let plan = planForWeek(MON, weekMix("job_seeker", "1h")); // 1 / 3 / 5
  plan = updateItem(plan, "message-4", { status: "scheduled", day: "2026-11-06", time: "15:45" });
  plan = setStatus(plan, "message-3", "done", new Date("2026-11-04T10:00:00Z"));
  plan = updateItem(plan, "comment-2", { status: "scheduled", time: "08:15" });
  const smaller = applyMix(plan, weekMix("job_seeker", "15m")); // 0 / 1 / 2
  const byId = new Map(smaller.items.map((i) => [i.id, i]));
  assert.deepEqual(byId.get("message-4"), plan.items.find((i) => i.id === "message-4"), "scheduled message kept as it was");
  assert.equal(byId.get("message-3")?.status, "done");
  assert.equal(byId.get("comment-2")?.time, "08:15");
  assert.ok(!byId.has("message-2"), "an untouched draft beyond the new count is dropped");
  assert.ok(!byId.has("post-0"), "the post slot is gone at 0 posts");
  assert.equal(smaller.counts.messages, smaller.items.filter((i) => i.kind === "message").length, "counts match the slots that exist");
  const ids = smaller.items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "no duplicate ids");
});

test("recalculating after a weekly-time change keeps a Scheduled item's day and time and adds drafts for the new slots", () => {
  let plan = planForWeek(MON, weekMix("job_seeker", "15m"));
  plan = updateItem(plan, "message-0", { status: "scheduled", day: "2026-11-05", time: "17:20" });
  const bigger = applyMix(plan, weekMix("job_seeker", "2h"));
  assert.deepEqual(bigger.counts, { posts: 2, comments: 4, messages: 7 });
  const m0 = bigger.items.find((i) => i.id === "message-0")!;
  assert.equal(m0.day, "2026-11-05");
  assert.equal(m0.time, "17:20");
  assert.equal(m0.status, "scheduled");
  assert.equal(bigger.items.filter((i) => i.status === "draft").length, bigger.items.length - 1);
});

test("a week the person changed is left alone by the rules, and a hand change marks it", () => {
  const plan = planForWeek(MON, weekMix("job_seeker", "30m"));
  const edited = withCounts(plan, { posts: 3, comments: 1, messages: 1 });
  assert.equal(edited.changedByUser, true);
  assert.equal(applyMix(edited, weekMix("job_seeker", "2h")), edited, "same object back: nothing recalculated");
  assert.equal(withCounts(plan, plan.counts).changedByUser, undefined, "setting the same counts is not a change");
});

test("follow-up items survive a recalculation", () => {
  const plan = planForWeek(MON, weekMix("job_seeker", "1h"));
  const withFollow = { ...plan, items: [...plan.items, { id: "follow_up-message-0", kind: "follow_up" as const, tag: "follow_up" as const, draftId: "out:follow", day: "2026-11-09", time: "10:30", status: "draft" as const }] };
  assert.ok(applyMix(withFollow, weekMix("job_seeker", "15m")).items.some((i) => i.id === "follow_up-message-0"));
});

test("saving the profile keeps the Outreach goals in the brief (it used to drop them)", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { readFileSync } = await import("node:fs");
  const { getBrief, saveBrief, saveProfileBrief } = await import("../lib/db");
  const pg = new PGlite();
  await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
  await pg.exec(readFileSync(new URL("../scripts/migrations/001_vertical1.sql", import.meta.url), "utf8"));
  const db = { query: async <R = Record<string, unknown>,>(sql: string, params?: unknown[]) => ({ rows: (await pg.query(sql, params)).rows as R[] }) };
  await saveBrief(db, "a", { bucket: "fresher", weeklyTime: "30m", outreach: { goals: ["clients", "job"] } });
  await saveProfileBrief(db, "a", { bucket: "fresher", weeklyTime: "1h" });
  const after = await getBrief(db, "a");
  assert.deepEqual(after?.data.outreach, { goals: ["clients", "job"] });
  assert.equal(after?.data.weeklyTime, "1h", "the profile change itself is saved");
  await saveProfileBrief(db, "b", { bucket: "networker" });
  assert.equal((await getBrief(db, "b"))?.data.outreach, undefined, "no Outreach goals to keep means none are added");
  await pg.close();
});
