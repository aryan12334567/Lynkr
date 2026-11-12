import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { createExtensionToken, addContact } from "../lib/outreach/contacts-db";
import { extDeps, newToken } from "../lib/outreach/ext-auth";
import { deleteAll, exportAll, pgliteDb, type Db } from "../lib/db";
import { signReceipt, verifyReceipt, RECEIPT_TTL_MS } from "../lib/comment/receipt";
import { countPostedSince, listPosted, purgeOld, recordFromReceipt, removeEntry, setPosted, DAILY_LOG_WRITES } from "../lib/comment/log";
import { cleanup } from "../lib/cleanup";

register("data:text/javascript," + encodeURIComponent(`
const root = ${JSON.stringify(new URL("../", import.meta.url).href)};
export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);
  const href = root + specifier.slice(2);
  try { return await next(href, context); } catch { return next(href + ".ts", context); }
}`));

process.env.BETTER_AUTH_SECRET ||= "test-secret-for-receipts-0123456789";
const F: { userId: string; authorName: string; authorHeadline: string; body: string; goal: "job_seeker"; angle: "experience"; source: "extension" } = { userId: "A", authorName: "Priya Shah", authorHeadline: "Data Lead", body: "A comment body that is long enough to be a comment, honestly.", goal: "job_seeker", angle: "experience", source: "extension" };

test("receipts: valid, forged, expired, other user's and mismatched bodies", () => {
  const r = signReceipt(F);
  assert.ok(verifyReceipt(r, F.body, "A"));
  assert.equal(verifyReceipt(r, F.body + "!", "A"), null, "body must match");
  assert.equal(verifyReceipt(r, F.body, "B"), null, "another user");
  assert.equal(verifyReceipt(r, F.body, "A", Date.now() + RECEIPT_TTL_MS + 1000), null, "expired");
  const [data, sig] = r.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(data, "base64url").toString()), goal: "freelancer" })).toString("base64url");
  assert.equal(verifyReceipt(`${forged}.${sig}`, F.body, "A"), null, "edited payload");
  assert.equal(verifyReceipt("garbage", F.body, "A"), null);
  assert.equal(verifyReceipt(`${data}.${sig.slice(0, -2)}xx`, F.body, "A"), null);
});

async function pgWorld(run: (db: Db, pg: PGlite) => Promise<void>) {
  const pg = new PGlite();
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','custA'),('B','custB');`);
    for (const m of ["001_vertical1", "002_outreach", "005_outreach_timeline", "004_comments"]) await pg.exec(readFileSync(new URL(`../scripts/migrations/${m}.sql`, import.meta.url), "utf8"));
    await run(pgliteDb(pg), pg);
  } finally { await pg.close(); }
}
const rec = async (db: Db, user = "A", body = F.body) => {
  const v = verifyReceipt(signReceipt({ ...F, userId: user, body }), body, user)!;
  return recordFromReceipt(db, user, v, body);
};

test("migration 004 runs twice cleanly", async () => {
  await pgWorld(async (_db, pg) => { await pg.exec(readFileSync(new URL("../scripts/migrations/004_comments.sql", import.meta.url), "utf8")); });
});

test("one row per receipt; an Insert then a Copy of the same option updates one row", async () => {
  await pgWorld(async (db) => {
    const v = verifyReceipt(signReceipt(F), F.body, "A")!;
    const a = await recordFromReceipt(db, "A", v, F.body);
    const b = await recordFromReceipt(db, "A", v, F.body);
    assert.equal(a?.id, b?.id);
    assert.equal((await db.query("select 1 from comment_log")).rows.length, 1);
    assert.equal(a?.authorName, "Priya Shah");
    assert.equal(a?.posted, null);
  });
});

test("isolation: user B cannot read, mark or delete user A's rows", async () => {
  await pgWorld(async (db) => {
    const e = (await rec(db))!;
    assert.equal(await setPosted(db, "B", e.id, true), null);
    assert.equal(await removeEntry(db, "B", e.id), false);
    assert.equal((await setPosted(db, "A", e.id, true))?.posted, true);
    assert.deepEqual((await listPosted(db, "B")).length, 0);
    assert.equal((await listPosted(db, "A")).length, 1);
  });
});

