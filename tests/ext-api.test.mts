import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { addContact, createExtensionToken, revokeExtensionToken } from "../lib/outreach/contacts-db";
import { corsHeaders, extDeps, hashToken, newToken, tokenOwner, sameSiteRequest } from "../lib/outreach/ext-auth";
import type { Db } from "../lib/db";

// The route files import "@/lib/...", as Next.js resolves it. Map it to the app root for node --test.
register("data:text/javascript," + encodeURIComponent(`
const root = ${JSON.stringify(new URL("../", import.meta.url).href)};
export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);
  const href = root + specifier.slice(2);
  try { return await next(href, context); } catch { return next(href + ".ts", context); }
}`));

test("extension tokens are hashed, scoped, expire, and revoke", async () => {
 const pg = new PGlite();
 try {
  await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','custA'),('B','custB');
   create table ext_tokens (id text primary key, user_id text not null references "user"(id), token_hash text not null, created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz, last_used_at timestamptz);`);
  const db: Db = { query: async (sql, params) => ({ rows: (await pg.query(sql, params)).rows as never[] }) };
  const raw = newToken(); const record = await createExtensionToken(db, "A", raw);
  const stored = await pg.query<{ token_hash: string; id: string }>("select id, token_hash from ext_tokens");
  assert.notEqual(stored.rows[0].token_hash, raw); assert.equal(stored.rows[0].token_hash, hashToken(raw)); assert.notEqual(stored.rows[0].id, raw);
  assert.deepEqual(await tokenOwner(db, raw), { userId: "A", customerId: "custA" });
  assert.equal(await tokenOwner(db, newToken()), null);
  assert.equal(await revokeExtensionToken(db, "B", record.id), null);
  assert.ok(await revokeExtensionToken(db, "A", record.id)); assert.equal(await tokenOwner(db, raw), null);
  const old = newToken(); const expired = await createExtensionToken(db, "A", old);
  await db.query("update ext_tokens set expires_at = now() - interval '1 day' where id = $1", [expired.id]);
  assert.equal(await tokenOwner(db, old), null);
 } finally { await pg.close(); }
});

test("CORS allows only the pinned extension origin", () => {
 const previous = process.env.LYNKR_EXT_ID; process.env.LYNKR_EXT_ID = "a".repeat(32);
 try {
  const allowed = new Request("https://lynkr.test/api/ext/contacts", { headers: { origin: `chrome-extension://${"a".repeat(32)}` } });
  const other = new Request("https://lynkr.test/api/ext/contacts", { headers: { origin: `chrome-extension://${"b".repeat(32)}` } });
  assert.equal(corsHeaders(allowed).get("access-control-allow-origin"), `chrome-extension://${"a".repeat(32)}`);
  assert.equal(corsHeaders(other).get("access-control-allow-origin"), null);
 } finally { if (previous === undefined) delete process.env.LYNKR_EXT_ID; else process.env.LYNKR_EXT_ID = previous; }
});

test("cookie-authenticated mutations refuse cross-origin requests", () => {
 assert.equal(sameSiteRequest(new Request("https://lynkr.test/api/ext/pair", { method: "POST", headers: { origin: "https://evil.test" } })), false);
 assert.equal(sameSiteRequest(new Request("https://lynkr.test/api/ext/pair", { method: "POST", headers: { origin: "https://lynkr.test" } })), true);
});

// ---------------------------------------------------------------------------------------------
// The real route handlers, on a real (PGlite) database
// ---------------------------------------------------------------------------------------------

const EXT = "a".repeat(32);
const ORIGIN = `chrome-extension://${EXT}`;
const URLS = "https://lynkr.test/api/ext";
const person = { name: "Alice Rao", bridge: "public_work", goal: "job", intent: "learn_role", tier: "tier_1", company: "Acme", role: "Analyst" } as const;

