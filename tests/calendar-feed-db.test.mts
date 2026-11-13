import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgliteDb, type Db } from "../lib/db";
import { calendarFeed } from "../lib/calendar/server";
import { getWeek, listWeeks } from "../lib/calendar/plan-store";
import { addContact } from "../lib/outreach/contacts-db";
import { saveProfileBrief } from "../lib/db";

const NOW = new Date("2026-11-11T06:00:00Z"); // Wednesday 11:30 IST, week of Mon 2026-11-09
const ALL_ON = { outreach: true, commenter: true, posts: false };

async function world(run: (db: Db) => Promise<void>, migrations = ["001_vertical1", "002_outreach", "005_outreach_timeline", "004_comments"]) {
  const pg = new PGlite();
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','a'),('B','b');`);
    for (const m of migrations) await pg.exec(readFileSync(new URL(`../scripts/migrations/${m}.sql`, import.meta.url), "utf8"));
    await run(pgliteDb(pg));
  } finally { await pg.close(); }
}
const profile = (over: Record<string, unknown> = {}) => ({ bucket: "fresher", goals: ["job"], weeklyTime: "30m", ...over }) as never;

test("the first read makes this week and next week from the mix rules and stores them once; a second read changes nothing", async () => {
  await world(async (db) => {
    await saveProfileBrief(db, "A", profile());
    const a = await calendarFeed(db, "A", { now: NOW, createWeeks: true, paid: true, switches: ALL_ON });
    assert.deepEqual((await listWeeks(db, "A")).sort(), ["2026-11-09", "2026-11-16"].sort());
    const week = (await getWeek(db, "A", "2026-11-09"))!;
    assert.deepEqual(week.counts, { posts: 1, comments: 2, messages: 3 }, "job seeker on 30 minutes");
    assert.ok(a.items.some((i) => i.kind === "post"));
    // The person marks a slot done; reading again must not recreate or overwrite the week.
    const b = await calendarFeed(db, "A", { now: NOW, createWeeks: true, paid: true, switches: ALL_ON });
    assert.deepEqual((await getWeek(db, "A", "2026-11-09")), week);
    assert.equal(b.items.length, a.items.length);
  });
});

test("a window longer than the Calendar's range is clamped and says so", async () => {
  await world(async (db) => {
    const f = await calendarFeed(db, "A", { now: NOW, createWeeks: true, from: "2025-01-01", to: "2028-01-01", paid: true, switches: ALL_ON });
    assert.equal(f.clamped, true);
    assert.ok(f.from >= "2026-10-11" && f.to <= "2027-04-12", `${f.from} to ${f.to}`);
  });
});

test("outreach steps appear, and a failing outreach source is named while the plan still shows", async () => {
  await world(async (db) => {
    await saveProfileBrief(db, "A", profile());
    const person = { bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1", company: "Swiggy", role: "Lead" } as const;
    await addContact(db, "A", { ...person, name: "Priya Shah" });
    const ok = await calendarFeed(db, "A", { now: NOW, createWeeks: true, paid: true, switches: ALL_ON });
    assert.equal(ok.sources.outreach, "ok");
    await db.query("drop table outreach_events cascade");
    const down = await calendarFeed(db, "A", { now: NOW, createWeeks: true, paid: true, switches: ALL_ON });
    assert.equal(down.sources.outreach, "unavailable");
    assert.ok(down.items.some((i) => i.owner === "plan"), "plan slots still show");
  });
});

test("a switch that is off says off, and returns nothing from that source", async () => {
  await world(async (db) => {
    const f = await calendarFeed(db, "A", { now: NOW, createWeeks: true, paid: true, switches: { outreach: false, commenter: false, posts: false } });
    assert.deepEqual(f.sources, { plan: "ok", outreach: "off", posts: "off", comments: "off" });
    assert.ok(f.items.every((i) => i.owner === "plan"));
  });
});

test("one person never sees another person's weeks", async () => {
  await world(async (db) => {
    await saveProfileBrief(db, "A", profile({ weeklyTime: "2h" }));
    await calendarFeed(db, "A", { now: NOW, createWeeks: true, paid: true, switches: ALL_ON });
    assert.equal(await getWeek(db, "B", "2026-11-09"), null);
    const b = await calendarFeed(db, "B", { now: NOW, createWeeks: true, paid: true, switches: ALL_ON });
    assert.equal((await getWeek(db, "B", "2026-11-09"))!.counts.messages, 3, "B gets the standard week, not A's 2-hour mix");
    assert.ok(b.items.length < (await calendarFeed(db, "A", { now: NOW, createWeeks: true, paid: true, switches: ALL_ON })).items.length);
  });
});

test("comments marked posted this week mark that many comment slots done", async () => {
  await world(async (db) => {
    await saveProfileBrief(db, "A", profile());
    await db.query("insert into comment_log (user_id, body, goal, angle, source, posted, receipt_id, created_at) values ('A','x','job_seeker','add','web',true,'r1',$1), ('A','y','job_seeker','add','web',true,'r2',$1)", [NOW]);
    const f = await calendarFeed(db, "A", { now: NOW, createWeeks: true, paid: true, switches: ALL_ON });
    const comments = f.items.filter((i) => i.kind === "comment" && i.day >= "2026-11-09" && i.day <= "2026-11-15");
    assert.equal(comments.length, 2);
    assert.ok(comments.every((i) => i.status === "done"));
  });
});
