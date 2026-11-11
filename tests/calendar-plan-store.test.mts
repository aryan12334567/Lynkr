// Calendar plan U2 (R22, R24, AE5, KTD3): the plan in the account, one key per write, frozen finished weeks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { freezeWeek, getProgress, getWeek, importWeekOnce, isMonday, listWeeks, putWeek } from "../lib/calendar/plan-store";
import { calendarSummary } from "../lib/calendar/summary";
import { deleteAll, exportAll, type Db } from "../lib/db";
import { planForWeek, setStatus, weekMix, updateItem } from "../lib/plan";

async function fresh() {
  const pg = new PGlite();
  await pg.exec(`create table "user" (id text primary key); insert into "user" values ('a'),('b');`);
  await pg.exec(readFileSync(new URL("../scripts/migrations/001_vertical1.sql", import.meta.url), "utf8"));
  const db: Db = { query: async <R = Record<string, unknown>,>(sql: string, params?: unknown[]) => ({ rows: (await pg.query(sql, params)).rows as R[] }) };
  return { pg, db };
}

const W45 = "2026-11-02";
const W46 = "2026-11-09";
const plan = (monday: string) => planForWeek(monday, weekMix("job_seeker", "30m"));
const keys = async (pg: PGlite, user = "a") => (await pg.query("select item_key from plan_items where user_id = $1 order by item_key", [user])).rows.map((r) => (r as { item_key: string }).item_key);

test("a week is saved and read back, and only a real Monday is a week", async () => {
  const { pg, db } = await fresh();
  assert.equal(await putWeek(db, "a", W45, plan(W45)), true);
  assert.deepEqual(await getWeek(db, "a", W45), plan(W45));
  assert.equal(await getWeek(db, "a", W46), null);
  assert.equal(isMonday(W45), true);
  for (const bad of ["2026-11-03", "2026-13-01", "nope", "", "2026-11-02; drop table plan_items"]) assert.equal(isMonday(bad), false, bad);
  assert.equal(await putWeek(db, "a", "2026-11-03", plan(W45)), false);
  assert.equal(await putWeek(db, "a", W46, plan(W45)), false, "the body's week must be the key's week");
  assert.equal(await putWeek(db, "a", W45, { ...plan(W45), items: [{ id: "x", kind: "bogus" }] }), false, "an invalid item is refused");
  assert.equal(await putWeek(db, "a", W45, "not a plan"), false);
  assert.deepEqual(await keys(pg), [`week:${W45}`]);
  await pg.close();
});

test("AE5: the browser plan moves once; a reload and a second device see the same week and nothing is overwritten", async () => {
  const { pg, db } = await fresh();
  const browser = plan(W45);
  const first = await importWeekOnce(db, "a", W45, browser);
  assert.equal(first.imported, true);
  const edited = setStatus(browser, "message-0", "done", new Date("2026-11-03T10:00:00Z"));
  await putWeek(db, "a", W45, edited); // the account copy moves on
  const again = await importWeekOnce(db, "a", W45, browser); // a reload sends the old browser copy again
  assert.equal(again.imported, false);
  assert.equal(again.plan?.items.find((i) => i.id === "message-0")?.status, "done", "the account copy was not overwritten");
  assert.deepEqual(await getWeek(db, "a", W45), edited, "a second device reads the same week");
  assert.equal((await keys(pg)).length, 1, "no duplicate");
  assert.equal((await importWeekOnce(db, "a", "2026-11-03", browser)).imported, false);
  await pg.close();
});

test("saving week 46 keeps week 45 and its progress key", async () => {
  const { pg, db } = await fresh();
  await putWeek(db, "a", W45, plan(W45));
  await freezeWeek(db, "a", W45, "2026-11-12");
  await putWeek(db, "a", W46, plan(W46));
  assert.deepEqual(await keys(pg), [`progress:${W45}`, `week:${W45}`, `week:${W46}`]);
  await pg.close();
});

test("two overlapping writes, a move and a progress freeze, both survive", async () => {
  const { pg, db } = await fresh();
  await putWeek(db, "a", W45, plan(W45));
  const moved = updateItem(plan(W46), "message-0", { day: "2026-11-12" });
  await Promise.all([putWeek(db, "a", W46, moved), freezeWeek(db, "a", W45, "2026-11-12"), putWeek(db, "a", W46, moved), freezeWeek(db, "a", W45, "2026-11-12")]);
  assert.deepEqual(await keys(pg), [`progress:${W45}`, `week:${W45}`, `week:${W46}`]);
  assert.equal((await getWeek(db, "a", W46))?.items.find((i) => i.id === "message-0")?.day, "2026-11-12");
  await pg.close();
});

