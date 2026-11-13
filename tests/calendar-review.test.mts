// Regression tests for the Calendar Stage 2 code review (R1 to R9 reproduced the defects; each asserts the correct behaviour).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgliteDb, type Db } from "../lib/db";
import { moveItem } from "../lib/calendar/move";
import { getWeek, putWeek } from "../lib/calendar/plan-store";
import { calendarFeed } from "../lib/calendar/server";
import { fillMessageSlots, planFeedId, planItems } from "../lib/calendar/sources";
import { feedProgress } from "../lib/calendar/feed";
import { monthLabel } from "../lib/calendar/grid";
import { dueReminders } from "../lib/calendar/reminders";
import { importWeekOnce } from "../lib/calendar/plan-store";
import { addContact } from "../lib/outreach/contacts-db";
import { recordEvent } from "../lib/outreach/timeline";
import { planForWeek } from "../lib/plan";

const MON = "2026-11-09";
const NOW = new Date("2026-11-09T03:00:00Z"); // Monday 08:30 IST
const PAID = { paid: true, now: NOW };
const ON = { outreach: true, commenter: false, posts: false };
const CREATE = { createWeeks: true };
let n = 0;
const op = () => `op-${++n}-${"x".repeat(8)}`;
const person = { bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1", company: "Swiggy", role: "Lead" } as const;

async function world(run: (db: Db) => Promise<void>) {
  const pg = new PGlite();
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','a'),('B','b');`);
    for (const m of ["001_vertical1", "002_outreach", "005_outreach_timeline"]) await pg.exec(readFileSync(new URL(`../scripts/migrations/${m}.sql`, import.meta.url), "utf8"));
    const db = pgliteDb(pg);
    assert.ok(await putWeek(db, "A", MON, planForWeek(MON)));
    await run(db);
  } finally { await pg.close(); }
}
async function followUp(db: Db, day: string) {
  const c = await addContact(db, "A", { ...person, name: "Priya Shah" });
  return recordEvent(db, "A", { type: "insert", opId: op(), contactId: c.id, kind: "follow_up", status: "due", dueAt: new Date(`${day}T14:00:00+05:30`) });
}

test("R1 undo of an outreach move works: the client moves the replacement step back", async () => {
  await world(async (db) => {
    const ev = await followUp(db, "2026-11-12");
    const first = await moveItem(db, "A", { op_id: op(), id: `outreach:${ev.event.id}`, day: "2026-11-13" }, PAID);
    assert.equal(first.status, 200);
    // The owner replaced the step: the response carries the live one, and Undo (useFeed) targets that id.
    const live = (first.body.item as { id: string; day: string }).id;
    assert.notEqual(live, `outreach:${ev.event.id}`, "the replacement has its own id");
    const undo = await moveItem(db, "A", { op_id: op(), id: live, day: "2026-11-12", time: "14:00" }, PAID);
    assert.equal(undo.status, 200, JSON.stringify(undo.body));
    assert.equal((undo.body.item as { day: string; time: string }).day, "2026-11-12");
    assert.equal((undo.body.item as { day: string; time: string }).time, "14:00");
    // The old id is gone for good: moving it again is refused, never a second live step.
    assert.equal((await moveItem(db, "A", { op_id: op(), id: `outreach:${ev.event.id}`, day: "2026-11-14" }, PAID)).status, 409);
  });
});

test("R2 dragging an outreach step keeps its time (14:00)", async () => {
  await world(async (db) => {
    const ev = await followUp(db, "2026-11-12");
    const r = await moveItem(db, "A", { op_id: op(), id: `outreach:${ev.event.id}`, day: "2026-11-13" }, PAID); // a drop sends no time
    assert.equal((r.body.item as { time: string }).time, "14:00", "time after a day-only move");
  });
});