test("only posted entries are listed and counted (AE9)", async () => {
  await pgWorld(async (db) => {
    const a = (await rec(db, "A", F.body + " one"))!, b = (await rec(db, "A", F.body + " two"))!;
    await rec(db, "A", F.body + " three");
    await setPosted(db, "A", a.id, true); await setPosted(db, "A", b.id, true);
    assert.equal(await countPostedSince(db, "A", new Date(Date.now() - 86400000)), 2);
    assert.equal((await listPosted(db, "A")).length, 2);
    assert.equal(await countPostedSince(db, "A", new Date(Date.now() + 86400000)), 0);
  });
});

test("the 61st log write in a day is refused", async () => {
  await pgWorld(async (db) => {
    for (let i = 0; i < DAILY_LOG_WRITES; i++) assert.ok(await rec(db, "A", `${F.body} ${i}`));
    assert.equal(await rec(db, "A", `${F.body} extra`), null);
  });
});

test("retention: unposted after 7 days, posted kept until 12 months", async () => {
  await pgWorld(async (db) => {
    const old = (await rec(db, "A", F.body + " a"))!, oldPosted = (await rec(db, "A", F.body + " b"))!, ancient = (await rec(db, "A", F.body + " c"))!, fresh = (await rec(db, "A", F.body + " d"))!;
    await setPosted(db, "A", oldPosted.id, true); await setPosted(db, "A", ancient.id, true);
    await db.query("update comment_log set created_at = now() - interval '8 days' where id::text = $1", [old.id]);
    await db.query("update comment_log set created_at = now() - interval '11 months' where id::text = $1", [oldPosted.id]);
    await db.query("update comment_log set created_at = now() - interval '13 months' where id::text = $1", [ancient.id]);
    assert.equal(await purgeOld(db), 2);
    const left = (await db.query<{ id: string }>("select id::text as id from comment_log")).rows.map((r) => r.id).sort();
    assert.deepEqual(left, [oldPosted.id, fresh.id].sort());
    // The daily cleanup runs the same purge.
    await db.query("update comment_log set created_at = now() - interval '9 days' where id::text = $1", [fresh.id]);
    const out = await cleanup(db, { dryRun: false });
    assert.ok(out.rows >= 1);
    assert.equal((await db.query("select 1 from comment_log where id::text = $1", [fresh.id])).rows.length, 0);
  });
});

