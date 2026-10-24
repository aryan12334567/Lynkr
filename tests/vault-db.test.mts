// Account storage (build plan Part 1b) on a real Postgres engine running in-process (PGlite):
// user isolation (I16), delete my data (I17), durable caps across instances (I18), cleanup (I19),
// idempotent answers and facts, newest edit wins.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import * as db from "../lib/db";
import { cleanup, cronAuthorized } from "../lib/cleanup";
import type { StoryFact } from "../lib/schemas";

async function fresh() {
  const pg = new PGlite();
  // Better Auth owns "user"; a minimal stand-in is enough for the foreign keys.
  await pg.exec(`create table "user" (id text primary key, email text);
    insert into "user" (id, email) values ('userA', 'a@example.test'), ('userB', 'b@example.test');
    create table lynkr_migrations (name text primary key, applied_at timestamptz not null default now());`);
  await pg.exec(readFileSync(new URL("../scripts/migrations/001_vertical1.sql", import.meta.url), "utf8"));
  await pg.query("insert into lynkr_migrations (name) values ('001_vertical1.sql')");
  const d: db.Db = { query: async (text, params) => ({ rows: (await pg.query(text, params as unknown[])).rows as never[] }) };
  return { pg, d };
}

const conf = { example: true, number: "measured" as const, iDid: true };

async function seed(d: db.Db, u: string) {
  await db.touchUser(d, u);
  await db.saveBrief(d, u, { bucket: "experienced", targetRoles: `role of ${u}` });
  await db.upsertAnswer(d, u, { qid: "C1", attempt: 0, status: "answered", text: `${u} cut close from 8 days to 5` });
  await db.upsertAnswerFacts(d, u, "C1", 0, [{ kind: "project", text: `${u} cut close from 8 days to 5`, confidence: conf }]);
  await db.saveDraft(d, u, "headline", "headline", { text: `${u} headline` });
  await db.savePlanItems(d, u, [{ key: "mon-1", data: { kind: "message" } }]);
  await db.takeDaily(d, u, "interview", 100);
}

test("migration: safe to run twice; cloudReady only after it", async () => {
  const pg = new PGlite();
  const d: db.Db = { query: async (t, p) => ({ rows: (await pg.query(t, p as unknown[])).rows as never[] }) };
  assert.equal(await db.cloudReady(d), false);
  const { d: ready } = await fresh();
  assert.equal(await db.cloudReady(ready), true);
  const { pg: again } = await fresh();
  await again.exec(readFileSync(new URL("../scripts/migrations/001_vertical1.sql", import.meta.url), "utf8"));
});

test("I16: user B can't read, change or delete user A's rows", async () => {
  const { d } = await fresh();
  await seed(d, "userA");
  const aFacts = await db.listFacts(d, "userA");
  assert.equal(aFacts.length, 1);
  // Read
  assert.equal(await db.getBrief(d, "userB"), null);
  assert.deepEqual(await db.listFacts(d, "userB"), []);
  assert.deepEqual(await db.listAnswers(d, "userB"), []);
  assert.deepEqual(await db.listDrafts(d, "userB"), []);
  assert.deepEqual(await db.listPlanItems(d, "userB"), []);
  assert.ok(!JSON.stringify(await db.exportAll(d, "userB")).includes("userA"));
  // Change: B saving a fact with A's key creates B's own row; A's is untouched.
  await db.saveFacts(d, "userB", [{ ...aFacts[0], text: "hijacked", updatedAt: new Date(Date.now() + 60_000).toISOString() }]);
  assert.equal((await db.listFacts(d, "userA"))[0].text, aFacts[0].text);
  await db.upsertAnswer(d, "userB", { qid: "C1", attempt: 0, status: "answered", text: "hijacked" });
  assert.notEqual((await db.listAnswers(d, "userA"))[0].text, "hijacked");
  await db.saveDraft(d, "userB", "headline", "headline", { text: "hijacked" });
  assert.deepEqual((await db.listDrafts(d, "userA"))[0].body, { text: "userA headline" });
  await db.savePlanItems(d, "userB", []);
  assert.equal((await db.listPlanItems(d, "userA")).length, 1);
  await db.updateSettings(d, "userB", { saveAnswers: false });
  assert.equal((await db.listAnswers(d, "userA")).length, 1);
  // Delete
  assert.equal(await db.deleteFact(d, "userB", aFacts[0].id), true, "deletes B's own copy only");
  assert.equal((await db.listFacts(d, "userA")).length, 1);
  await db.deleteAll(d, "userB");
  assert.equal((await db.listFacts(d, "userA")).length, 1);
  assert.ok(await db.getBrief(d, "userA"));
});

