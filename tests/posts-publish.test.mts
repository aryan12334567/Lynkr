// Posts scheduling and publishing (posts plan U7, U8, U9, U16). Everything runs over PGlite with a stub fetch and a stub
// mailer: nothing here reaches LinkedIn or an email service. The loader stub is the one in tests/posts-routes.test.mts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { pgliteDb, type Db } from "../lib/db";
import { addVersion, createPost, getPost, updatePost, type Post } from "../lib/posts/db";
import { escapeCommentary, connectionStatus, LINKEDIN_API_VERSION } from "../lib/posts/linkedin";
import { markPosted, postsOwner, setSchedule } from "../lib/posts/schedule";
import { runDue } from "../lib/posts/run";
import { moveItem } from "../lib/calendar/move";
import { buildFeed } from "../lib/calendar/feed";
import { postFeedItems } from "../lib/calendar/sources";
import { planForWeek } from "../lib/plan";
import { listFeedPosts } from "../lib/posts/db";

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
const NOW = new Date("2026-11-16T06:00:00Z");
const at = (mins: number) => new Date(NOW.getTime() + mins * 60_000);
const TEXT = "I cleaned the fest feedback survey data in Excel before the committee asked for the summary charts.";
const TOKEN = "AQV-secret-token-value-123";

async function world(run: (db: Db) => Promise<void>) {
  const pg = new PGlite();
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text, email text); insert into "user" values ('A','a','a@test.local'),('B','b','b@test.local');
      create table "account" (id text primary key, "accountId" text not null, "providerId" text not null, "userId" text not null, "accessToken" text, "accessTokenExpiresAt" timestamptz, "scope" text, "updatedAt" timestamptz default now());`);
    for (const f of ["001_vertical1.sql", "002_outreach.sql", "003_posts.sql", "008_posts_publish.sql"]) await pg.exec(sql(f));
    const db = pgliteDb(pg) as Db;
    (globalThis as { __lynkrTestDb?: Db }).__lynkrTestDb = db;
    await run(db);
  } finally { await pg.close(); }
}
const env = (vars: Record<string, string | undefined>) => {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { old[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  return () => { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } };
};
const connect = (db: Db, user = "A", opts: { scope?: string; expires?: Date } = {}) =>
  db.query(`insert into "account" (id, "accountId", "providerId", "userId", "accessToken", "accessTokenExpiresAt", "scope") values ($1, 'member123', 'linkedin', $2, $3, $4, $5)`,
    [`acc-${user}`, user, TOKEN, (opts.expires ?? at(60 * 24 * 30)).toISOString(), opts.scope ?? "openid,profile,email,w_member_social"]);
async function approved(db: Db, user = "A", body = TEXT): Promise<Post> {
  const p = await createPost(db, user, { type: "proof", brief: TEXT, mode: "quick" });
  await addVersion(db, user, p.id, { body, why: "", factRefs: [], answerRefs: [], source: "manual" });
  return (await updatePost(db, user, p.id, { status: "approved" }))!;
}
const status = async (db: Db, id: string) => (await getPost(db, "A", id))!;
function fetchStub(answer: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return answer(); }) as unknown as typeof fetch;
  return { f, calls };
}
const created = () => new Response(null, { status: 201, headers: { "x-restli-id": "urn:li:share:777" } });
/** Schedules the post for 10 minutes ahead in auto mode, then moves the clock past it. */
async function dueAuto(db: Db) {
  await connect(db);
  const p = await approved(db);
  const s = await setSchedule(db, "A", p.id, at(10), { now: NOW });
  assert.ok(s.ok && s.post.publishMode === "auto");
  return p;
}
const later = (mins: number) => at(10 + mins);

test("the escaper puts a backslash before every reserved character", () => {
  assert.equal(escapeCommentary("a|b{c}d@e[f]g(h)i<j>k#l*m_n~o\\p"), "a\\|b\\{c\\}d\\@e\\[f\\]g\\(h\\)i\\<j\\>k\\#l\\*m\\_n\\~o\\\\p");
  assert.equal(escapeCommentary("plain words, a full stop."), "plain words, a full stop.");
});

test("schedule rules: approved only, 5 minutes to 90 days, clean text", async () => {
  await world(async (db) => {
    const draft = await createPost(db, "A", { type: "proof", brief: TEXT, mode: "quick" });
    assert.deepEqual(await setSchedule(db, "A", draft.id, at(60), { now: NOW }), { ok: false, status: 409, error: "Approve the post before you schedule it." });
    const p = await approved(db);
    const soon = await setSchedule(db, "A", p.id, at(3), { now: NOW });
    assert.ok(!soon.ok && soon.status === 400);
    const past = await setSchedule(db, "A", p.id, at(-60), { now: NOW });
    assert.ok(!past.ok && past.status === 400);
    const far = await setSchedule(db, "A", p.id, at(91 * 24 * 60), { now: NOW });
    assert.ok(!far.ok && far.status === 400);
    const bad = await approved(db, "A", "I cleaned 99 rows of data and wrote #hashtag text here.");
    const refused = await setSchedule(db, "A", bad.id, at(60), { now: NOW });
    assert.ok(!refused.ok && refused.status === 409 && (refused.problems ?? []).length > 0);
    assert.equal((await status(db, bad.id)).status, "approved");
    const ok = await setSchedule(db, "A", p.id, at(60), { now: NOW });
    assert.ok(ok.ok && ok.post.status === "scheduled" && ok.post.scheduledAt === at(60).toISOString());
  });
});

test("manual mode without a connection or with the switch off; auto only when it can publish", async () => {
  await world(async (db) => {
    let restore = env({ LYNKR_AUTOPUBLISH: undefined });
    try {
      const a = await approved(db);
      const m = await setSchedule(db, "A", a.id, at(60), { now: NOW });
      assert.ok(m.ok && m.post.publishMode === "manual");
      await connect(db);
      const stillOff = await setSchedule(db, "A", a.id, at(61), { now: NOW });
      assert.ok(stillOff.ok && stillOff.post.publishMode === "manual", "switch off: manual even when connected");
    } finally { restore(); }
    restore = env({ LYNKR_AUTOPUBLISH: "on" });
    try {
      const b = await approved(db);
      const auto = await setSchedule(db, "A", b.id, at(60), { now: NOW });
      assert.ok(auto.ok && auto.post.publishMode === "auto");
      assert.deepEqual(await connectionStatus(db, "A", NOW), { autopublish: true, connected: true, canPublish: true, expiresAt: at(60 * 24 * 30).toISOString() });
      assert.equal((await connectionStatus(db, "B", NOW)).canPublish, false);
      await db.query(`update "account" set "scope" = 'openid,profile,email'`);
      assert.equal((await connectionStatus(db, "A", NOW)).canPublish, false, "no write scope");
      await db.query(`update "account" set "scope" = 'w_member_social', "accessTokenExpiresAt" = $1`, [at(-1).toISOString()]);
      assert.equal((await connectionStatus(db, "A", NOW)).canPublish, false, "expired token");
    } finally { restore(); }
  });
});

test("cancel returns a scheduled post to approved, never one that is publishing", async () => {
  await world(async (db) => {
    const p = await approved(db);
    await setSchedule(db, "A", p.id, at(60), { now: NOW });
    const c = await setSchedule(db, "A", p.id, null, { now: NOW });
    assert.ok(c.ok && c.post.status === "approved" && c.post.scheduledAt === null && c.post.publishMode === null);
    const again = await setSchedule(db, "A", p.id, null, { now: NOW });
    assert.ok(!again.ok && again.status === 409);
    await db.query("update posts set status = 'publishing' where id = $1::uuid", [p.id]);
    const busy = await setSchedule(db, "A", p.id, null, { now: NOW });
    assert.deepEqual(busy, { ok: false, status: 409, error: "Publishing now" });
    assert.equal((await status(db, p.id)).status, "publishing");
  });
});

test("markPosted: from approved or a manual reminder, not from an auto schedule", async () => {
  await world(async (db) => {
    const a = await approved(db);
    const m = await markPosted(db, "A", a.id, NOW);
    assert.ok(m.ok && m.post.status === "published" && m.post.publishMode === "manual" && m.post.publishedAt === NOW.toISOString());
    const b = await approved(db);
    await setSchedule(db, "A", b.id, at(60), { now: NOW });
    const m2 = await markPosted(db, "A", b.id, NOW);
    assert.ok(m2.ok && m2.post.status === "published");
    const restore = env({ LYNKR_AUTOPUBLISH: "on" });
    try {
      await connect(db);
      const c = await approved(db);
      await setSchedule(db, "A", c.id, at(60), { now: NOW });
      const refused = await markPosted(db, "A", c.id, NOW);
      assert.ok(!refused.ok && refused.status === 409);
    } finally { restore(); }
    const d = await createPost(db, "A", { type: "proof", brief: TEXT, mode: "quick" });
    const notYet = await markPosted(db, "A", d.id, NOW);
    assert.ok(!notYet.ok && notYet.status === 409);
  });
});

test("the exact LinkedIn request, and no token anywhere we return or print", async () => {
  await world(async (db) => {
    const restore = env({ LYNKR_AUTOPUBLISH: "on", LINKEDIN_API_VERSION: undefined });
    const logs: string[] = [];
    const saved = { log: console.log, info: console.info, warn: console.warn, error: console.error };
    for (const k of Object.keys(saved) as (keyof typeof saved)[]) console[k] = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
    try {
      const body = "I cleaned the fest data (twice) in Excel_v2 before the committee asked for charts.";
      await connect(db);
      const p = await approved(db);
      assert.ok((await setSchedule(db, "A", p.id, at(10), { now: NOW })).ok);
      await db.query("update post_versions set body = $2 where post_id = $1::uuid", [p.id, body]);
      const { f, calls } = fetchStub(created);
      const counts = await runDue({ db, now: later(1), fetch: f, send: async () => {} });
      assert.deepEqual(counts, { claimed: 1, published: 1, failed: 0, unknown: 0, late: 0 });
      assert.equal(calls.length, 1);
      const c = calls[0];
      assert.equal(c.url, "https://api.linkedin.com/rest/posts");
      assert.equal(c.init.method, "POST");
      assert.deepEqual(c.init.headers, { Authorization: `Bearer ${TOKEN}`, "LinkedIn-Version": LINKEDIN_API_VERSION, "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" });
      assert.ok(c.init.signal instanceof AbortSignal);
      assert.deepEqual(JSON.parse(c.init.body as string), {
        author: "urn:li:person:member123",
        commentary: "I cleaned the fest data \\(twice\\) in Excel\\_v2 before the committee asked for charts.",
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      });
      const after = await status(db, p.id);
      assert.equal(after.status, "published");
      assert.equal(after.linkedinUrn, "urn:li:share:777");
      assert.ok(after.publishedAt);
      const seen = JSON.stringify([after, counts, await connectionStatus(db, "A", NOW), postFeedItems([after], { paid: true })]);
      assert.ok(!seen.includes(TOKEN) && !seen.includes("member123"));
      assert.ok(!logs.join("\n").includes(TOKEN));
    } finally { Object.assign(console, saved); restore(); }
  });
});

test("the run publishes once; a second run, and two overlapping runs, send nothing more", async () => {
  await world(async (db) => {
    const restore = env({ LYNKR_AUTOPUBLISH: "on" });
    try {
      const p = await dueAuto(db);
      const { f, calls } = fetchStub(created);
      const [r1, r2] = await Promise.all([runDue({ db, now: later(1), fetch: f, send: async () => {} }), runDue({ db, now: later(1), fetch: f, send: async () => {} })]);
      assert.equal(r1.claimed + r2.claimed, 1);
      assert.equal(calls.length, 1);
      const r3 = await runDue({ db, now: later(5), fetch: f, send: async () => {} });
      assert.deepEqual(r3, { claimed: 0, published: 0, failed: 0, unknown: 0, late: 0 });
      assert.equal(calls.length, 1);
      assert.equal((await status(db, p.id)).status, "published");
    } finally { restore(); }
  });
});

test("a definite refusal fails; a timeout, 5xx or 429 is unknown and never retried", async () => {
  await world(async (db) => {
    const restore = env({ LYNKR_AUTOPUBLISH: "on" });
    try {
      const sent: string[] = [];
      const send = async (_to: string, s: string) => { sent.push(s); };
      for (const [name, answer, want, reason] of [
        ["4xx", () => new Response("secret provider text", { status: 422 }), "failed", "rejected"],
        ["401", () => new Response(null, { status: 401 }), "failed", "auth"],
        ["5xx", () => new Response(null, { status: 503 }), "unknown", "no_answer"],
        ["429", () => new Response(null, { status: 429 }), "unknown", "no_answer"],
        ["timeout", () => { throw new DOMException("timed out", "TimeoutError"); }, "unknown", "no_answer"],
      ] as const) {
        await db.query("delete from posts");
        await db.query("delete from usage_daily");
        await db.query(`delete from "account"`);
        const p = await dueAuto(db);
        const { f, calls } = fetchStub(answer);
        const r = await runDue({ db, now: later(1), fetch: f, send });
        assert.equal(r.claimed, 1, name);
        assert.equal(r[want], 1, name);
        const row = await status(db, p.id);
        assert.equal(row.status, want, name);
        assert.equal(row.failReason, reason, name);
        await runDue({ db, now: later(30), fetch: f, send });
        assert.equal(calls.length, 1, `${name}: never retried`);
      }
      assert.ok(sent.includes("We could not confirm your post. Check LinkedIn before trying again."));
      assert.ok(sent.every((s) => !s.includes(TEXT) && !s.includes("secret")), "no post text or provider text in a notice");
    } finally { restore(); }
  });
});

test("a post stuck publishing becomes unknown and is not published again", async () => {
  await world(async (db) => {
    const restore = env({ LYNKR_AUTOPUBLISH: "on" });
    try {
      const p = await dueAuto(db);
      await db.query("update posts set status = 'publishing', claimed_at = $2 where id = $1::uuid", [p.id, later(0).toISOString()]);
      const { f, calls } = fetchStub(created);
      const early = await runDue({ db, now: later(5), fetch: f, send: async () => {} });
      assert.equal(early.unknown, 0, "under 10 minutes it is left alone");
      const r = await runDue({ db, now: later(11), fetch: f, send: async () => {} });
      assert.equal(r.unknown, 1);
      assert.equal((await status(db, p.id)).status, "unknown");
      assert.equal(calls.length, 0);
    } finally { restore(); }
  });
});

test("more than 6 hours late is failed 'late' and is not published", async () => {
  await world(async (db) => {
    const restore = env({ LYNKR_AUTOPUBLISH: "on" });
    try {
      const p = await dueAuto(db);
      const { f, calls } = fetchStub(created);
      const r = await runDue({ db, now: later(6 * 60 + 1), fetch: f, send: async () => {} });
      assert.deepEqual(r, { claimed: 0, published: 0, failed: 0, unknown: 0, late: 1 });
      const row = await status(db, p.id);
      assert.equal(row.status, "failed");
      assert.equal(row.failReason, "late");
      assert.equal(calls.length, 0);
    } finally { restore(); }
  });
});

test("manual posts are never sent, and with autopublish off nothing is sent even for an auto row", async () => {
  await world(async (db) => {
    let restore = env({ LYNKR_AUTOPUBLISH: "on" });
    let auto: Post;
    try {
      const manual = await approved(db);
      await setSchedule(db, "A", manual.id, at(10), { now: NOW });
      assert.equal((await status(db, manual.id)).publishMode, "manual");
      const { f, calls } = fetchStub(created);
      assert.equal((await runDue({ db, now: later(5), fetch: f, send: async () => {} })).claimed, 0);
      assert.equal(calls.length, 0);
      auto = await dueAuto(db);
    } finally { restore(); }
    restore = env({ LYNKR_AUTOPUBLISH: undefined });
    try {
      const { f, calls } = fetchStub(created);
      const r = await runDue({ db, now: later(5), fetch: f, send: async () => {} });
      assert.deepEqual(r, { claimed: 0, published: 0, failed: 0, unknown: 0, late: 0 });
      assert.equal(calls.length, 0);
      assert.equal((await status(db, auto.id)).status, "scheduled");
    } finally { restore(); }
  });
});

test("the run route refuses without the cron secret and answers counts with it", async () => {
  await world(async (db) => {
    const restore = env({ CRON_SECRET: "a-long-enough-secret-value", LYNKR_AUTOPUBLISH: undefined });
    try {
      const { GET } = await import("../app/api/posts/run/route");
      assert.equal((await GET(new Request("http://x/api/posts/run"))).status, 401);
      assert.equal((await GET(new Request("http://x/api/posts/run", { headers: { authorization: "Bearer wrong-wrong-wrong-wrong" } }))).status, 401);
      const ok = await GET(new Request("http://x/api/posts/run", { headers: { authorization: "Bearer a-long-enough-secret-value" } }));
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { claimed: 0, published: 0, failed: 0, unknown: 0, late: 0 });
      process.env.CRON_SECRET = "short";
      assert.equal((await GET(new Request("http://x/api/posts/run", { headers: { authorization: "Bearer short" } }))).status, 401);
    } finally { restore(); }
    void db;
  });
});

test("the Calendar shows post items with the right words and moves a scheduled one", async () => {
  await world(async (db) => {
    const restore = env({ LYNKR_AUTOPUBLISH: "on" });
    try {
      await connect(db);
      const sched = await approved(db);
      await setSchedule(db, "A", sched.id, at(60 * 24), { now: NOW });
      const rem = await approved(db);
      await setSchedule(db, "A", rem.id, at(60 * 48), { now: NOW });
      await db.query("update posts set publish_mode = 'manual' where id = $1::uuid", [rem.id]);
      const mk = async (st: string) => { const p = await approved(db); await db.query("update posts set status = $2, scheduled_at = $3 where id = $1::uuid", [p.id, st, at(60 * 72).toISOString()]); return p.id; };
      const pub = await mk("publishing"), done = await mk("published"), bad = await mk("failed"), chk = await mk("unknown");
      const posts = await listFeedPosts(db, "A", at(0), at(60 * 24 * 10));
      const feed = buildFeed({ weeks: [], steps: null, posts, posted: null, currentWeek: "2026-11-16", access: { paid: true }, from: "2026-11-16", to: "2026-11-30", sources: { plan: "ok", outreach: "off", posts: "ok", comments: "off" } });
      const by = (id: string) => feed.items.find((i) => i.id === `post:${id}`)!;
      assert.deepEqual([by(sched.id), by(rem.id), by(pub), by(done), by(bad), by(chk)].map((i) => [i.status, i.statusText, i.movable]), [
        ["scheduled", "Scheduled", true], ["scheduled", "Reminder set", true], ["scheduled", "Publishing now", false], ["done", "Posted", false], ["failed", "Failed", false], ["check", "Check LinkedIn", false],
      ]);
      assert.ok(feed.items.every((i) => i.owner === "post" && i.kind === "post" && i.href === "#app/posts" && i.gated));
      assert.equal(by(sched.id).day, "2026-11-17");
      const owner = postsOwner(db, { now: () => NOW });
      const ctx = { paid: true, now: NOW, posts: owner };
      const moved = await moveItem(db, "A", { op_id: "op-12345678", id: `post:${sched.id}`, day: "2026-11-20", time: "10:30" }, ctx);
      assert.equal(moved.status, 200);
      assert.equal((await status(db, sched.id)).scheduledAt, "2026-11-20T05:00:00.000Z");
      const replay = await moveItem(db, "A", { op_id: "op-12345678", id: `post:${sched.id}`, day: "2026-11-25", time: "10:30" }, ctx);
      assert.equal(replay.status, 200);
      assert.equal(replay.body.replayed, true);
      assert.equal((await status(db, sched.id)).scheduledAt, "2026-11-20T05:00:00.000Z");
      const busy = await moveItem(db, "A", { op_id: "op-87654321", id: `post:${pub}`, day: "2026-11-20", time: "10:30" }, ctx);
      assert.equal(busy.status, 409);
      assert.equal(busy.body.error, "Publishing now");
      assert.equal((await moveItem(db, "A", { op_id: "op-aaaaaaaa", id: `post:${sched.id}`, day: "2026-11-20", time: "10:30" }, { ...ctx, paid: false })).status, 402);
    } finally { restore(); }
  });
});

test("a plan post slot is taken over by the post opened from it", async () => {
  await world(async (db) => {
    const plan = planForWeek("2026-11-16", { posts: 2, comments: 0, messages: 0 });
    const slot = plan.items.find((i) => i.kind === "post")!;
    const p = await createPost(db, "A", { type: "proof", brief: TEXT, mode: "quick", weekStart: "2026-11-16", slotIndex: Number(slot.id.split("-")[1]) });
    await addVersion(db, "A", p.id, { body: TEXT, why: "", factRefs: [], answerRefs: [], source: "manual" });
    await updatePost(db, "A", p.id, { status: "approved" });
    await setSchedule(db, "A", p.id, at(60 * 24), { now: NOW });
    const posts = await listFeedPosts(db, "A", at(0), at(60 * 24 * 10));
    const feed = buildFeed({ weeks: [{ plan, why: null, label: null }], steps: null, posts, posted: null, currentWeek: "2026-11-16", access: { paid: true }, from: "2026-11-16", to: "2026-11-22", sources: { plan: "ok", outreach: "off", posts: "ok", comments: "off" } });
    const item = feed.items.find((i) => i.id === `post:${p.id}`)!;
    assert.equal(item.fills, `plan:2026-11-16:${slot.id}`);
    assert.ok(!feed.items.some((i) => i.id === `plan:2026-11-16:${slot.id}`));
    assert.equal(feed.items.filter((i) => i.kind === "post").length, 2);
  });
});

test("user B cannot schedule, cancel, mark or move user A's post", async () => {
  await world(async (db) => {
    const p = await approved(db);
    const s = await setSchedule(db, "B", p.id, at(60), { now: NOW });
    assert.ok(!s.ok && s.status === 404);
    await setSchedule(db, "A", p.id, at(60), { now: NOW });
    const c = await setSchedule(db, "B", p.id, null, { now: NOW });
    assert.ok(!c.ok && c.status === 404);
    const m = await markPosted(db, "B", p.id, NOW);
    assert.ok(!m.ok && m.status === 404);
    const mv = await moveItem(db, "B", { op_id: "op-bbbbbbbb", id: `post:${p.id}`, day: "2026-11-20" }, { paid: true, now: NOW, posts: postsOwner(db, { now: () => NOW }) });
    assert.equal(mv.status, 404);
    const row = await status(db, p.id);
    assert.equal(row.status, "scheduled");
    assert.equal(row.scheduledAt, at(60).toISOString());
  });
});

test("a scheduled post cannot be edited or refined until its schedule is cancelled", async () => {
  const { saveText, refineForPost } = await import("../lib/posts/serve");
  await world(async (db) => {
    const post = await approved(db);
    const before = (await status(db, post.id)).currentVersionId;
    const at = new Date(Date.now() + 3 * 3_600_000);
    assert.equal((await setSchedule(db, "A", post.id, at)).ok, true);
    assert.deepEqual(await saveText(db, "A", post.id, "A different text that was never approved."), { kind: "locked" });
    assert.equal((await refineForPost(db, "A", post.id, { instruction: "shorter" })).kind, "locked");
    assert.equal((await status(db, post.id)).currentVersionId, before, "what will be posted is what was approved");
    assert.equal((await setSchedule(db, "A", post.id, null)).ok, true);
    assert.equal((await saveText(db, "A", post.id, "Edited after cancelling the schedule, which is allowed.")).kind, "saved");
  });
});
