import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createExtensionToken, revokeExtensionToken } from "../lib/outreach/contacts-db";
import { corsHeaders, hashToken, newToken, tokenOwner, sameSiteRequest } from "../lib/outreach/ext-auth";
import type { Db } from "../lib/db";

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