type World = { pg: PGlite; db: Db; as: { user: string | null }; paid: Set<string> };
async function world(run: (w: World) => Promise<void>, env: Record<string, string | undefined> = {}) {
 const pg = new PGlite();
 const keys = ["LYNKR_EXT_ID", "LYNKR_PAYWALL", "LYNKR_MOCK", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "LLM_PROVIDER", "LYNKR_PROVIDER"];
 const before = Object.fromEntries(keys.map(k => [k, process.env[k]]));
 const saved = { ...extDeps };
 try {
  await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','custA'),('B','custB');`);
  await pg.exec(readFileSync(new URL("../scripts/migrations/001_vertical1.sql", import.meta.url), "utf8"));
  await pg.exec(readFileSync(new URL("../scripts/migrations/002_outreach.sql", import.meta.url), "utf8"));
  await pg.exec(readFileSync(new URL("../scripts/migrations/005_outreach_timeline.sql", import.meta.url), "utf8"));
  const db: Db = { query: async (sql, params) => ({ rows: (await pg.query(sql, params)).rows as never[] }) };
  const as: { user: string | null } = { user: null };
  const paid = new Set(["custA", "custB"]);
  Object.assign(process.env, { LYNKR_EXT_ID: EXT, LYNKR_PAYWALL: "1", LYNKR_MOCK: "1" }, env);
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
  extDeps.db = () => db;
  extDeps.ready = async () => true;
  extDeps.session = async () => (as.user ? { id: as.user, email: `${as.user}@x.test`, dodoCustomerId: `cust${as.user}` } : null);
  extDeps.subscribed = async (c) => !!c && paid.has(c);
  await run({ pg, db, as, paid });
 } finally {
  Object.assign(extDeps, saved);
  for (const k of keys) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
  await pg.close();
 }
}
const call = (path: string, token: string | null, init: { body?: unknown; origin?: string | null } = {}) =>
 new Request(`${URLS}/${path}`, {
  method: init.body === undefined ? "GET" : "POST",
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init.origin === null ? {} : { origin: init.origin ?? ORIGIN }) },
  body: init.body === undefined ? undefined : JSON.stringify(init.body),
 });
const route = async (name: string) => import(`../app/api/ext/${name}/route`);

test("no token, a wrong token, an expired token and a revoked token each get 401", async () => {
 await world(async ({ db }) => {
  const { GET } = await route("contacts");
  assert.equal((await GET(call("contacts", null))).status, 401);
  assert.equal((await GET(call("contacts", newToken()))).status, 401);
  assert.equal((await GET(call("contacts", "not a token"))).status, 401);
  const raw = newToken(); const rec = await createExtensionToken(db, "A", raw);
  assert.equal((await GET(call("contacts", raw))).status, 200);
  await db.query("update ext_tokens set expires_at = now() - interval '1 second' where id = $1", [rec.id]);
  assert.equal((await GET(call("contacts", raw))).status, 401);
  const live = newToken(); const rec2 = await createExtensionToken(db, "A", live);
  await revokeExtensionToken(db, "A", rec2.id);
  assert.equal((await GET(call("contacts", live))).status, 401);
 });
});

test("a lapsed subscription gets 402 with an upgrade message on every token route", async () => {
 await world(async ({ db, paid }) => {
  const raw = newToken(); await createExtensionToken(db, "A", raw);
  const c = await addContact(db, "A", person);
  paid.delete("custA");
  for (const [name, body] of [["contacts", undefined], ["draft", { contactId: c.id }], ["profile", { contactId: c.id, profileUrl: "https://www.linkedin.com/in/alice/" }]] as const) {
   const mod = await route(name);
   const res = await (body === undefined ? mod.GET : mod.POST)(call(name, raw, { body }));
   assert.equal(res.status, 402, name);
   const j = await res.json() as { error: string };
   assert.match(j.error, /subscription/i); assert.match(j.error, /upgrade/i);
  }
  assert.equal((await db.query("select 1 from outreach_daily_usage")).rows.length, 0);
  paid.add("custA");
  assert.equal((await (await route("contacts")).GET(call("contacts", raw))).status, 200);
 });
});

test("token A cannot read or draft for user B's contacts", async () => {
 await world(async ({ db }) => {
  const a = newToken(); await createExtensionToken(db, "A", a);
  const b = newToken(); await createExtensionToken(db, "B", b);
  const mine = await addContact(db, "A", { ...person, name: "Mine" });
  const theirs = await addContact(db, "B", { ...person, name: "Theirs" });
  const { GET } = await route("contacts");
  const list = await (await GET(call("contacts", a))).json() as { contacts: { id: string }[] };
  assert.deepEqual(list.contacts.map(x => x.id), [mine.id]);
  const draft = await route("draft");
  assert.equal((await draft.POST(call("draft", a, { body: { contactId: theirs.id } }))).status, 404);
  assert.equal((await draft.POST(call("draft", b, { body: { contactId: theirs.id } }))).status, 200);
  const profile = await route("profile");
  assert.equal((await profile.POST(call("profile", a, { body: { contactId: theirs.id, profileUrl: "https://www.linkedin.com/in/x/" } }))).status, 404);
 });
});

