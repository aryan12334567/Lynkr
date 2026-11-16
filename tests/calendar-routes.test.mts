// Route-level checks for the Calendar (review follow-ups): the move route's paywall and failure answers, the feed's
// query count and rate limit, and the plan chat's move handling under the Calendar switch. Handlers run for real over PGlite.
// The loader swaps lib/auth.ts for a stand-in that reads the user from `x-test-user` and lets lib/db.ts hand out the handle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { pgliteDb, type Db } from "../lib/db";
import { moveItem } from "../lib/calendar/move";
import { getWeek, putWeek } from "../lib/calendar/plan-store";
import { calendarFeed } from "../lib/calendar/server";
import { addDays, mondayOf, todayIST } from "../lib/ist";
import { planForWeek } from "../lib/plan";

const href = (p: string) => new URL(p, import.meta.url).href;
const root = href("../");
const authStub = `export const accountsConfigured = () => true;
export async function sessionUser(req) { const id = req.headers.get("x-test-user"); return id ? { id, email: id + "@test.local", dodoCustomerId: null } : null; }`;
const dbStub = `export * from ${JSON.stringify(href("../lib/db.ts"))};
export const getDb = () => globalThis.__lynkrTestDb;
export const cloudReady = async () => true;`;
register("data:text/javascript," + encodeURIComponent(`
const root = ${JSON.stringify(root)};
const authUrl = ${JSON.stringify(href("../lib/auth.ts"))}, dbUrl = ${JSON.stringify(href("../lib/db.ts"))};
const stub = (src) => "data:text/javascript," + encodeURIComponent(src);
export async function resolve(specifier, context, next) {
  let r;
  if (specifier.startsWith("@/")) { const h = root + specifier.slice(2); try { r = await next(h, context); } catch { r = await next(h + ".ts", context); } }
  else r = await next(specifier, context);
  if (context.parentURL && context.parentURL.startsWith("data:")) return r;
  if (r.url === authUrl) return { ...r, url: stub(${JSON.stringify(authStub)}), shortCircuit: true };
  if (r.url === dbUrl) return { ...r, url: stub(${JSON.stringify(dbStub)}), shortCircuit: true };
  return r;
}`));

const sql = (name: string) => readFileSync(new URL(`../scripts/migrations/${name}`, import.meta.url), "utf8");
// Next Monday, so every day in the week is still ahead whatever day the tests run on.
const MON = addDays(mondayOf(todayIST()), 7);
const WED = addDays(MON, 2);
const THU = addDays(MON, 3);
let n = 0;
const op = () => `op-${++n}-${"x".repeat(8)}`;

