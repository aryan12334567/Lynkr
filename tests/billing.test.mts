// Unit tests: the paid-access layer (Dodo checkout, license keys, paywall gate).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { checkLimits } from "../lib/limit";
import {
  activateLicense,
  checkoutConfigured,
  checkoutReturnUrl,
  createCheckout,
  dodoEnvironment,
  paywallEnabled,
  requireLicense,
  safeCheckoutUrl,
  testPaymentsBlocked,
  validateLicense,
} from "../lib/billing";

const ENV_KEYS = ["DODO_PAYMENTS_API_KEY", "DODO_PRODUCT_ID", "DODO_PAYMENTS_BASE_URL", "DODO_ENVIRONMENT", "LYNKR_PAYWALL", "LYNKR_ALLOW_TEST_PAYMENTS", "NODE_ENV"] as const;
type Env = Partial<Record<(typeof ENV_KEYS)[number], string>>;

async function withEnv(values: Env, run: () => Promise<void> | void) {
  // NODE_ENV is typed read-only by Next's types; the tests need to set it.
  const env = process.env as Record<string, string | undefined>;
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, env[k]]));
  for (const k of ENV_KEYS) delete env[k];
  Object.assign(env, values);
  try {
    await run();
  } finally {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete env[k];
      else env[k] = saved[k];
    }
  }
}

type Call = { url: string; auth: string | null; body: unknown };

/** Replaces fetch for one test. `reply` decides each response; every request is recorded. */
async function withFetch(reply: (url: string, n: number) => Response | Promise<Response>, run: (calls: Call[]) => Promise<void>) {
  const real = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, auth: new Headers(init?.headers).get("authorization"), body: init?.body ? JSON.parse(String(init.body)) : null });
    return reply(url, calls.length);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = real;
  }
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

test("billing: defaults are safe (test environment, paywall off, checkout off)", async () => {
  await withEnv({}, () => {
    assert.equal(dodoEnvironment(), "test_mode");
    assert.equal(paywallEnabled(), false);
    assert.equal(checkoutConfigured(), false);
  });
  await withEnv({ DODO_PAYMENTS_API_KEY: "k" }, () => assert.equal(checkoutConfigured(), false));
  await withEnv({ DODO_PAYMENTS_API_KEY: "k", DODO_PRODUCT_ID: "pdt_1" }, () => assert.equal(checkoutConfigured(), true));
  await withEnv({ LYNKR_PAYWALL: "1" }, () => assert.equal(paywallEnabled(), true));
  await withEnv({ LYNKR_PAYWALL: "true" }, () => assert.equal(paywallEnabled(), false));
  await withEnv({ DODO_ENVIRONMENT: "live_mode" }, () => assert.equal(dodoEnvironment(), "live_mode"));
  await withEnv({ DODO_ENVIRONMENT: "live" }, () => assert.equal(dodoEnvironment(), "test_mode"));
});

test("billing: the paywall is on in production by default, off in development, and can be forced either way", async () => {
  await withEnv({ NODE_ENV: "production" }, () => assert.equal(paywallEnabled(), true));
  await withEnv({ NODE_ENV: "production", LYNKR_PAYWALL: "0" }, () => assert.equal(paywallEnabled(), false));
  await withEnv({ NODE_ENV: "development" }, () => assert.equal(paywallEnabled(), false));
  await withEnv({ NODE_ENV: "development", LYNKR_PAYWALL: "1" }, () => assert.equal(paywallEnabled(), true));
});