test("contact responses carry only what the panel shows", async () => {
 await world(async ({ db }) => {
  const raw = newToken(); await createExtensionToken(db, "A", raw);
  await addContact(db, "A", { ...person, whyText: "private reason", whySource: "manual", brief: { facts: [{ text: "secret fact" }] } });
  const text = await (await (await route("contacts")).GET(call("contacts", raw))).text();
  const [c] = (JSON.parse(text) as { contacts: Record<string, unknown>[] }).contacts;
  assert.deepEqual(Object.keys(c).sort(), ["company", "goal", "id", "intent", "name", "profileUrl", "relationship", "role", "status", "tier"]);
  assert.ok(!/private reason|secret fact|userId/.test(text));
 });
});

test("an origin other than the pinned extension gets no CORS allowance", async () => {
 await world(async ({ db }) => {
  const raw = newToken(); await createExtensionToken(db, "A", raw);
  const mod = await route("contacts");
  const ok = await mod.GET(call("contacts", raw));
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
  const other = await mod.GET(call("contacts", raw, { origin: `chrome-extension://${"b".repeat(32)}` }));
  assert.equal(other.status, 403); assert.equal(other.headers.get("access-control-allow-origin"), null);
  const web = await mod.GET(call("contacts", raw, { origin: "https://evil.test" }));
  assert.equal(web.status, 403); assert.equal(web.headers.get("access-control-allow-origin"), null);
  const pre = mod.OPTIONS(new Request(`${URLS}/contacts`, { method: "OPTIONS", headers: { origin: "https://evil.test" } }));
  assert.equal(pre.status, 403); assert.equal(pre.headers.get("access-control-allow-origin"), null);
  assert.equal(mod.OPTIONS(new Request(`${URLS}/contacts`, { method: "OPTIONS", headers: { origin: ORIGIN } })).status, 204);
 });
 await world(async ({ db }) => {
  const raw = newToken(); await createExtensionToken(db, "A", raw);
  delete process.env.LYNKR_EXT_ID;
  assert.equal((await (await route("contacts")).GET(call("contacts", raw))).headers.get("access-control-allow-origin"), null);
 });
});

test("pairing needs a signed-in, paid, same-site session; the token is returned once, stored hashed and never logged", async () => {
 await world(async ({ pg, as, paid }) => {
  const logged: string[] = [];
  const names = ["log", "info", "warn", "error", "debug"] as const;
  const orig = names.map(n => console[n]);
  names.forEach(n => { console[n] = (...a: unknown[]) => { logged.push(a.map(String).join(" ")); }; });
  const pair = await route("pair"); const revoke = await route("revoke"); const contacts = await route("contacts");
  const post = (origin?: string) => new Request(`${URLS}/pair`, { method: "POST", headers: origin ? { origin } : {}, body: "{}" });
  let token = "", id = "", list = "";
  try {
   assert.equal((await pair.POST(post())).status, 401);
   as.user = "A"; paid.delete("custA");
   assert.equal((await pair.POST(post())).status, 402);
   paid.add("custA");
   assert.equal((await pair.POST(post("https://evil.test"))).status, 403);
   const res = await pair.POST(post("https://lynkr.test")); assert.equal(res.status, 200);
   ({ token, id } = await res.json() as { token: string; id: string });
   list = await (await revoke.GET(new Request(`${URLS}/revoke`))).text();
   assert.equal((await contacts.GET(call("contacts", token))).status, 200);
  } finally { names.forEach((n, i) => { console[n] = orig[i] as never; }); }
  const stored = await pg.query<{ token_hash: string }>("select token_hash from ext_tokens");
  assert.equal(stored.rows.length, 1);
  assert.equal(stored.rows[0].token_hash, hashToken(token)); assert.notEqual(stored.rows[0].token_hash, token);
  assert.ok(!list.includes(token) && !list.includes(stored.rows[0].token_hash)); assert.ok(list.includes(id));
  assert.ok(!logged.join("\n").includes(token));
 });
});