async function world(run: (db: Db) => Promise<void>) {
  const pg = new PGlite();
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','a'),('B','b');`);
    for (const f of ["001_vertical1.sql", "002_outreach.sql", "005_outreach_timeline.sql"]) await pg.exec(sql(f));
    const db = pgliteDb(pg) as Db;
    (globalThis as { __lynkrTestDb?: Db }).__lynkrTestDb = db;
    assert.ok(await putWeek(db, "A", MON, planForWeek(MON)));
    await run(db);
  } finally { await pg.close(); }
}
const env = (vars: Record<string, string | undefined>) => {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { old[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  return () => { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } };
};
const post = (path: string, body: unknown, user = "A", headers: Record<string, string> = {}) =>
  new Request("http://x" + path, { method: "POST", headers: { "content-type": "application/json", "x-test-user": user, ...headers }, body: JSON.stringify(body) });

test("RT1 a plan move that keeps losing the race says so after three tries and changes nothing", async () => {
  await world(async (db) => {
    const before = await getWeek(db, "A", MON);
    const slot = before!.items.find((i) => i.kind === "post")!;
    let tries = 0;
    const racing = { ...db, query: async (text: string, params?: unknown[]) => { if (/^\s*update plan_items/i.test(text)) { tries++; return { rows: [] }; } return db.query(text, params as never); } } as Db;
    const r = await moveItem(racing, "A", { op_id: op(), id: `plan:${MON}:${slot.id}`, day: slot.day === WED ? THU : WED }, { paid: false });
    assert.equal(r.status, 409);
    assert.match(String(r.body.error), /changed while moving/);
    assert.equal(tries, 3, "three attempts, then it stops");
    assert.deepEqual(await getWeek(db, "A", MON), before, "the stored week is untouched");
  });
});

test("RT2 when Posts throws, a post move answers 503 instead of crashing the route", async () => {
  await world(async (db) => {
    const posts = { reschedule: async () => { throw new Error("posts down"); } };
    const r = await moveItem(db, "A", { op_id: op(), id: "post:p1", day: WED }, { paid: true, posts });
    assert.equal(r.status, 503);
    assert.match(String(r.body.error), /Posts/);
  });
});

test("RT3 the move route asks the licence for outreach and post items, and lets a plan slot through", async () => {
  const restore = env({ LYNKR_CALENDAR: "v2", LYNKR_PAYWALL: "1" });
  try {
    await world(async (db) => {
      const { POST } = await import("../app/api/calendar/move/route");
      const slot = (await getWeek(db, "A", MON))!.items.find((i) => i.kind === "post")!;
      const outreach = await POST(post("/api/calendar/move", { op_id: op(), id: "outreach:00000000-0000-0000-0000-000000000000", day: WED }));
      assert.equal(outreach.status, 402);
      assert.equal(((await outreach.json()) as { code: string }).code, "subscription_required");
      const posted = await POST(post("/api/calendar/move", { op_id: op(), id: "post:p1", day: WED }));
      assert.equal(posted.status, 402);
      const plan = await POST(post("/api/calendar/move", { op_id: op(), id: `plan:${MON}:${slot.id}`, day: slot.day === WED ? THU : WED }));
      assert.equal(plan.status, 200, "a free account can move its own plan slot");
      const nobody = await POST(new Request("http://x/api/calendar/move", { method: "POST", body: "{}" }));
      assert.equal(nobody.status, 401);
    });
  } finally { restore(); }
});

test("RT4 the feed reads the weeks it shows in one query, not one per week", async () => {
  await world(async (db) => {
    let weekReads = 0;
    const counting = { ...db, query: async (text: string, params?: unknown[]) => { if (/from plan_items/i.test(text) && /item_key/i.test(text) && !/like/i.test(text)) weekReads++; return db.query(text, params as never); } } as Db;
    await calendarFeed(counting, "A", { from: addDays(todayIST(), -30), to: addDays(todayIST(), 150), paid: false, switches: { outreach: false, commenter: false, posts: false } });
    assert.ok(weekReads <= 1, `${weekReads} week queries`);
  });
});

test("RT5 the feed route limits each signed-in person, not each address: a shared college connection is not locked out", async () => {
  const restore = env({ LYNKR_CALENDAR: "v2", LYNKR_CALENDAR_PER_HOUR: "5" });
  try {
    await world(async () => {
      const { GET } = await import("../app/api/calendar/route");
      const ask = (user?: string) => GET(new Request("http://x/api/calendar", { headers: { "x-forwarded-for": "203.0.113.77", ...(user ? { "x-test-user": user } : {}) } }));
      let status = 0;
      for (let i = 0; i < 12 && status !== 429; i++) status = (await ask("A")).status;
      assert.equal(status, 429, "person A hit the limit");
      assert.notEqual((await ask("B")).status, 429, "person B, on the same address, is not affected");
      assert.equal((await ask()).status, 401, "a request with no session is refused, not rate-limited");
    });
  } finally { restore(); }
});

test("RT6 with the Calendar on v1, 'move Thursday's post to Friday' is not treated as a move", async () => {
  const restore = env({ LYNKR_CALENDAR: "v1", LYNKR_MOCK: "1" });
  try {
    await world(async () => {
      const { POST } = await import("../app/api/plan/route");
      const counts = { posts: 2, comments: 1, messages: 2 };
      const times = { post: "09:00", comment: "12:30", message: "10:30" };
      const r = await POST(post("/api/plan", { text: "move Thursday's post to Friday", counts, times, weekStart: MON }));
      const body = (await r.json()) as { understood: boolean; reply: string; moved?: boolean };
      assert.equal(body.moved, undefined, "nothing was moved");
      assert.equal(body.understood, false);
      assert.doesNotMatch(body.reply, /Sign in to move/, "no misleading sign-in prompt on a screen that has no moves");
    });
  } finally { restore(); }
});
