import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { createExtensionToken } from "../lib/outreach/contacts-db";
import { extDeps, newToken } from "../lib/outreach/ext-auth";
import { pgliteDb, saveBrief, type Db } from "../lib/db";

// The route files import "@/lib/...", as Next.js resolves it. Map it to the app root for node --test.
register("data:text/javascript," + encodeURIComponent(`
const root = ${JSON.stringify(new URL("../", import.meta.url).href)};
export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);
  const href = root + specifier.slice(2);
  try { return await next(href, context); } catch { return next(href + ".ts", context); }
}`));

const EXT = "a".repeat(32);
const ORIGIN = `chrome-extension://${EXT}`;
const POST = "Priya Shah\nData Lead at Swiggy\n2d •\nMost teams skip cleaning the survey data and then wonder why the dashboard is wrong.\nWe fixed the inputs first, and the report time dropped.";

type World = { pg: PGlite; db: Db; paid: Set<string>; token: string };
async function world(run: (w: World) => Promise<void>, env: Record<string, string | undefined> = {}) {
  const pg = new PGlite();
  const keys = ["LYNKR_EXT_ID", "LYNKR_PAYWALL", "LYNKR_MOCK", "LYNKR_COMMENTER", "VERCEL_ENV"];
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const saved = { ...extDeps };
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','custA'),('B','custB');`);
    for (const m of ["001_vertical1", "002_outreach", "005_outreach_timeline"]) await pg.exec(readFileSync(new URL(`../scripts/migrations/${m}.sql`, import.meta.url), "utf8"));
    const db: Db = pgliteDb(pg);
    const paid = new Set(["custA", "custB"]);
    Object.assign(process.env, { LYNKR_EXT_ID: EXT, LYNKR_PAYWALL: "1", LYNKR_MOCK: "1", LYNKR_COMMENTER: "on" }, env);
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    extDeps.db = () => db;
    extDeps.ready = async () => true;
    extDeps.subscribed = async (c) => !!c && paid.has(c);
    const token = newToken();
    await createExtensionToken(db, "A", token);
    await run({ pg, db, paid, token });
  } finally {
    Object.assign(extDeps, saved);
    for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
    await pg.close();
  }
}
const fact = (db: Db, user: string, key: string, kind: string, text: string) =>
  db.query("insert into facts (user_id, fact_key, kind, text, status, use_in_drafts) values ($1,$2,$3,$4,'confirmed',true)", [user, key, kind, text]);
