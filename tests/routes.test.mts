// Route-level regression tests (Vertical 1): the real route handlers, in demo mode.
//  - Every existing feature still accepts its old browser request shape without an account.
//  - Paywall: the free interview and first win need only a signed-in account (or a license key);
//    every other AI route still needs a subscription or a license key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// Route files import "@/lib/...", as Next.js resolves it. Map it to the app root for node --test.
register(
  "data:text/javascript," +
    encodeURIComponent(`
const root = ${JSON.stringify(new URL("../", import.meta.url).href)};
export async function resolve(specifier, context, next) {
  if (!specifier.startsWith("@/")) return next(specifier, context);
  const href = root + specifier.slice(2);
  try { return await next(href, context); } catch { return next(href + ".ts", context); }
}`),
);

const ENV = ["LYNKR_MOCK", "LYNKR_PAYWALL", "DATABASE_URL", "BETTER_AUTH_SECRET", "DODO_ENVIRONMENT", "LYNKR_ALLOW_TEST_PAYMENTS"] as const;

async function withEnv(values: Partial<Record<(typeof ENV)[number], string>>, run: () => Promise<void>) {
  const saved = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  for (const k of ENV) delete process.env[k];
  Object.assign(process.env, { LYNKR_MOCK: "1" }, values);
  try {
    await run();
  } finally {
    for (const k of ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

let ip = 0;
/** One POST to a route handler. Each call gets its own client address, so in-memory limits don't interfere. */
function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${++ip % 250}`, ...headers },
    body: JSON.stringify(body),
  });
}

const profile = { goal: "job", targetRole: "Data analyst", background: "Final-year B.Com, self-taught SQL" };
const turns = [{ q: "What did you build?", a: "I built a Power BI dashboard that tracked 40 sponsors for our college fest." }];
const facts = [{ id: "F1", kind: "project", text: "I built a Power BI dashboard that tracked 40 sponsors." }];

/** The old (v1) request shape for every paid AI route, as the browser sends it today. */
const PAID: Record<string, { mod: string; body: unknown }> = {
  interview: { mod: "interview", body: { profile, turns: [] } },
  vault: { mod: "vault", body: { profile, turns } },
  generate: { mod: "generate", body: { profile, turns, facts } },
  connect: { mod: "connect", body: { profile, facts, packet: { intent: "learn_role", bridge: "public_work", channel: "connection_note", anchor: "your post on cleaning survey data" } } },
  comment: { mod: "comment", body: { targetRole: "Data analyst", domain: "data_ai", audiences: ["practitioners"], excerpt: "Most dashboards fail because nobody agrees on the metric definitions first.", facts } },
  review: { mod: "review", body: { text: "Hi Ananya, I read your post on survey data. One question: how do you pick outliers?", channel: "connection_note", intent: "learn_role", relationship: "stranger", tone: "keep_voice" } },
  plan: { mod: "plan", body: { text: "fewer posts", counts: { posts: 1, comments: 2, messages: 3 }, times: { post: "09:00", comment: "13:00", message: "18:00" } } },
};

const FREE: Record<string, { mod: string; body: unknown }> = {
  interview2: { mod: "interview2", body: { bucket: "fresher", answer: null, history: [] } },
  "first-win": { mod: "first-win", body: { profile, facts } },
};

/** Demo mode has no AI review: the route says so (422) and the rule-based checker runs in the browser. */
const DEMO_STATUS: Record<string, number> = { review: 422 };

async function call(mod: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  const route = (await import(`../app/api/${mod}/route.ts`)) as { POST: (r: Request) => Promise<Response> };
  return route.POST(post(body, headers));
}

test("demo mode, no account, paywall off: every feature still accepts its old request shape", async () => {
  await withEnv({ LYNKR_PAYWALL: "0" }, async () => {
    for (const [name, { mod, body }] of Object.entries({ ...PAID, ...FREE })) {
      const res = await call(mod, body);
      assert.equal(res.status, DEMO_STATUS[name] ?? 200, `${name}: ${res.status} ${await res.clone().text()}`);
      assert.ok(await res.json(), `${name} returns JSON`);
    }
  });
});

test("demo mode: v1 replies keep their fields (profile fix, outreach, connect, comment, checker, plan)", async () => {
  await withEnv({ LYNKR_PAYWALL: "0" }, async () => {
    const gen = await (await call("generate", PAID.generate.body)).json();
    assert.ok(gen.profile?.headlines?.length, "profile fix headlines");
    assert.ok(gen.outreach, "outreach drafts");
    const conn = await (await call("connect", PAID.connect.body)).json();
    assert.ok(conn.fitStatus && typeof conn.body === "string", `connect reply: ${Object.keys(conn)}`);
    const com = await (await call("comment", PAID.comment.body)).json();
    assert.ok(Object.keys(com).length, "comment reply");
    const { checkMessage } = await import("../lib/checker");
    const checked = checkMessage("Hello sir, kindly revert on the analyst role.", "stranger");
    assert.ok(checked.flags.length > 0, "rule-based message checker still flags");
    const plan = await (await call("plan", PAID.plan.body)).json();
    assert.ok(plan.counts && plan.times, "plan change");
    const fw = await (await call("first-win", FREE["first-win"].body)).json();
    assert.ok(fw.headline && fw.referral?.body, "first win: headline and referral");
    assert.ok(fw.referral.factRefs.every((r: string) => r === "F1"), "first win cites only facts it was given");
    const iv = await (await call("interview2", FREE.interview2.body)).json();
    assert.equal(iv.next.type, "ask");
  });
});

test("paywall on, accounts on, signed out: free routes ask for an account, paid routes for a subscription", async () => {
  await withEnv({ LYNKR_PAYWALL: "1", DATABASE_URL: "postgres://u:p@127.0.0.1:1/none", BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123" }, async () => {
    for (const [name, { mod, body }] of Object.entries(FREE)) {
      const res = await call(mod, body);
      assert.equal(res.status, 401, name);
      assert.equal((await res.json()).code, "account_required", name);
    }
    for (const [name, { mod, body }] of Object.entries(PAID)) {
      const res = await call(mod, body);
      assert.equal(res.status, 402, name);
      assert.equal((await res.json()).code, "subscription_required", name);
    }
  });
});

test("paywall on, accounts off: nothing is free without a license key", async () => {
  await withEnv({ LYNKR_PAYWALL: "1" }, async () => {
    for (const [name, { mod, body }] of Object.entries({ ...PAID, ...FREE })) {
      assert.equal((await call(mod, body)).status, 402, name);
    }
  });
});

test("license key without an account: paid routes and the free interview both work (browser storage)", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/licenses/validate")) return Response.json({ valid: true });
    return real(input);
  }) as typeof fetch;
  try {
    await withEnv({ LYNKR_PAYWALL: "1", DATABASE_URL: "postgres://u:p@127.0.0.1:1/none", BETTER_AUTH_SECRET: "test-secret-0123456789abcdef0123", DODO_ENVIRONMENT: "live_mode" }, async () => {
      const key = { "x-lynkr-license": "LK-TEST-KEY", "x-lynkr-instance": "inst_test" };
      for (const [name, { mod, body }] of Object.entries({ ...PAID, ...FREE })) {
        const res = await call(mod, body, key);
        assert.equal(res.status, DEMO_STATUS[name] ?? 200, `${name}: ${res.status} ${await res.clone().text()}`);
      }
    });
  } finally {
    globalThis.fetch = real;
  }
});