test("I17: delete my data removes every row for the user in every table", async () => {
  const { d, pg } = await fresh();
  await seed(d, "userA");
  await seed(d, "userB");
  const counts = await db.deleteAll(d, "userA");
  assert.ok(Object.values(counts).every((n) => n >= 1), JSON.stringify(counts));
  for (const t of ["lynkr_user", "context_brief", "facts", "interview_answers", "drafts", "plan_items", "usage_daily"]) {
    const a = await pg.query(`select count(*)::int as n from ${t} where user_id = 'userA'`);
    const b = await pg.query(`select count(*)::int as n from ${t} where user_id = 'userB'`);
    assert.equal((a.rows[0] as { n: number }).n, 0, `${t} still has userA rows`);
    assert.ok((b.rows[0] as { n: number }).n >= 1, `${t} lost userB rows`);
  }
});

test("I18: daily caps hold across two app instances sharing one database", async () => {
  const { pg } = await fresh();
  const one: db.Db = { query: async (t, p) => ({ rows: (await pg.query(t, p as unknown[])).rows as never[] }) };
  const two: db.Db = { query: async (t, p) => ({ rows: (await pg.query(t, p as unknown[])).rows as never[] }) };
  const got = [];
  for (let i = 0; i < 5; i++) got.push(await db.takeDaily(i % 2 ? one : two, "userA", "first_win", 3));
  assert.deepEqual(got, [true, true, true, false, false]);
  assert.equal(await db.takeDaily(one, "userB", "first_win", 3), true, "per user");
});

test("I19: cleanup dry run lists, real run deletes only the inactive; refused without the secret", async () => {
  const { d, pg } = await fresh();
  await seed(d, "userA");
  await seed(d, "userB");
  await pg.query("update lynkr_user set last_active_at = now() - interval '13 months' where user_id = 'userA'");
  const dry = await cleanup(d, { dryRun: true });
  assert.deepEqual(dry, { users: 1, rows: 0, dryRun: true });
  assert.equal((await db.listFacts(d, "userA")).length, 1);
  const real = await cleanup(d, { dryRun: false });
  assert.equal(real.users, 1);
  assert.ok(real.rows > 0);
  assert.equal((await db.listFacts(d, "userA")).length, 0);
  assert.equal((await db.listFacts(d, "userB")).length, 1);
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "a-long-test-secret-0123456789";
  assert.equal(cronAuthorized(new Request("http://x/api/cron/cleanup")), false);
  assert.equal(cronAuthorized(new Request("http://x/api/cron/cleanup", { headers: { authorization: "Bearer wrong" } })), false);
  assert.equal(cronAuthorized(new Request("http://x/api/cron/cleanup", { headers: { authorization: "Bearer a-long-test-secret-0123456789" } })), true);
  process.env.CRON_SECRET = "";
  assert.equal(cronAuthorized(new Request("http://x", { headers: { authorization: "Bearer " } })), false, "no secret set: refuse all");
  process.env.CRON_SECRET = prev;
});