test("billing: production refuses Dodo's test environment unless explicitly allowed, so test cards can't unlock the app", async () => {
  await withEnv({ NODE_ENV: "production" }, () => assert.equal(testPaymentsBlocked(), true));
  await withEnv({ NODE_ENV: "production", LYNKR_ALLOW_TEST_PAYMENTS: "1" }, () => assert.equal(testPaymentsBlocked(), false));
  await withEnv({ NODE_ENV: "production", DODO_ENVIRONMENT: "live_mode" }, () => assert.equal(testPaymentsBlocked(), false));
  await withEnv({ NODE_ENV: "development" }, () => assert.equal(testPaymentsBlocked(), false));
  // Checkout is reported unavailable while blocked, even with a key and product set.
  const keyed = { DODO_PAYMENTS_API_KEY: "k", DODO_PRODUCT_ID: "pdt_1" };
  await withEnv({ ...keyed, NODE_ENV: "production" }, () => assert.equal(checkoutConfigured(), false));
  await withEnv({ ...keyed, NODE_ENV: "production", DODO_ENVIRONMENT: "live_mode" }, () => assert.equal(checkoutConfigured(), true));
  // License calls are refused without ever contacting Dodo.
  await withEnv({ NODE_ENV: "production" }, async () => {
    await withFetch(() => json({ valid: true }), async (calls) => {
      assert.equal(await validateLicense("K-TESTCARD", "i1"), false);
      assert.deepEqual(await activateLicense("K-TESTCARD", "browser"), { ok: false, reason: "unavailable" });
      assert.equal(calls.length, 0);
    });
  });
  // The gate itself stays closed in production with no key, whatever the Dodo settings.
  await withEnv({ NODE_ENV: "production" }, async () => {
    const res = await requireLicense(new Request("http://localhost/api/generate", { method: "POST" }));
    assert.equal(res?.status, 402);
  });
});

test("billing: return url and checkout link handling", () => {
  assert.equal(checkoutReturnUrl("https://www.lynkr.cloud"), "https://www.lynkr.cloud/?subscribed=1");
  assert.equal(safeCheckoutUrl("https://checkout.example.com/s/1"), "https://checkout.example.com/s/1");
  for (const bad of ["http://x.example.com", "javascript:alert(1)", "nope", undefined, null, 5]) assert.equal(safeCheckoutUrl(bad), null);
});

test("billing: checkout sells the subscription product on Dodo's test server, even if a live base URL is set", async () => {
  await withFetch(
    () => json({ session_id: "cks_1", checkout_url: "https://test.checkout.dodopayments.com/s/cks_1" }),
    async (calls) => {
      await withEnv({ DODO_PAYMENTS_API_KEY: "fake-key", DODO_PRODUCT_ID: "pdt_sub", DODO_PAYMENTS_BASE_URL: "https://live.dodopayments.com" }, async () => {
        assert.equal(await createCheckout("http://localhost:3000"), "https://test.checkout.dodopayments.com/s/cks_1");
      });
      assert.equal(calls.length, 1);
      assert.ok(calls[0].url.startsWith("https://test.dodopayments.com/"), calls[0].url);
      assert.equal(calls[0].auth, "Bearer fake-key");
      const body = calls[0].body as { product_cart: unknown; return_url: string };
      assert.deepEqual(body.product_cart, [{ product_id: "pdt_sub", quantity: 1 }]);
      assert.equal(body.return_url, "http://localhost:3000/?subscribed=1");
    },
  );
});

test("billing: the live server is used only when DODO_ENVIRONMENT=live_mode is set", async () => {
  await withFetch(
    () => json({ session_id: "cks_2", checkout_url: "https://checkout.dodopayments.com/s/cks_2" }),
    async (calls) => {
      await withEnv({ DODO_PAYMENTS_API_KEY: "fake-key", DODO_PRODUCT_ID: "pdt_sub", DODO_ENVIRONMENT: "live_mode" }, async () => {
        await createCheckout("https://www.lynkr.cloud");
      });
      assert.ok(calls[0].url.startsWith("https://live.dodopayments.com/"), calls[0].url);
    },
  );
});

test("billing: a non-https checkout link from the provider is dropped", async () => {
  await withFetch(
    () => json({ session_id: "cks_3", checkout_url: "http://insecure.example.com/x" }),
    async () => {
      await withEnv({ DODO_PAYMENTS_API_KEY: "fake-key", DODO_PRODUCT_ID: "pdt_sub" }, async () => {
        assert.equal(await createCheckout("http://localhost:3000"), null);
      });
    },
  );
});