test("user B cannot read user A's weeks or progress", async () => {
  const { pg, db } = await fresh();
  await putWeek(db, "a", W45, plan(W45));
  await freezeWeek(db, "a", W45, "2026-11-12");
  assert.equal(await getWeek(db, "b", W45), null);
  assert.deepEqual(await listWeeks(db, "b"), []);
  assert.deepEqual(await getProgress(db, "b"), {});
  assert.equal(await freezeWeek(db, "b", W45, "2026-11-12"), null, "nothing to freeze for B");
  await pg.close();
});

test("a finished week is frozen once: later edits and deletes do not change it", async () => {
  const { pg, db } = await fresh();
  let p = plan(W45); // 6 slots
  for (const id of ["message-0", "message-1", "message-2", "comment-0", "post-0"]) p = setStatus(p, id, "done", new Date("2026-11-04T10:00:00Z"));
  await putWeek(db, "a", W45, p);
  assert.equal(await freezeWeek(db, "a", W45, W45), null, "not finished on its own Monday");
  assert.equal(await freezeWeek(db, "a", W45, "2026-11-08"), null, "not finished on its Sunday");
  assert.deepEqual(await freezeWeek(db, "a", W45, "2026-11-09"), { planned: 6, done: 5 });
  await putWeek(db, "a", W45, { ...p, items: p.items.slice(0, 2) }); // someone edits the old week
  assert.deepEqual(await freezeWeek(db, "a", W45, "2026-11-20"), { planned: 6, done: 5 }, "the first freeze wins");
  await pg.query("delete from plan_items where user_id = 'a' and item_key = $1", [`week:${W45}`]);
  assert.deepEqual((await getProgress(db, "a"))[W45], { planned: 6, done: 5 }, "deleting the week does not change the frozen week");
  assert.equal(await freezeWeek(db, "a", "2026-10-26", "2026-11-12"), null, "a week with no plan is not frozen");
  await pg.close();
});

test("the summary gives this week's progress and a streak from the frozen weeks", async () => {
  const { pg, db } = await fresh();
  let w45 = plan(W45);
  for (const i of w45.items.slice(0, 5)) w45 = setStatus(w45, i.id, "done", new Date("2026-11-04T10:00:00Z"));
  await putWeek(db, "a", W45, w45);
  let w46 = plan(W46);
  w46 = setStatus(w46, "message-0", "done", new Date("2026-11-10T10:00:00Z"));
  await putWeek(db, "a", W46, w46);
  const s = await calendarSummary(db, "a", W46, w46, "2026-11-12");
  assert.deepEqual(s.progress, { planned: 6, done: 1 });
  assert.equal(s.streak.streak, 1);
  assert.equal(s.streak.first, false);
  assert.equal(s.streak.weeks.at(-1)?.label, "Week 46: 1 of 6 so far");
  assert.ok((await keys(pg)).includes(`progress:${W45}`), "week 45 was frozen on the way");
  assert.ok(!(await keys(pg)).includes(`progress:${W46}`), "the current week is never frozen");
  const empty = await calendarSummary(db, "b", W46, null, "2026-11-12");
  assert.equal(empty.streak.first, true);
  assert.deepEqual(empty.progress, { planned: 0, done: 0 });
  await pg.close();
});

test("Delete my data removes every week and progress key; Download my data includes them", async () => {
  const { pg, db } = await fresh();
  await putWeek(db, "a", W45, plan(W45));
  await freezeWeek(db, "a", W45, "2026-11-12");
  await putWeek(db, "b", W45, plan(W45));
  const exported = (await exportAll(db, "a")) as { plan_items: { item_key: string }[] };
  assert.deepEqual(exported.plan_items.map((r) => r.item_key).sort(), [`progress:${W45}`, `week:${W45}`]);
  const counts = await deleteAll(db, "a");
  assert.equal(counts.plan_items, 2);
  assert.deepEqual(await keys(pg), []);
  assert.deepEqual(await keys(pg, "b"), [`week:${W45}`], "another user's plan is untouched");
  await pg.close();
});
