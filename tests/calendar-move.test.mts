import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgliteDb, type Db } from "../lib/db";
import { moveItem, type PostsOwner } from "../lib/calendar/move";
import { getWeek, putWeek } from "../lib/calendar/plan-store";
import { planFeedId } from "../lib/calendar/sources";
import { addContact } from "../lib/outreach/contacts-db";
import { recordEvent } from "../lib/outreach/timeline";
import { planForWeek } from "../lib/plan";

const MON = "2026-11-09";
const NOW = new Date("2026-11-09T03:00:00Z"); // Monday 08:30 IST
const PAID = { paid: true, now: NOW };
const FREE = { paid: false, now: NOW };
let n = 0;
const op = () => `op-${++n}-${"x".repeat(8)}`;

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
const slot = async (db: Db, user: string, id: string) => (await getWeek(db, user, MON))!.items.find((i) => i.id === id)!;

test("a plan slot moves to another day and keeps its time; the old place is kept; the same op twice moves once", async () => {
  await world(async (db) => {
    const before = await slot(db, "A", "post-0");
    const id = planFeedId(MON, "post-0");
    const target = before.day === "2026-11-12" ? "2026-11-13" : "2026-11-12";
    const o = op();
    const r = await moveItem(db, "A", { op_id: o, id, day: target }, PAID);
    assert.equal(r.status, 200);
    const after = await slot(db, "A", "post-0");
    assert.equal(after.day, target);
    assert.equal(after.time, before.time, "dropping on a day keeps the time (R14)");
    assert.deepEqual(after.moves, [{ day: before.day, time: before.time }]);
    const again = await moveItem(db, "A", { op_id: o, id, day: "2026-11-14" }, PAID);
    assert.equal(again.status, 200);
    assert.equal(again.body.replayed, true);
    assert.equal((await slot(db, "A", "post-0")).day, target, "the retry moved nothing");
  });
});

test("undo is the reverse move: the original day and time come back", async () => {
  await world(async (db) => {
    const before = await slot(db, "A", "comment-0");
    const id = planFeedId(MON, "comment-0");
    const target = before.day === "2026-11-13" ? "2026-11-12" : "2026-11-13";
    await moveItem(db, "A", { op_id: op(), id, day: target, time: "15:00" }, PAID);
    await moveItem(db, "A", { op_id: op(), id, day: before.day, time: before.time }, PAID);
    const back = await slot(db, "A", "comment-0");
    assert.deepEqual([back.day, back.time], [before.day, before.time]);
  });
});

test("refusals: a past day, another week, a finished slot, and an unknown slot change nothing", async () => {
  await world(async (db) => {
    const id = planFeedId(MON, "message-0");
    const snap = JSON.stringify(await getWeek(db, "A", MON));
    assert.equal((await moveItem(db, "A", { op_id: op(), id, day: "2026-11-08" }, PAID)).status, 400, "past");
    assert.equal((await moveItem(db, "A", { op_id: op(), id, day: "2026-11-17" }, PAID)).status, 400, "next week");
    assert.equal((await moveItem(db, "A", { op_id: op(), id: planFeedId(MON, "nope-9"), day: "2026-11-12" }, PAID)).status, 404);
    assert.equal(JSON.stringify(await getWeek(db, "A", MON)), snap);
    const plan = (await getWeek(db, "A", MON))!;
    await putWeek(db, "A", MON, { ...plan, items: plan.items.map((i) => (i.id === "message-0" ? { ...i, status: "done" } : i)) });
    assert.equal((await moveItem(db, "A", { op_id: op(), id, day: "2026-11-12" }, PAID)).status, 409);
  });
});

test("another person's plan slot is a 404 and nothing changes", async () => {
  await world(async (db) => {
    const snap = JSON.stringify(await getWeek(db, "A", MON));
    const r = await moveItem(db, "B", { op_id: op(), id: planFeedId(MON, "post-0"), day: "2026-11-12" }, PAID);
    assert.equal(r.status, 404);
    assert.equal(JSON.stringify(await getWeek(db, "A", MON)), snap);
  });
});

