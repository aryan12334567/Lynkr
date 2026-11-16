// Route-level checks for Posts (posts plan U1 to U5): the switch, the session, the paywall, body caps, and the whole path in
// demo mode (open a slot, answer the interview, write versions, refine, edit by hand, go back). Handlers run for real over PGlite.
// The loader swaps lib/auth.ts for a stand-in that reads the user from `x-test-user` and lets lib/db.ts hand out the handle.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { pgliteDb, type Db } from "../lib/db";
import { putWeek } from "../lib/calendar/plan-store";
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
const MON = "2026-11-16";
const FACT = "Cleaned two years of fest feedback survey data in Excel before building the summary charts for the committee.";

async function world(run: (db: Db) => Promise<void>) {
  const pg = new PGlite();
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','a'),('B','b');`);
    for (const f of ["001_vertical1.sql", "002_outreach.sql", "003_posts.sql", "008_posts_publish.sql"]) await pg.exec(sql(f));
    const db = pgliteDb(pg) as Db;
    (globalThis as { __lynkrTestDb?: Db }).__lynkrTestDb = db;
    await putWeek(db, "A", MON, planForWeek(MON, { posts: 2, comments: 2, messages: 3 }));
    await db.query("insert into facts (user_id, fact_key, kind, text, status, use_in_drafts) values ('A','F1','project',$1,'confirmed',true)", [FACT]);
    await run(db);
  } finally { await pg.close(); }
}
const env = (vars: Record<string, string | undefined>) => {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { old[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  return () => { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } };
};
const call = (method: string, path: string, body?: unknown, user: string | null = "A") =>
  new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...(user ? { "x-test-user": user } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
const json = async <T = Record<string, unknown>,>(r: Response) => (await r.json()) as T;

const ANSWERS = [
  "I cleaned the fest feedback survey data in Excel before the committee asked for the summary charts.",
  "The committee had asked for a summary before the next meeting and the data was not ready yet.",
  "I found that the same students were counted twice because they had signed up for more than one event.",
];

test("every route answers 404 when the switch is not v2", async () => {
  const restore = env({ LYNKR_POSTS: "v1" });
  try {
    await world(async () => {
      const posts = await import("../app/api/posts/route");
      const interview = await import("../app/api/posts/interview/route");
      const versions = await import("../app/api/posts/versions/route");
      for (const r of [await posts.GET(call("GET", "/api/posts")), await posts.POST(call("POST", "/api/posts", {})), await posts.PATCH(call("PATCH", "/api/posts", {})), await posts.DELETE(call("DELETE", "/api/posts?id=x")), await interview.POST(call("POST", "/api/posts/interview", {})), await versions.POST(call("POST", "/api/posts/versions", {}))]) {
        assert.equal(r.status, 404);
        assert.equal((await json<{ error: string }>(r)).error, "Not found.");
      }
    });
  } finally { restore(); }
});

test("without a session every route answers 401", async () => {
  const restore = env({ LYNKR_POSTS: "v2" });
  try {
    await world(async () => {
      const posts = await import("../app/api/posts/route");
      const interview = await import("../app/api/posts/interview/route");
      const versions = await import("../app/api/posts/versions/route");
      for (const r of [await posts.GET(call("GET", "/api/posts", undefined, null)), await posts.POST(call("POST", "/api/posts", {}, null)), await interview.POST(call("POST", "/api/posts/interview", {}, null)), await versions.POST(call("POST", "/api/posts/versions", {}, null))]) assert.equal(r.status, 401);
    });
  } finally { restore(); }
});

test("with the paywall on, an unpaid account is told 402 on everything that writes or drafts, and may still read its own posts", async () => {
  const restore = env({ LYNKR_POSTS: "v2", LYNKR_PAYWALL: "1" });
  try {
    await world(async () => {
      const posts = await import("../app/api/posts/route");
      const interview = await import("../app/api/posts/interview/route");
      const versions = await import("../app/api/posts/versions/route");
      for (const r of [await posts.POST(call("POST", "/api/posts", { type: "proof", brief: "x" })), await posts.PATCH(call("PATCH", "/api/posts", { id: "x", brief: "y" })), await posts.DELETE(call("DELETE", "/api/posts?id=x")), await interview.POST(call("POST", "/api/posts/interview", { id: "x" })), await versions.POST(call("POST", "/api/posts/versions", { id: "x", mode: "generate" }))]) {
        assert.equal(r.status, 402);
        assert.equal((await json<{ code: string }>(r)).code, "subscription_required");
      }
      assert.equal((await posts.GET(call("GET", "/api/posts"))).status, 200);
    });
  } finally { restore(); }
});

test("a body over 16 KB is refused with 413 before it is parsed", async () => {
  const restore = env({ LYNKR_POSTS: "v2" });
  try {
    await world(async () => {
      const posts = await import("../app/api/posts/route");
      const interview = await import("../app/api/posts/interview/route");
      const versions = await import("../app/api/posts/versions/route");
      const big = { id: "x", brief: "y".repeat(17 * 1024) };
      assert.equal((await posts.POST(call("POST", "/api/posts", big))).status, 413);
      assert.equal((await posts.PATCH(call("PATCH", "/api/posts", big))).status, 413);
      assert.equal((await interview.POST(call("POST", "/api/posts/interview", big))).status, 413);
      assert.equal((await versions.POST(call("POST", "/api/posts/versions", big))).status, 413);
    });
  } finally { restore(); }
});

test("demo mode: open a slot, answer the interview, write versions, refine, edit by hand and go back", async () => {
  const restore = env({ LYNKR_POSTS: "v2", LYNKR_MOCK: "1", LYNKR_PAYWALL: undefined });
  try {
    await world(async (db) => {
      const posts = await import("../app/api/posts/route");
      const interview = await import("../app/api/posts/interview/route");
      const versions = await import("../app/api/posts/versions/route");

      const week = await json<{ slots: { index: number; type: string; brief: string; post: unknown }[] }>(await posts.GET(call("GET", `/api/posts?week=${MON}`)));
      assert.equal(week.slots.length, 2);
      assert.match(week.slots[0].brief, /fest feedback survey|Show one piece|Tell one thing|Share one thing/);
      assert.equal(week.slots[0].post, null);

      const created = await posts.POST(call("POST", "/api/posts", { weekStart: MON, slot: 0 }));
      assert.equal(created.status, 201);
      const { post } = await json<{ post: { id: string; status: string; brief: string } }>(created);
      assert.equal(post.status, "draft");
      const again = await json<{ post: { id: string } }>(await posts.POST(call("POST", "/api/posts", { weekStart: MON, slot: 0 })));
      assert.equal(again.post.id, post.id, "the slot's post is created once");

      // The interview: each answer returns the next question; a resume returns the question the person was on.
      let step = (await json<{ step: { kind: string; question?: { key: string } } }>(await interview.POST(call("POST", "/api/posts/interview", { id: post.id, answer: null })))).step;
      assert.equal(step.kind, "question");
      for (const a of ANSWERS) {
        const out = await json<{ step: { kind: string; question?: { key: string } }; answers: unknown[] }>(await interview.POST(call("POST", "/api/posts/interview", { id: post.id, key: step.question!.key, answer: a })));
        step = out.step;
      }
      assert.equal(step.kind, "done");
      const stale = await json<{ stale: boolean; answers: unknown[] }>(await interview.POST(call("POST", "/api/posts/interview", { id: post.id, key: "did", answer: "should not be stored" })));
      assert.equal(stale.answers.length, 3, "an answer to a question that is not the current one is not stored");

      const one = await json<{ post: { id: string }; answers: unknown[]; versions: unknown[]; interview: { kind: string } }>(await posts.GET(call("GET", `/api/posts?id=${post.id}`)));
      assert.equal(one.answers.length, 3);
      assert.equal(one.interview.kind, "done");

      const gen = await json<{ result: string; versions: { id: string; body: string; n: number }[] }>(await versions.POST(call("POST", "/api/posts/versions", { id: post.id, mode: "generate" })));
      assert.equal(gen.result, "versions");
      assert.ok(gen.versions.length >= 2);
      assert.ok(gen.versions.every((v) => !/\[\[|#|—|–/.test(v.body)));

      const ref = await json<{ result: string; version?: { id: string; n: number; instruction: string } }>(await versions.POST(call("POST", "/api/posts/versions", { id: post.id, mode: "refine", versionId: gen.versions[0].id, instruction: "shorter" })));
      assert.equal(ref.result, "refined");
      assert.equal(ref.version!.instruction, "shorter");

      const edit = await json<{ version: { n: number }; problems: { code: string }[] }>(await posts.PATCH(call("PATCH", "/api/posts", { id: post.id, text: "I cleaned the data and it saved 40% of my time. #win" })));
      assert.ok(edit.problems.map((p) => p.code).includes("hashtag"));

      const back = await json<{ post: { currentVersionId: string } }>(await posts.PATCH(call("PATCH", "/api/posts", { id: post.id, versionId: gen.versions[0].id })));
      assert.equal(back.post.currentVersionId, gen.versions[0].id);
      const all = await json<{ versions: unknown[] }>(await posts.GET(call("GET", `/api/posts?id=${post.id}`)));
      assert.equal(all.versions.length, gen.versions.length + 2, "every version is kept");

      const approved = await json<{ post: { status: string } }>(await posts.PATCH(call("PATCH", "/api/posts", { id: post.id, status: "approved" })));
      assert.equal(approved.post.status, "approved");
      const noScheduling = await posts.PATCH(call("PATCH", "/api/posts", { id: post.id, status: "published" }));
      assert.equal(noScheduling.status, 400, "only draft and approved can be set from here");

      // Another account sees and changes nothing.
      assert.equal((await posts.GET(call("GET", `/api/posts?id=${post.id}`, undefined, "B"))).status, 404);
      assert.equal((await posts.PATCH(call("PATCH", "/api/posts", { id: post.id, brief: "x" }, "B"))).status, 404);
      assert.equal((await posts.DELETE(call("DELETE", `/api/posts?id=${post.id}`, undefined, "B"))).status, 404);
      assert.equal((await versions.POST(call("POST", "/api/posts/versions", { id: post.id, mode: "generate" }, "B"))).status, 404);
      assert.equal((await interview.POST(call("POST", "/api/posts/interview", { id: post.id, answer: null }, "B"))).status, 404);

      assert.equal((await posts.DELETE(call("DELETE", `/api/posts?id=${post.id}`))).status, 200);
      assert.equal((await db.query("select 1 from post_versions")).rows.length, 0);
    });
  } finally { restore(); }
});

test("a free-write post with a blank brief asks for the topic first, and thin answers end with an honest stop and no versions", async () => {
  const restore = env({ LYNKR_POSTS: "v2", LYNKR_MOCK: "1" });
  try {
    await world(async () => {
      const posts = await import("../app/api/posts/route");
      const interview = await import("../app/api/posts/interview/route");
      const versions = await import("../app/api/posts/versions/route");
      const { post } = await json<{ post: { id: string } }>(await posts.POST(call("POST", "/api/posts", { type: "setback", brief: "" })));
      let step = (await json<{ step: { kind: string; reason?: string; question?: { key: string } } }>(await interview.POST(call("POST", "/api/posts/interview", { id: post.id, answer: null })))).step;
      assert.equal(step.question?.key, "topic");
      for (let i = 0; i < 6 && step.kind === "question"; i++) {
        step = (await json<{ step: typeof step }>(await interview.POST(call("POST", "/api/posts/interview", { id: post.id, key: step.question!.key, answer: "Excel work" })))).step;
      }
      assert.equal(step.kind, "done");
      assert.equal(step.reason, "thin");
      const gen = await json<{ result: string; stop?: boolean }>(await versions.POST(call("POST", "/api/posts/versions", { id: post.id, mode: "generate" })));
      assert.equal(gen.result, "need_more");
      assert.equal(gen.stop, true);
    });
  } finally { restore(); }
});

test("drafting is capped at 20 a day per person, and the provider failing gives the try back", async () => {
  const restore = env({ LYNKR_POSTS: "v2", LYNKR_MOCK: "1" });
  try {
    await world(async (db) => {
      const posts = await import("../app/api/posts/route");
      const versions = await import("../app/api/posts/versions/route");
      const { post } = await json<{ post: { id: string } }>(await posts.POST(call("POST", "/api/posts", { type: "proof", brief: "x" })));
      await db.query("insert into usage_daily (user_id, day, kind, count) values ('A', (now() at time zone 'Asia/Kolkata')::date, 'post_draft', 20)");
      const r = await versions.POST(call("POST", "/api/posts/versions", { id: post.id, mode: "generate" }));
      assert.equal(r.status, 429);
    });
  } finally { restore(); }
});

test("when the provider fails the person gets a plain error, no version is stored, and the day's try is given back", async () => {
  const restore = env({ LYNKR_POSTS: "v2", LYNKR_MOCK: undefined, LLM_BASE_URL: "http://127.0.0.1:9", LLM_API_KEY: "test", LLM_MODEL: "test", OPENAI_API_KEY: undefined });
  try {
    await world(async (db) => {
      const posts = await import("../app/api/posts/route");
      const interview = await import("../app/api/posts/interview/route");
      const versions = await import("../app/api/posts/versions/route");
      const { post } = await json<{ post: { id: string } }>(await posts.POST(call("POST", "/api/posts", { type: "proof", brief: "Fest survey" })));
      await interview.POST(call("POST", "/api/posts/interview", { id: post.id, key: "did", answer: ANSWERS[0] }));
      const r = await versions.POST(call("POST", "/api/posts/versions", { id: post.id, mode: "generate" }));
      assert.ok(r.status >= 500, `status ${r.status}`);
      assert.equal(typeof (await json<{ error: string }>(r)).error, "string");
      assert.equal((await db.query("select 1 from post_versions")).rows.length, 0);
      const used = await db.query<{ count: number }>("select count from usage_daily where user_id = 'A' and kind = 'post_draft'");
      assert.equal(Number(used.rows[0]?.count ?? 0), 0);
    });
  } finally { restore(); }
});
