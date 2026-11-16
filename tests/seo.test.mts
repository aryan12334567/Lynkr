// Landing page, SEO and sharing (audit dimension 8).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isIndexable, PRODUCTION_URL, publicUrl } from "../lib/public-url";
import robots from "../app/robots";
import sitemap from "../app/sitemap";

const withEnv = <T,>(vars: Record<string, string | undefined>, run: () => T): T => {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { old[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return run(); } finally { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } }
};

test("the real site is indexed and lists its public pages", () => {
  withEnv({ BETTER_AUTH_URL: PRODUCTION_URL, RENDER_EXTERNAL_HOSTNAME: undefined }, () => {
    assert.equal(isIndexable(), true);
    const r = robots();
    assert.equal(r.sitemap, `${PRODUCTION_URL}/sitemap.xml`);
    const rule = (Array.isArray(r.rules) ? r.rules : [r.rules])[0];
    assert.ok((rule.disallow as string[]).includes("/api/"));
    const urls = sitemap().map((u) => u.url);
    assert.deepEqual(urls, [PRODUCTION_URL, `${PRODUCTION_URL}/privacy`, `${PRODUCTION_URL}/terms`, `${PRODUCTION_URL}/refunds`, `${PRODUCTION_URL}/contact`]);
  });
});

test("a preview or tester deployment asks search engines to stay out", () => {
  withEnv({ BETTER_AUTH_URL: "https://lynkr-preview.onrender.com" }, () => {
    assert.equal(publicUrl(), "https://lynkr-preview.onrender.com");
    assert.equal(isIndexable(), false);
    const rule = (Array.isArray(robots().rules) ? (robots().rules as { disallow?: unknown }[]) : [robots().rules as { disallow?: unknown }])[0];
    assert.equal(rule.disallow, "/");
  });
  withEnv({ BETTER_AUTH_URL: undefined, RENDER_EXTERNAL_HOSTNAME: "x.onrender.com" }, () => assert.equal(isIndexable(), false));
});