test("a free account moves its plan slot, but gets 402 for a post or an outreach step and nothing changes", async () => {
  await world(async (db) => {
    assert.equal((await moveItem(db, "A", { op_id: op(), id: planFeedId(MON, "post-0"), day: "2026-11-13" }, FREE)).status, 200);
    const person = { bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1", company: "Swiggy", role: "Lead" } as const;
    const c = await addContact(db, "A", { ...person, name: "Priya Shah" });
    const ev = await recordEvent(db, "A", { type: "insert", opId: op(), contactId: c.id, kind: "follow_up", status: "due", dueAt: new Date("2026-11-11T05:00:00Z") });
    const r = await moveItem(db, "A", { op_id: op(), id: `outreach:${ev.event.id}`, day: "2026-11-13" }, FREE);
    assert.equal(r.status, 402);
    const still = await db.query("select due_at from outreach_events where id = $1", [ev.event.id]);
    assert.equal(new Date(still.rows[0].due_at as string).toISOString(), "2026-11-11T05:00:00.000Z");
    let called = false;
    const posts: PostsOwner = { reschedule: async () => { called = true; return { status: 200, body: {} }; } };
    assert.equal((await moveItem(db, "A", { op_id: op(), id: "post:p1", day: "2026-11-13" }, { ...FREE, posts })).status, 402);
    assert.equal(called, false, "the owner is never reached without a subscription");
  });
});

test("an outreach step moves through the owner's own supersede, once per op; the old date stays as replaced", async () => {
  await world(async (db) => {
    const person = { bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1", company: "Swiggy", role: "Lead" } as const;
    const c = await addContact(db, "A", { ...person, name: "Priya Shah" });
    const ev = await recordEvent(db, "A", { type: "insert", opId: op(), contactId: c.id, kind: "follow_up", status: "due", dueAt: new Date("2026-11-11T05:00:00Z") });
    const o = op();
    const r = await moveItem(db, "A", { op_id: o, id: `outreach:${ev.event.id}`, day: "2026-11-13" }, PAID);
    assert.equal(r.status, 200);
    assert.equal(((r.body.item as { day: string }).day), "2026-11-13");
    const again = await moveItem(db, "A", { op_id: o, id: `outreach:${ev.event.id}`, day: "2026-11-13" }, PAID);
    assert.equal(again.body.replayed, true);
    const rows = await db.query("select status from outreach_events where contact_id = $1 and kind = 'follow_up' order by created_at", [c.id]);
    assert.deepEqual(rows.rows.map((x) => x.status).sort(), ["due", "superseded"]);
    assert.equal((await moveItem(db, "B", { op_id: op(), id: `outreach:${ev.event.id}`, day: "2026-11-14" }, PAID)).status, 404, "another person's step");
  });
});

test("AE3: a post move goes to Posts with the day and the kept time; Posts' 'Publishing now' passes through; without Posts it is 404", async () => {
  await world(async (db) => {
    const calls: unknown[][] = [];
    const posts: PostsOwner = {
      reschedule: async (u, id, day, time, opId) => { calls.push([u, id, day, time, opId]); return id === "busy" ? { status: 409, body: { error: "Publishing now" } } : { status: 200, body: { ok: true } }; },
    };
    const o = op();
    assert.equal((await moveItem(db, "A", { op_id: o, id: "post:p1", day: "2026-11-11" }, { ...PAID, posts })).status, 200);
    assert.deepEqual(calls[0], ["A", "p1", "2026-11-11", undefined, o]);
    const busy = await moveItem(db, "A", { op_id: op(), id: "post:busy", day: "2026-11-11" }, { ...PAID, posts });
    assert.equal(busy.status, 409);
    assert.equal(busy.body.error, "Publishing now");
    assert.equal((await moveItem(db, "A", { op_id: op(), id: "post:p1", day: "2026-11-11" }, PAID)).status, 404);
  });
});

test("two overlapping plan moves on different slots both survive", async () => {
  await world(async (db) => {
    const a = await slot(db, "A", "post-0"), b = await slot(db, "A", "comment-0");
    const da = a.day === "2026-11-13" ? "2026-11-12" : "2026-11-13", dbb = b.day === "2026-11-13" ? "2026-11-12" : "2026-11-13";
    const [r1, r2] = await Promise.all([
      moveItem(db, "A", { op_id: op(), id: planFeedId(MON, "post-0"), day: da }, PAID),
      moveItem(db, "A", { op_id: op(), id: planFeedId(MON, "comment-0"), day: dbb }, PAID),
    ]);
    assert.deepEqual([r1.status, r2.status], [200, 200]);
    assert.equal((await slot(db, "A", "post-0")).day, da);
    assert.equal((await slot(db, "A", "comment-0")).day, dbb);
  });
});