test("license: activation maps Dodo's answers and rejects a key for another product", async () => {
  const instance = { id: "lki_1", business_id: "b", created_at: "", customer: {}, license_key_id: "lk", name: "n", product: { product_id: "pdt_sub" } };
  await withEnv({ DODO_PRODUCT_ID: "pdt_sub" }, async () => {
    await withFetch(() => json(instance), async (calls) => {
      assert.deepEqual(await activateLicense("KEY-A", "browser"), { ok: true, instanceId: "lki_1" });
      assert.ok(calls[0].url.startsWith("https://test.dodopayments.com/licenses/activate"), calls[0].url);
      assert.deepEqual(calls[0].body, { license_key: "KEY-A", name: "browser" });
    });
    await withFetch(() => json({ ...instance, product: { product_id: "pdt_other" } }), async () => {
      assert.deepEqual(await activateLicense("KEY-B", "browser"), { ok: false, reason: "wrong_product" });
    });
    await withFetch(() => json({ message: "limit" }, 422), async () => {
      assert.deepEqual(await activateLicense("KEY-C", "browser"), { ok: false, reason: "limit" });
    });
    await withFetch(() => json({ message: "nope" }, 404), async () => {
      assert.deepEqual(await activateLicense("KEY-D", "browser"), { ok: false, reason: "invalid" });
    });
    await withFetch(() => json({ message: "down" }, 500), async () => {
      assert.deepEqual(await activateLicense("KEY-E", "browser"), { ok: false, reason: "unavailable" });
    });
  });
});

test("license: validation is cached briefly, fails closed, and tolerates a short Dodo outage", async () => {
  let now = 1_000_000;
  const clock = mock.method(Date, "now", () => now);
  try {
    // A good key is validated once, then served from the cache.
    await withFetch(() => json({ valid: true }), async (calls) => {
      assert.equal(await validateLicense("K-GOOD", "i1"), true);
      assert.equal(await validateLicense("K-GOOD", "i1"), true);
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].body, { license_key: "K-GOOD", license_key_instance_id: "i1" });
    });
    // A key Dodo says is invalid is refused.
    await withFetch(() => json({ valid: false }), async () => {
      assert.equal(await validateLicense("K-BAD", "i1"), false);
    });
    // A client error from Dodo is a refusal, never a pass.
    await withFetch(() => json({ message: "nope" }, 404), async () => {
      assert.equal(await validateLicense("K-404", "i1"), false);
    });
    // Dodo unreachable and never seen before: fail closed.
    await withFetch(() => json({}, 503), async () => {
      assert.equal(await validateLicense("K-NEW", "i1"), false);
    });
    // Dodo unreachable but validated within the last day: keep the customer working.
    now += 11 * 60_000;
    await withFetch(() => json({}, 503), async () => {
      assert.equal(await validateLicense("K-GOOD", "i1"), true);
    });
    // After a full day without a good answer, the grace ends.
    now += 25 * 60 * 60_000;
    await withFetch(() => json({}, 503), async () => {
      assert.equal(await validateLicense("K-GOOD", "i1"), false);
    });
  } finally {
    clock.mock.restore();
  }
});

test("paywall gate: open when off, 402 without a valid key, open with one", async () => {
  const req = (headers: Record<string, string> = {}) => new Request("http://localhost/api/generate", { method: "POST", headers });
  await withEnv({}, async () => assert.equal(await requireLicense(req()), null));
  await withEnv({ LYNKR_PAYWALL: "1" }, async () => {
    const none = await requireLicense(req());
    assert.equal(none?.status, 402);
    assert.deepEqual(await none?.json(), { error: "An active subscription is needed. Subscribe, or enter your license key.", code: "subscription_required" });
    assert.equal((await requireLicense(req({ "x-lynkr-license": "K-ONLY" })))?.status, 402);
    await withFetch(() => json({ valid: false }), async () => {
      assert.equal((await requireLicense(req({ "x-lynkr-license": "K-NOPE", "x-lynkr-instance": "i9" })))?.status, 402);
    });
    await withFetch(() => json({ valid: true }), async () => {
      assert.equal(await requireLicense(req({ "x-lynkr-license": "K-YES", "x-lynkr-instance": "i9" })), null);
    });
    assert.equal((await requireLicense(req({ "x-lynkr-license": "x".repeat(300), "x-lynkr-instance": "i9" })))?.status, 402);
  });
});

test("limits: checkout 5 per visitor per hour, license attempts 30 per hour", () => {
  const from = (ip: string) => () => new Request("http://localhost/api/x", { method: "POST", headers: { "x-forwarded-for": ip } });
  const checkout = from("203.0.113.10");
  for (let i = 0; i < 5; i++) assert.equal(checkLimits(checkout(), "checkout"), null);
  assert.match(checkLimits(checkout(), "checkout") ?? "", /Too many checkout attempts/);
  const license = from("203.0.113.11");
  for (let i = 0; i < 30; i++) assert.equal(checkLimits(license(), "license"), null);
  assert.match(checkLimits(license(), "license") ?? "", /Too many attempts/);
});