const post = (token: string | null, body: unknown, origin: string | null = ORIGIN) =>
  new Request("https://lynkr.test/api/ext/comment", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
const route = () => import("../app/api/ext/comment/route");
const FACT_TEXT = "Cleaned two years of fest feedback survey data in Excel before building the summary charts.";

test("AE7: a lapsed token gets 402 and no generation is counted", async () => {
  await world(async ({ db, paid, token }) => {
    await fact(db, "A", "F1", "project", FACT_TEXT);
    paid.delete("custA");
    const res = await (await route()).POST(post(token, { selection: POST }));
    assert.equal(res.status, 402);
    assert.equal((await db.query("select 1 from usage_daily")).rows.length, 0);
  });
});

test("no token and a disallowed origin get nothing", async () => {
  await world(async ({ token }) => {
    const { POST: handler } = await route();
    assert.equal((await handler(post(null, { selection: POST }))).status, 401);
    const res = await handler(post(token, { selection: POST }, "chrome-extension://" + "b".repeat(32)));
    assert.equal(res.status, 403);
    assert.equal(res.headers.get("access-control-allow-origin"), null);
  });
});

test("the switch off answers 404 before any work", async () => {
  await world(async ({ db, token }) => {
    await fact(db, "A", "F1", "project", FACT_TEXT);
    assert.equal((await (await route()).POST(post(token, { selection: POST }))).status, 404);
    assert.equal((await db.query("select 1 from usage_daily")).rows.length, 0);
  }, { LYNKR_COMMENTER: "off" });
});

test("AE1 in demo mode: options with the author, the goal default, and one counted generation", async () => {
  await world(async ({ db, token }) => {
    await fact(db, "A", "F1", "project", FACT_TEXT);
    await saveBrief(db, "A", { goal: "job", targetRole: "Data analyst", background: "Final-year student", bucket: "networker", domain: "not_sure", audiences: [], topics: [] });
    const res = await (await route()).POST(post(token, { selection: POST, reaction: "Inputs first, then the charts follow." }));
    assert.equal(res.status, 200);
    const j = (await res.json()) as { status: string; goal: string; author: { name: string }; options: { angle: string; factRefs: string[]; postAnchor: string }[] };
    assert.equal(j.status, "options");
    assert.equal(j.goal, "visibility", "a networker's default goal");
    assert.equal(j.author.name, "Priya Shah");
    assert.ok(j.options.length >= 1 && j.options.every((o) => POST.includes(o.postAnchor)));
    assert.equal((await db.query<{ count: number }>("select count from usage_daily where kind = 'comment'")).rows[0].count, 1);
    assert.ok((await db.query("select 1 from metric_counts where event = 'comment_generated'")).rows.length >= 1);
  });
});

test("the goal the person picked wins over the default", async () => {
  await world(async ({ db, token }) => {
    await fact(db, "A", "F1", "project", FACT_TEXT);
    const j = (await (await (await route()).POST(post(token, { selection: POST, goal: "freelancer" }))).json()) as { goal: string };
    assert.equal(j.goal, "freelancer");
  });
});

test("AE2a: no facts and no reaction is answered with a skip and spends no generation", async () => {
  await world(async ({ db, token }) => {
    const res = await (await route()).POST(post(token, { selection: POST }));
    const j = (await res.json()) as { status: string; reason: string };
    assert.equal(res.status, 200);
    assert.deepEqual([j.status, j.reason], ["skip", "no_input"]);
    assert.equal((await db.query("select 1 from usage_daily")).rows.length, 0);
  });
});

test("R4: a selection that can't be answered is a 400 with the plain message and spends nothing", async () => {
  await world(async ({ db, token }) => {
    await fact(db, "A", "F1", "project", FACT_TEXT);
    const res = await (await route()).POST(post(token, { selection: `${POST}\n…see more` }));
    assert.equal(res.status, 400);
    const j = (await res.json()) as { problem: string; error: string };
    assert.equal(j.problem, "see_more");
    assert.match(j.error, /see more/);
    assert.equal((await db.query("select 1 from usage_daily")).rows.length, 0);
  });
});

test("R20: the 11th generation in a day is a 429 with the cap text", async () => {
  await world(async ({ db, token }) => {
    await fact(db, "A", "F1", "project", FACT_TEXT);
    const { POST: handler } = await route();
    for (let i = 0; i < 10; i++) assert.equal((await handler(post(token, { selection: POST }))).status, 200, `call ${i + 1}`);
    const res = await handler(post(token, { selection: POST }));
    assert.equal(res.status, 429);
    assert.match(((await res.json()) as { error: string }).error, /today's comments/);
  });
});

test("KTD4: a target company and a fact that names one never reach the writer", async () => {
  await world(async ({ db, token }) => {
    // The only facts are a target company and a project that names it: nothing is safe in public, so nothing is written.
    await fact(db, "A", "F2", "target_company", "Swiggy");
    await fact(db, "A", "F3", "project", "Prepared for the Swiggy analytics interview next month.");
    const j = (await (await (await route()).POST(post(token, { selection: POST }))).json()) as { status: string; reason?: string };
    assert.deepEqual([j.status, j.reason], ["skip", "no_input"]);
    // A safe fact beside them is still used, and only it.
    await fact(db, "A", "F1", "project", FACT_TEXT);
    const k = (await (await (await route()).POST(post(token, { selection: POST }))).json()) as { options: { factRefs: string[]; body: string }[] };
    assert.ok(k.options.length >= 1 && k.options.every((o) => o.factRefs.every((r) => r === "F1") && !/Swiggy|interview/i.test(o.body)));
  });
});

test("another user's facts never reach the writer", async () => {
  await world(async ({ db, token }) => {
    await fact(db, "B", "F1", "project", "Secret project of the other user about payroll fraud detection.");
    const j = (await (await (await route()).POST(post(token, { selection: POST }))).json()) as { status: string; reason?: string };
    assert.deepEqual([j.status, j.reason], ["skip", "no_input"]);
  });
});

test("KTD1: a failing request writes no selection, reaction or author text to the console", async () => {
  await world(async ({ db, token }) => {
    await fact(db, "A", "F1", "project", FACT_TEXT);
    const seen: string[] = [];
    const orig = { log: console.log, error: console.error, warn: console.warn };
    console.log = console.error = console.warn = (...a: unknown[]) => { seen.push(a.map(String).join(" ")); };
    try {
      const saved = extDeps.db;
      extDeps.db = () => ({ query: async () => { throw new Error("boom Priya Shah wonder why the dashboard"); } }) as unknown as Db;
      const res = await (await route()).POST(post(token, { selection: POST, reaction: "my secret reaction" }));
      extDeps.db = saved;
      assert.ok(res.status >= 500 || res.status === 401);
    } finally { Object.assign(console, orig); }
    assert.ok(!seen.some((s) => /Priya|secret reaction|dashboard/.test(s)), seen.join("|"));
  });
});

test("/api/status reports the commenter switch", async () => {
  const { GET } = await import("../app/api/status/route");
  const save = process.env.LYNKR_COMMENTER;
  try {
    process.env.LYNKR_COMMENTER = "on";
    assert.equal(((await (await GET()).json()) as { commenter: string }).commenter, "on");
    process.env.LYNKR_COMMENTER = "off";
    assert.equal(((await (await GET()).json()) as { commenter: string }).commenter, "off");
  } finally { if (save === undefined) delete process.env.LYNKR_COMMENTER; else process.env.LYNKR_COMMENTER = save; }
});
