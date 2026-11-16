// Security and privacy follow-ups from the audit (dimension 4). No network; PGlite for the database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readJson } from "../lib/http";
import { createExtensionToken } from "../lib/outreach/contacts-db";
import { extDeps, extensionAuth, newToken } from "../lib/outreach/ext-auth";
import type { Db } from "../lib/db";

/** A body sent in chunks with no Content-Length, which a declared-size check never sees. Counts how much was pulled. */
function chunked(totalBytes: number, chunk = 1024) {
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) return controller.close();
      const n = Math.min(chunk, totalBytes - sent);
      sent += n;
      controller.enqueue(new Uint8Array(n).fill(120)); // "x"
    },
  });
  const req = new Request("http://x/api", { method: "POST", body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
  return { req, sent: () => sent };
}

test("an oversized body with no Content-Length is refused without being read to the end", async () => {
  const big = chunked(5 * 1024 * 1024);
  const out = await readJson(big.req, 4096);
  assert.ok("error" in out);
  assert.equal((out as { error: Response }).error.status, 413);
  assert.ok(big.sent() < 64 * 1024, `read ${big.sent()} bytes of a 5 MB body before refusing`);
});

test("a body inside the cap is still parsed, with or without a declared length", async () => {
  const withLength = await readJson(new Request("http://x/api", { method: "POST", body: JSON.stringify({ a: "é".repeat(100) }) }), 4096);
  assert.deepEqual("body" in withLength && withLength.body, { a: "é".repeat(100) });
  const text = JSON.stringify({ ok: true });
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new TextEncoder().encode(text)); c.close(); } });
  const noLength = await readJson(new Request("http://x/api", { method: "POST", body: stream, duplex: "half" } as RequestInit & { duplex: "half" }), 4096);
  assert.deepEqual("body" in noLength && noLength.body, { ok: true });
  const bad = await readJson(new Request("http://x/api", { method: "POST", body: "{not json" }), 4096);
  assert.equal("error" in bad && bad.error.status, 400);
});

test("using only the extension counts as being active, so the 12-month cleanup does not remove a person who never opens the site", async () => {
  const pg = new PGlite();
  const saved = { ...extDeps };
  const prev = process.env.LYNKR_PAYWALL;
  process.env.LYNKR_PAYWALL = "0";
  try {
    await pg.exec(`create table "user" (id text primary key, "dodoCustomerId" text); insert into "user" values ('A','custA');
      create table ext_tokens (id text primary key, user_id text not null references "user"(id), token_hash text not null, created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz, last_used_at timestamptz);
      create table lynkr_user (user_id text primary key, last_active_at timestamptz not null default now());
      insert into lynkr_user values ('A', now() - interval '11 months');`);
    const db: Db = { query: async (sql, params) => ({ rows: (await pg.query(sql, params)).rows as never[] }), transaction: async (fn) => fn(db) } as Db;
    const raw = newToken();
    await createExtensionToken(db, "A", raw);
    extDeps.ready = async () => true;
    extDeps.db = () => db;
    const out = await extensionAuth(new Request("https://lynkr.test/api/ext/contacts", { headers: { authorization: `Bearer ${raw}` } }));
    assert.ok("userId" in out, JSON.stringify(out));
    const row = await pg.query<{ fresh: boolean }>("select last_active_at > now() - interval '1 minute' as fresh from lynkr_user where user_id = 'A'");
    assert.equal(row.rows[0].fresh, true, "last_active_at was not updated by an extension call");
  } finally {
    Object.assign(extDeps, saved);
    if (prev === undefined) delete process.env.LYNKR_PAYWALL; else process.env.LYNKR_PAYWALL = prev;
    await pg.close();
  }
});