test("export includes the log, Delete my data removes it, and deleting a contact only clears the link", async () => {
  await pgWorld(async (db) => {
    const e = (await rec(db))!;
    const c = await addContact(db, "A", { name: "Priya Shah", bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1", company: "Swiggy", role: "Lead" } as never);
    await db.query("update comment_log set contact_id = $1 where id::text = $2", [c.id, e.id]);
    await db.query("delete from contacts where id = $1", [c.id]);
    assert.equal((await db.query<{ contact_id: string | null }>("select contact_id from comment_log")).rows[0].contact_id, null);
    const out = (await exportAll(db, "A")) as { comment_log?: unknown[] };
    assert.equal(out.comment_log?.length, 1);
    assert.equal((await deleteAll(db, "A")).comment_log, 1);
    assert.equal((await db.query("select 1 from comment_log")).rows.length, 0);
  });
});

// ---- the extension routes ----

const EXT = "a".repeat(32);
const ORIGIN = `chrome-extension://${EXT}`;
async function routeWorld(run: (w: { db: Db; token: string; paid: Set<string> }) => Promise<void>) {
  const saved = { ...extDeps };
  const keys = ["LYNKR_EXT_ID", "LYNKR_PAYWALL", "LYNKR_COMMENTER"];
  const before = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  await pgWorld(async (db) => {
    Object.assign(process.env, { LYNKR_EXT_ID: EXT, LYNKR_PAYWALL: "1", LYNKR_COMMENTER: "on" });
    const paid = new Set(["custA", "custB"]);
    extDeps.db = () => db; extDeps.ready = async () => true; extDeps.subscribed = async (c) => !!c && paid.has(c);
    const token = newToken(); await createExtensionToken(db, "A", token);
    try { await run({ db, token, paid }); } finally {
      Object.assign(extDeps, saved);
      for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
    }
  });
}
const req = (method: string, token: string, body: unknown) => new Request("https://lynkr.test/api/ext/comment-log", { method, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, origin: ORIGIN }, body: JSON.stringify(body) });

test("AE10: a forged, reused-for-another-body or garbage receipt gets 400 and writes nothing; a good one logs once", async () => {
  await routeWorld(async ({ db, token }) => {
    const { POST } = await import("../app/api/ext/comment-log/route");
    const good = signReceipt(F);
    assert.equal((await POST(req("POST", token, { receipt: "x".repeat(40), body: F.body }))).status, 400);
    assert.equal((await POST(req("POST", token, { receipt: good, body: F.body + " changed" }))).status, 400);
    assert.equal((await POST(req("POST", token, { receipt: signReceipt({ ...F, userId: "B" }), body: F.body }))).status, 400, "another user's receipt");
    assert.equal((await db.query("select 1 from comment_log")).rows.length, 0);
    const first = await POST(req("POST", token, { receipt: good, body: F.body, via: "insert" }));
    assert.equal(first.status, 200);
    assert.equal((await POST(req("POST", token, { receipt: good, body: F.body, via: "copy" }))).status, 200);
    assert.equal((await db.query("select 1 from comment_log")).rows.length, 1);
    assert.equal((await db.query("select 1 from comment_log where author_name = 'Priya Shah' and goal = 'job_seeker'")).rows.length, 1);
  });
});

test("PATCH sets posted on the caller's own row only; a lapsed token gets 402", async () => {
  await routeWorld(async ({ db, token, paid }) => {
    const { POST, PATCH } = await import("../app/api/ext/comment-log/route");
    const id = ((await (await POST(req("POST", token, { receipt: signReceipt(F), body: F.body }))).json()) as { entry: { id: string } }).entry.id;
    const other = (await rec(db, "B", F.body + " b"))!;
    assert.equal((await PATCH(req("PATCH", token, { id: other.id, posted: true }))).status, 404);
    assert.equal((await PATCH(req("PATCH", token, { id, posted: true }))).status, 200);
    assert.equal((await db.query<{ posted: boolean }>("select posted from comment_log where id::text = $1", [id])).rows[0].posted, true);
    paid.delete("custA");
    assert.equal((await PATCH(req("PATCH", token, { id, posted: false }))).status, 402);
    assert.equal((await POST(req("POST", token, { receipt: signReceipt({ ...F }), body: F.body }))).status, 402);
  });
});

test("the options route attaches receipts that the log accepts", async () => {
  await routeWorld(async ({ db, token }) => {
    process.env.LYNKR_MOCK = "1";
    await db.query("insert into facts (user_id, fact_key, kind, text, status, use_in_drafts) values ('A','F1','project','Cleaned two years of fest feedback survey data in Excel before charting.','confirmed',true)");
    const post = "Priya Shah\nData Lead at Swiggy\n2d •\nMost teams skip cleaning the survey data and then wonder why the dashboard is wrong.\nWe fixed the inputs first, and the report time dropped.";
    const res = await (await import("../app/api/ext/comment/route")).POST(new Request("https://lynkr.test/api/ext/comment", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}`, origin: ORIGIN }, body: JSON.stringify({ selection: post }) }));
    const j = (await res.json()) as { options: { body: string; receipt?: string }[] };
    assert.ok(j.options[0].receipt);
    const { POST } = await import("../app/api/ext/comment-log/route");
    assert.equal((await POST(req("POST", token, { receipt: j.options[0].receipt, body: j.options[0].body }))).status, 200);
    const row = (await db.query<{ author_name: string }>("select author_name from comment_log")).rows[0];
    assert.equal(row.author_name, "Priya Shah");
    delete process.env.LYNKR_MOCK;
  });
});
