// Unit tests: the "Support Lynkr" Dodo checkout stays in test mode and fails safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLimits } from "../lib/limit";
import {
  SUPPORT_TEST_PRODUCT_ID,
  createSupportCheckout,
  safeCheckoutUrl,
  supportConfigured,
  supportProductId,
  supportReturnUrl,
} from "../lib/support";

const ENV_KEYS = ["DODO_PAYMENTS_API_KEY", "DODO_SUPPORT_PRODUCT_ID", "DODO_PAYMENTS_BASE_URL", "LYNKR_SUPPORT"] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>, run: () => Promise<void> | void) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  Object.assign(process.env, values);
  const restore = () => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
  try {
    const r = run();
    return r instanceof Promise ? r.finally(restore) : (restore(), r);
  } catch (err) {
    restore();
    throw err;
  }
}

test("support: only enabled when a key is set, with a kill switch", () => {
  withEnv({}, () => assert.equal(supportConfigured(), false));
  withEnv({ DODO_PAYMENTS_API_KEY: "   " }, () => assert.equal(supportConfigured(), false));
  withEnv({ DODO_PAYMENTS_API_KEY: "k" }, () => assert.equal(supportConfigured(), true));
  withEnv({ DODO_PAYMENTS_API_KEY: "k", LYNKR_SUPPORT: "0" }, () => assert.equal(supportConfigured(), false));
});

test("support: product id defaults to the test placeholder and can be overridden", () => {
  withEnv({}, () => assert.equal(supportProductId(), SUPPORT_TEST_PRODUCT_ID));
  withEnv({ DODO_SUPPORT_PRODUCT_ID: " pdt_other " }, () => assert.equal(supportProductId(), "pdt_other"));
});

test("support: return url and checkout url handling", () => {
  assert.equal(supportReturnUrl("http://localhost:3000"), "http://localhost:3000/?supported=1");
  assert.equal(safeCheckoutUrl("https://checkout.example.com/session/abc"), "https://checkout.example.com/session/abc");
  assert.equal(safeCheckoutUrl("http://checkout.example.com/x"), null);
  assert.equal(safeCheckoutUrl("javascript:alert(1)"), null);
  assert.equal(safeCheckoutUrl("not a url"), null);
  assert.equal(safeCheckoutUrl(undefined), null);
  assert.equal(safeCheckoutUrl(null), null);
});

test("support: checkout is created against Dodo's test environment, even if a live base URL is set", async () => {
  const realFetch = globalThis.fetch;
  const seen: { url: string; auth: string | null; body: unknown }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    seen.push({ url: String(input instanceof Request ? input.url : input), auth: headers.get("authorization"), body: init?.body ? JSON.parse(String(init.body)) : null });
    return new Response(JSON.stringify({ session_id: "cks_test", checkout_url: "https://test.checkout.dodopayments.com/session/cks_test" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    await withEnv({ DODO_PAYMENTS_API_KEY: "fake-key-for-tests", DODO_PAYMENTS_BASE_URL: "https://live.dodopayments.com" }, async () => {
      const url = await createSupportCheckout("http://localhost:3000");
      assert.equal(url, "https://test.checkout.dodopayments.com/session/cks_test");
    });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(seen.length, 1);
  assert.ok(seen[0].url.startsWith("https://test.dodopayments.com/"), `unexpected host: ${seen[0].url}`);
  assert.equal(seen[0].auth, "Bearer fake-key-for-tests");
  const body = seen[0].body as { product_cart: { product_id: string; quantity: number }[]; return_url: string };
  assert.deepEqual(body.product_cart, [{ product_id: SUPPORT_TEST_PRODUCT_ID, quantity: 1 }]);
  assert.equal(body.return_url, "http://localhost:3000/?supported=1");
});

test("support: a non-https link from the provider is dropped", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ session_id: "cks_test", checkout_url: "http://insecure.example.com/x" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
  try {
    await withEnv({ DODO_PAYMENTS_API_KEY: "fake-key-for-tests" }, async () => {
      assert.equal(await createSupportCheckout("http://localhost:3000"), null);
    });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("support: limited to 5 checkout attempts per visitor per hour", () => {
  const req = () => new Request("http://localhost/api/support", { method: "POST", headers: { "x-forwarded-for": "203.0.113.77" } });
  for (let i = 0; i < 5; i++) assert.equal(checkLimits(req(), "support"), null);
  assert.match(checkLimits(req(), "support") ?? "", /Too many checkout attempts/);
});