test("R3 a plan slot already marked done is not replaced by a due step, and progress does not lose it", () => {
  const plan = { ...planForWeek(MON) };
  const msg = plan.items.find((i) => i.kind === "message")!;
  const done = { ...plan, items: plan.items.map((i) => (i.id === msg.id ? { ...i, status: "done" as const } : i)) };
  const slots = planItems(done, null, null);
  const step = { id: "outreach:e1", owner: "outreach" as const, kind: "follow_up" as const, day: msg.day, time: "09:00", status: "due" as const, statusText: "Due", title: "Follow-up · P", label: null, why: null, href: "#app/outreach", movable: true, gated: true };
  const before = feedProgress(slots, MON);
  const merged = fillMessageSlots(slots, [step]);
  const after = feedProgress(merged, MON);
  assert.equal(after.done, before.done, `done ${before.done} -> ${after.done}`);
  assert.equal(merged.find((i) => i.id === "outreach:e1")?.fills, undefined, "the step did not take the done slot");
  assert.equal(merged.find((i) => i.id === planFeedId(MON, msg.id))?.status, "done", "the done slot is still there, still done");
});

test("R4 the old date of a moved plan slot stays visible as Replaced (R14)", async () => {
  await world(async (db) => {
    const before = (await getWeek(db, "A", MON))!.items.find((i) => i.id === "post-0")!;
    const to = before.day === "2026-11-13" ? "2026-11-12" : "2026-11-13";
    assert.equal((await moveItem(db, "A", { op_id: op(), id: planFeedId(MON, "post-0"), day: to }, PAID)).status, 200);
    const feed = await calendarFeed(db, "A", { now: NOW, from: MON, to: "2026-11-15", paid: true, switches: ON, ...CREATE });
    const ghost = feed.items.find((i) => i.status === "replaced" && i.day === before.day && i.kind === "post");
    assert.ok(ghost, "no replaced item at the old date");
    assert.equal(ghost!.replacedBy, to, "says where it went");
    assert.equal(ghost!.movable, false);
    const p = feedProgress(feed.items, MON);
    assert.equal(p.planned, feedProgress(feed.items.filter((i) => i.status !== "replaced"), MON).planned, "a replaced ghost is not planned");
  });
});

test("R5 the month header names the month the grid shows (Nov 2026 starts on a Sunday)", () => {
  assert.match(monthLabel("2026-11-18"), /Nov/);
  assert.match(monthLabel("2026-11-18"), /2026/);
  assert.doesNotMatch(monthLabel("2026-11-18"), /Oct/);
});

test("R6 reusing one op id for a different plan slot does not report a move that did not happen", async () => {
  await world(async (db) => {
    const o = op();
    const a = (await getWeek(db, "A", MON))!.items.find((i) => i.id === "post-0")!;
    const b = (await getWeek(db, "A", MON))!.items.find((i) => i.id === "comment-0")!;
    const da = a.day === "2026-11-13" ? "2026-11-12" : "2026-11-13", dbb = b.day === "2026-11-13" ? "2026-11-12" : "2026-11-13";
    await moveItem(db, "A", { op_id: o, id: planFeedId(MON, "post-0"), day: da }, PAID);
    const second = await moveItem(db, "A", { op_id: o, id: planFeedId(MON, "comment-0"), day: dbb }, PAID);
    const moved = (await getWeek(db, "A", MON))!.items.find((i) => i.id === "comment-0")!.day === dbb;
    assert.ok(second.status !== 200 || moved, "second move reported 200 but nothing moved");
  });
});

test("R7 an outreach step cannot be moved to an impossible or far-future date", async () => {
  await world(async (db) => {
    const ev = await followUp(db, "2026-11-12");
    const id = `outreach:${ev.event.id}`;
    const far = await moveItem(db, "A", { op_id: op(), id, day: "2099-01-01" }, PAID);
    assert.notEqual(far.status, 200, "moved to 2099");
  });
});