test("answers and facts: saving twice never duplicates; a confirmed fact keeps the person's wording", async () => {
  const { d } = await fresh();
  const a = { qid: "C1", attempt: 0, status: "answered" as const, text: "I built a report" };
  await db.upsertAnswer(d, "userA", a);
  await db.upsertAnswer(d, "userA", a);
  assert.equal((await db.listAnswers(d, "userA")).length, 1);
  await db.upsertAnswerFacts(d, "userA", "C1", 0, [{ kind: "project", text: "I built a report", confidence: conf }]);
  await db.upsertAnswerFacts(d, "userA", "C1", 0, [{ kind: "project", text: "I built a report for 12 managers", confidence: conf }]);
  let facts = await db.listFacts(d, "userA");
  assert.equal(facts.length, 1);
  assert.equal(facts[0].text, "I built a report for 12 managers");
  await db.saveFacts(d, "userA", [{ ...facts[0], text: "I built the monthly report for 12 regional managers", reviewStatus: "confirmed", useInDrafts: true, updatedAt: new Date(Date.now() + 1000).toISOString() }]);
  await db.upsertAnswerFacts(d, "userA", "C1", 0, [{ kind: "project", text: "something else", confidence: conf }]);
  facts = await db.listFacts(d, "userA");
  assert.equal(facts.length, 1);
  assert.equal(facts[0].text, "I built the monthly report for 12 regional managers");
  assert.equal((await db.confirmedFacts(d, "userA")).length, 1);
});

test("newest edit wins when two browsers disagree", async () => {
  const { d } = await fresh();
  const base: StoryFact = { id: "F1", kind: "project", text: "v1", sourceTurnIds: [], reviewStatus: "candidate", useInDrafts: false, updatedAt: "2026-10-20T10:00:00.000Z" };
  await db.saveFacts(d, "userA", [base]);
  const r1 = await db.saveFacts(d, "userA", [{ ...base, text: "newer", updatedAt: "2026-10-21T10:00:00.000Z" }]);
  const r2 = await db.saveFacts(d, "userA", [{ ...base, text: "older", updatedAt: "2026-10-19T10:00:00.000Z" }]);
  assert.deepEqual([r1.saved, r2.older], [1, ["F1"]]);
  assert.equal((await db.listFacts(d, "userA"))[0].text, "newer");
});

test("brief is versioned and only grows when something changed", async () => {
  const { d } = await fresh();
  assert.equal(await db.saveBrief(d, "userA", { a: 1 }), 1);
  assert.equal(await db.saveBrief(d, "userA", { a: 1 }), 1);
  assert.equal(await db.saveBrief(d, "userA", { a: 2 }), 2);
  assert.deepEqual((await db.getBrief(d, "userA"))?.data, { a: 2 });
});

test("switching off 'save my answers' removes saved answers", async () => {
  const { d } = await fresh();
  await db.upsertAnswer(d, "userA", { qid: "A1", attempt: 0, status: "answered", text: "x" });
  await db.updateSettings(d, "userA", { saveAnswers: false, consent: true });
  assert.equal((await db.listAnswers(d, "userA")).length, 0);
  const s = await db.touchUser(d, "userA");
  assert.equal(s.saveAnswers, false);
  assert.ok(s.consentAt);
});

test("existing routes: account facts and brief win; request shapes still work without an account", async () => {
  const { mergeFacts, mergeProfile } = await import("../lib/context");
  const { ProfileInput } = await import("../lib/schemas");
  const sent = [{ id: "F1", kind: "project" as const, text: "browser wording" }];
  assert.deepEqual(mergeFacts(null, sent, "all"), sent, "no account: unchanged");
  const acct: StoryFact[] = [
    { id: "F1", kind: "project", text: "account wording", sourceTurnIds: [], reviewStatus: "confirmed", useInDrafts: true },
    { id: "F2", kind: "evidence", text: "saved 6 hours a week", sourceTurnIds: [], reviewStatus: "confirmed", useInDrafts: true },
  ];
  assert.deepEqual(mergeFacts(acct, sent, "all").map((f) => f.id), ["F1", "F2"]);
  assert.equal(mergeFacts(acct, sent, "picked")[0].text, "account wording");
  assert.equal(mergeFacts(acct, sent, "picked").length, 1, "picked keeps the person's choice");
  assert.equal(mergeFacts(acct, [{ id: "F9", kind: "offer", text: "not synced" }], "picked")[0].text, "not synced");
  const p = ProfileInput.parse({ goal: "job", targetRole: "Analyst", background: "B.Com" });
  assert.equal(mergeProfile({ ...p, targetRole: "Data analyst" }, p).targetRole, "Data analyst");
  assert.equal(mergeProfile({ broken: true }, p).targetRole, "Analyst");
});