test("revoking from My data stops the next call, and only for the owner", async () => {
 await world(async ({ db, as }) => {
  const raw = newToken(); const rec = await createExtensionToken(db, "A", raw);
  const contacts = await route("contacts"); const revoke = await route("revoke");
  assert.equal((await contacts.GET(call("contacts", raw))).status, 200);
  const rev = (id: string, origin = "https://lynkr.test") => new Request(`${URLS}/revoke`, { method: "POST", headers: { origin }, body: JSON.stringify({ id }) });
  as.user = "B";
  assert.deepEqual(await (await revoke.POST(rev(rec.id))).json(), { revoked: false });
  assert.equal((await contacts.GET(call("contacts", raw))).status, 200);
  as.user = "A";
  assert.equal((await revoke.POST(rev(rec.id, "https://evil.test"))).status, 403);
  assert.deepEqual(await (await revoke.POST(rev(rec.id))).json(), { revoked: true });
  assert.equal((await contacts.GET(call("contacts", raw))).status, 401);
 });
});

test("the My data panel offers a Revoke control wired to the revoke route", () => {
 const src = readFileSync(new URL("../components/MyData.tsx", import.meta.url), "utf8");
 assert.match(src, /\/api\/ext\/revoke/); assert.match(src, /Revoke/);
});

test("the draft route uses the shared engine: complete versions, notes left, nothing of its own", async () => {
 await world(async ({ db }) => {
  const raw = newToken(); await createExtensionToken(db, "A", raw);
  const c = await addContact(db, "A", person);
  const draft = await route("draft");
  const res = await draft.POST(call("draft", raw, { body: { contactId: c.id } }));
  assert.equal(res.status, 200);
  const j = await res.json() as { versions: { body: string }[] };
  assert.ok(j.versions.length >= 2); assert.ok(j.versions.every(v => v.body.length > 20 && !/\[\[|\]\]|TODO/.test(v.body)));
  const note = await (await draft.POST(call("draft", raw, { body: { contactId: c.id, channel: "connection_note" } }))).json() as { notesLeft?: number };
  assert.equal(typeof note.notesLeft, "number");
  assert.equal((await draft.POST(call("draft", raw, { body: { contactId: c.id, extra: 1 } }))).status, 400);
  const src = readFileSync(new URL("../app/api/ext/draft/route.ts", import.meta.url), "utf8");
  assert.match(src, /runDraft\(/); assert.ok(!/recordAISpend|generateOutreach|confirmedFacts/.test(src));
 });
});

test("the daily cap is a plain 429 from the extension draft route", async () => {
 await world(async ({ db, pg }) => {
  const raw = newToken(); await createExtensionToken(db, "A", raw);
  const c = await addContact(db, "A", person);
  await pg.query("insert into outreach_daily_usage (user_id, day, chat_model_calls) values ('A', (now() at time zone 'Asia/Kolkata')::date, 60)");
  const res = await (await route("draft")).POST(call("draft", raw, { body: { contactId: c.id } }));
  assert.equal(res.status, 429);
  assert.match(((await res.json()) as { error: string }).error, /limit|used/i);
  assert.equal((await pg.query<{ n: number }>("select chat_model_calls as n from outreach_daily_usage")).rows[0].n, 60);
 }, { LYNKR_MOCK: undefined, ANTHROPIC_API_KEY: "test-key-never-called", OPENAI_API_KEY: undefined });
});

test("the profile route saves only LinkedIn profile addresses", async () => {
 await world(async ({ db }) => {
  const raw = newToken(); await createExtensionToken(db, "A", raw);
  const c = await addContact(db, "A", person);
  const profile = await route("profile");
  const ok = await profile.POST(call("profile", raw, { body: { contactId: c.id, profileUrl: "https://www.linkedin.com/in/Alice-Rao?utm=1" } }));
  assert.equal(ok.status, 200); assert.equal(((await ok.json()) as { contact: { profileUrl: string } }).contact.profileUrl, "https://www.linkedin.com/in/alice-rao/");
  assert.equal((await profile.POST(call("profile", raw, { body: { contactId: c.id, profileUrl: "https://www.linkedin.com/feed/" } }))).status, 400);
 });
});
