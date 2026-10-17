// Apify enrichment plan U2: the adapter, with the network replaced by a fake. No paid runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { actorInput, apifyEnabled, fetchPageViaApify, FetchError, pageFunctionSource } from "../lib/apify";
import { checkLimits } from "../lib/limit";

const URL1 = "https://jobs.lever.co/example/baf9b35a-1ac6-45f8-9a95-de02c8b532bd";
const HTML = "<html><body><h1>Analyst</h1>" + "x".repeat(300) + "</body></html>";

function fake(status: number, body: unknown, seen?: { url?: string; init?: RequestInit }) {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    if (seen) Object.assign(seen, { url: String(url), init });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;
}

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    old[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    return fn();
  } finally {
    for (const k of Object.keys(old)) {
      if (old[k] === undefined) delete process.env[k];
      else process.env[k] = old[k];
    }
  }
}

test("adapter: one fixed Actor, one page, no link following, token only in the header", async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const html = await withEnv({ APIFY_API_KEY: "apify_api_TESTTOKEN", APIFY_ENABLED: undefined }, () => fetchPageViaApify(URL1, fake(201, [{ status: 200, html: HTML }], seen)));
  assert.equal(html, HTML);
  assert.match(seen.url!, /^https:\/\/api\.apify\.com\/v2\/acts\/apify~cheerio-scraper\/run-sync-get-dataset-items\?timeout=60&memory=512&maxItems=1$/);
  assert.doesNotMatch(seen.url!, /TESTTOKEN/, "token never in the URL");
  assert.equal((seen.init!.headers as Record<string, string>).Authorization, "Bearer apify_api_TESTTOKEN");
  const input = JSON.parse(String(seen.init!.body));
  assert.deepEqual(input.startUrls, [{ url: URL1 }]);
  assert.equal(input.maxRequestsPerCrawl, 1);
  assert.equal(input.maxCrawlingDepth, 0);
  assert.equal(input.linkSelector, "");
  assert.doesNotMatch(String(seen.init!.body), /TESTTOKEN/, "token never in the Actor input");
  // The page function refuses off-list redirects and strips scripts except structured data.
  assert.match(pageFunctionSource(), /refused: "redirected"/);
  assert.match(pageFunctionSource(), /jobs\.lever\.co/);
  assert.equal(actorInput(URL1).proxyConfiguration.useApifyProxy, true);
});

test("adapter: every failure has its own safe category", async () => {
  const run = (status: number, body: unknown) => withEnv({ APIFY_API_KEY: "k", APIFY_ENABLED: undefined }, () => fetchPageViaApify(URL1, fake(status, body)));
  const cat = async (p: Promise<unknown>) => {
    try {
      await p;
      return "none";
    } catch (e) {
      return e instanceof FetchError ? e.category : "other";
    }
  };
  assert.equal(await cat(run(401, { error: {} })), "auth");
  assert.equal(await cat(run(402, { error: {} })), "quota");
  assert.equal(await cat(run(403, "Monthly usage limit exceeded")), "quota");
  assert.equal(await cat(run(408, {})), "timeout");
  assert.equal(await cat(run(500, {})), "provider");
  assert.equal(await cat(run(201, [])), "empty");
  assert.equal(await cat(run(201, "not json")), "empty");
  assert.equal(await cat(run(201, [{ refused: "redirected" }])), "redirected");
  assert.equal(await cat(run(201, [{ status: 404, html: HTML }])), "empty");
  const thrower = (async () => {
    const e = new Error("t");
    e.name = "TimeoutError";
    throw e;
  }) as typeof fetch;
  assert.equal(await cat(withEnv({ APIFY_API_KEY: "k" }, () => fetchPageViaApify(URL1, thrower))), "timeout");
});

test("adapter: no key or kill switch means no network call at all", async () => {
  let called = 0;
  const counting = (async () => {
    called++;
    return new Response("[]");
  }) as typeof fetch;
  for (const env of [{ APIFY_API_KEY: undefined, APIFY_TOKEN: undefined }, { APIFY_API_KEY: "k", APIFY_ENABLED: "0" }]) {
    await assert.rejects(
      withEnv(env, () => fetchPageViaApify(URL1, counting)),
      (e: unknown) => e instanceof FetchError && e.category === "config",
    );
    assert.equal(withEnv(env, () => apifyEnabled()), false);
  }
  assert.equal(called, 0);
});

test("limits: 5 imports per visitor per day, separate from AI limits", () => {
  const req = (ip: string) => new Request("http://localhost/api/enrich", { headers: { "x-forwarded-for": ip } });
  for (let i = 0; i < 5; i++) assert.equal(checkLimits(req("10.1.1.1"), "enrich"), null);
  assert.match(checkLimits(req("10.1.1.1"), "enrich") ?? "", /imported a lot of pages today/);
  assert.equal(checkLimits(req("10.1.1.2"), "enrich"), null);
});