test("R8 two concurrent outreach moves with different op ids leave one live step", async () => {
  await world(async (db) => {
    const ev = await followUp(db, "2026-11-12");
    const id = `outreach:${ev.event.id}`;
    await Promise.all([moveItem(db, "A", { op_id: op(), id, day: "2026-11-13" }, PAID), moveItem(db, "A", { op_id: op(), id, day: "2026-11-14" }, PAID)]);
    const live = await db.query("select count(*)::int as n from outreach_events where kind = 'follow_up' and status = 'due'");
    assert.equal(live.rows[0].n, 1, `${live.rows[0].n} live follow-ups`);
  });
});

test("R9 a plan move to today at a later time is accepted by the injected clock", async () => {
  await world(async (db) => {
    const a = (await getWeek(db, "A", MON))!.items.find((i) => i.id === "post-0")!;
    const r = await moveItem(db, "A", { op_id: op(), id: planFeedId(MON, "post-0"), day: "2026-11-09", time: "15:00" }, PAID); // NOW is Monday 08:30 IST
    assert.ok(a.day !== "2026-11-09" || r.status === 200);
    assert.equal(r.status, 200, JSON.stringify(r.body));
  });
});

test("R10 a stale whole-week save cannot undo a move", async () => {
  await world(async (db) => {
    const stale = (await getWeek(db, "A", MON))!; // what the browser read before the move
    const to = stale.items.find((i) => i.id === "post-0")!.day === "2026-11-13" ? "2026-11-12" : "2026-11-13";
    assert.equal((await moveItem(db, "A", { op_id: op(), id: planFeedId(MON, "post-0"), day: to }, PAID)).status, 200);
    assert.equal(await putWeek(db, "A", MON, stale), "stale");
    assert.equal((await getWeek(db, "A", MON))!.items.find((i) => i.id === "post-0")!.day, to, "the move survived");
    const fresh = (await getWeek(db, "A", MON))!;
    assert.equal(await putWeek(db, "A", MON, fresh), true, "a plan that has seen the move saves normally");
  });
});

test("R11 the feed does not beat the browser plan to the week (AE5)", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','a');`);
    for (const m of ["001_vertical1", "002_outreach", "005_outreach_timeline"]) await pg.exec(readFileSync(new URL(`../scripts/migrations/${m}.sql`, import.meta.url), "utf8"));
    const db = pgliteDb(pg);
    await calendarFeed(db, "A", { now: NOW, paid: true, switches: ON }); // Today's or the grid's first read
    const browser = { ...planForWeek(MON), counts: { posts: 2, comments: 2, messages: 1 } };
    const r = await importWeekOnce(db, "A", MON, browser);
    assert.equal(r.imported, true, "the browser plan was moved up");
    assert.deepEqual(r.plan!.counts, browser.counts);
  } finally { await pg.close(); }
});

test("R12 turning reminders on does not fire last week's items", () => {
  const now = new Date("2026-11-13T04:00:00Z").getTime();
  const item = (id: string, day: string) => ({ id, owner: "plan" as const, kind: "comment" as const, day, time: "09:00", status: "scheduled" as const, statusText: "Reminder set", title: "Comment", label: null, why: null, href: "#", movable: true, gated: true });
  assert.deepEqual(dueReminders([item("old", "2026-11-09"), item("today", "2026-11-13")], now, new Set()).map((i) => i.id), ["today"]);
});

test("R13 a replaced outreach step says where it went", async () => {
  await world(async (db) => {
    const ev = await followUp(db, "2026-11-12");
    assert.equal((await moveItem(db, "A", { op_id: op(), id: `outreach:${ev.event.id}`, day: "2026-11-13" }, PAID)).status, 200);
    const feed = await calendarFeed(db, "A", { now: NOW, from: MON, to: "2026-11-15", paid: true, switches: ON });
    const old = feed.items.find((i) => i.id === `outreach:${ev.event.id}`);
    assert.equal(old?.status, "replaced");
    assert.equal(old?.replacedBy, "2026-11-13");
  });
});
