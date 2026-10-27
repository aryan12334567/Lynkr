// The preview never falls back to the production database (lib/dbUrl.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseUrl, databaseUrlUnpooled } from "../lib/dbUrl";

const KEYS = ["VERCEL_ENV", "DATABASE_URL", "DATABASE_URL_UNPOOLED", "LYNKR_DATABASE_URL", "LYNKR_DATABASE_URL_UNPOOLED"] as const;
function withEnv(env: Partial<Record<(typeof KEYS)[number], string>>, fn: () => void) {
  const prev = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  try {
    fn();
  } finally {
    for (const k of KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

test("production uses the integration's DATABASE_URL", () =>
  withEnv({ VERCEL_ENV: "production", DATABASE_URL: "postgres://prod/pooled", DATABASE_URL_UNPOOLED: "postgres://prod/direct" }, () => {
    assert.equal(databaseUrl(), "postgres://prod/pooled");
    assert.equal(databaseUrlUnpooled(), "postgres://prod/direct");
  }));

test("a preview with its own branch uses it, never production", () =>
  withEnv({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://prod/pooled", LYNKR_DATABASE_URL: "postgres://branch/pooled", LYNKR_DATABASE_URL_UNPOOLED: "postgres://branch/direct" }, () => {
    assert.equal(databaseUrl(), "postgres://branch/pooled");
    assert.equal(databaseUrlUnpooled(), "postgres://branch/direct");
  }));

test("a preview without its own branch gets no database at all", () =>
  withEnv({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://prod/pooled", DATABASE_URL_UNPOOLED: "postgres://prod/direct" }, () => {
    assert.equal(databaseUrl(), undefined);
    assert.equal(databaseUrlUnpooled(), undefined);
  }));
