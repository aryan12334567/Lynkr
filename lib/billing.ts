import DodoPayments from "dodopayments";

/**
 * Lynkr is a paid subscription sold through Dodo Payments (Merchant of Record).
 *
 * How access works. Either one unlocks the app:
 *  A. Account (when DATABASE_URL is set, see lib/auth.ts): the person signs up, subscribes through a checkout
 *     tied to their account, and every AI route asks Dodo whether that customer has an active subscription
 *     to the product (cached briefly; Dodo webhooks clear the cache).
 *  B. License key: Dodo emails a key after checkout; the person pastes it and the server activates it for their
 *     browser. Every AI route re-validates key + instance with Dodo (cached briefly). Dodo switches the key off
 *     itself when the subscription is cancelled, expired, paused or on hold.
 *
 * Safety defaults:
 *  - The paywall is ON in production builds (next build / Vercel) and OFF in local development. Override with
 *    LYNKR_PAYWALL=1 (force on) or LYNKR_PAYWALL=0 (force off).
 *  - The Dodo environment is TEST unless DODO_ENVIRONMENT=live_mode is set on purpose. Test-mode license keys
 *    can be created by anyone with a test card, so in production a TEST environment is refused (checkout and
 *    license activation both fail) unless LYNKR_ALLOW_TEST_PAYMENTS=1 is set, e.g. for a preview deployment.
 *  - Validation fails closed.
 */
const BASE_URL = {
  test_mode: "https://test.dodopayments.com",
  live_mode: "https://live.dodopayments.com",
} as const;

export type DodoEnvironment = keyof typeof BASE_URL;

export function dodoEnvironment(): DodoEnvironment {
  return process.env.DODO_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

export const dodoBaseUrl = (): string => BASE_URL[dodoEnvironment()];

export const isProduction = (): boolean => process.env.NODE_ENV === "production";

export function paywallEnabled(): boolean {
  const v = process.env.LYNKR_PAYWALL;
  if (v === "0") return false;
  return v === "1" || isProduction();
}

/** True when a production deployment is pointed at Dodo's test environment without an explicit opt-in. */
export const testPaymentsBlocked = (): boolean => isProduction() && dodoEnvironment() === "test_mode" && process.env.LYNKR_ALLOW_TEST_PAYMENTS !== "1";

/** The Dodo subscription product (pdt_...) that a license key must belong to. */
export const billingProductId = (): string => process.env.DODO_PRODUCT_ID?.trim() || "";

/** Checkout needs a server API key and the product id. */
export const checkoutConfigured = (): boolean => Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim()) && Boolean(billingProductId()) && !testPaymentsBlocked();

/** Where Dodo sends the person after paying or cancelling. */
export function checkoutReturnUrl(origin: string): string {
  return `${origin}/?subscribed=1`;
}

/** Only follow an https link back from the payment provider. */
export function safeCheckoutUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Creates a Dodo checkout session for the subscription and returns its https URL, or null if Dodo returned none. */
export async function createCheckout(origin: string): Promise<string | null> {
  const client = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    // An explicit baseURL, not `environment`: the SDK refuses both together, and this wins over DODO_PAYMENTS_BASE_URL.
    baseURL: BASE_URL[dodoEnvironment()],
    maxRetries: 1,
    timeout: 15_000,
  });
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: billingProductId(), quantity: 1 }],
    return_url: checkoutReturnUrl(origin),
  });
  return safeCheckoutUrl(session.checkout_url);
}

// ---- license keys (Dodo's license endpoints are public: they don't use the API key) ----

function publicClient(): DodoPayments {
  return new DodoPayments({ bearerToken: "public", baseURL: BASE_URL[dodoEnvironment()], maxRetries: 1, timeout: 10_000 });
}

const statusOf = (err: unknown): number | null => (typeof (err as { status?: unknown })?.status === "number" ? (err as { status: number }).status : null);

export type ActivateResult = { ok: true; instanceId: string } | { ok: false; reason: "invalid" | "limit" | "wrong_product" | "unavailable" };

/** Activates a key for one browser. Refuses keys that belong to a different Dodo product. */
export async function activateLicense(key: string, deviceName: string): Promise<ActivateResult> {
  if (testPaymentsBlocked()) return { ok: false, reason: "unavailable" };
  try {
    const r = await publicClient().licenses.activate({ license_key: key, name: deviceName });
    const want = billingProductId();
    if (want && r.product?.product_id !== want) return { ok: false, reason: "wrong_product" };
    return { ok: true, instanceId: r.id };
  } catch (err) {
    const status = statusOf(err);
    if (status === 422) return { ok: false, reason: "limit" };
    if (status !== null && status >= 400 && status < 500) return { ok: false, reason: "invalid" };
    return { ok: false, reason: "unavailable" };
  }
}

const cache = new Map<string, { ok: boolean; at: number }>();
const VALID_TTL = 10 * 60_000; // re-ask Dodo every 10 minutes for a good key
const INVALID_TTL = 30_000; // remember a bad key briefly so repeated guesses don't hammer Dodo
const OUTAGE_GRACE = 24 * 60 * 60_000; // if Dodo is unreachable, keep someone who validated within a day

/** True only if Dodo says this key + browser instance is currently valid. Fails closed. */
export async function validateLicense(key: string, instanceId: string): Promise<boolean> {
  if (testPaymentsBlocked()) return false;
  const id = `${key}\u0000${instanceId}`;
  const now = Date.now();
  const hit = cache.get(id);
  if (hit && now - hit.at < (hit.ok ? VALID_TTL : INVALID_TTL)) return hit.ok;
  try {
    const r = await publicClient().licenses.validate({ license_key: key, license_key_instance_id: instanceId });
    const ok = r.valid === true;
    if (cache.size > 5000) cache.clear();
    cache.set(id, { ok, at: now });
    return ok;
  } catch (err) {
    const status = statusOf(err);
    if (status !== null && status >= 400 && status < 500) {
      cache.set(id, { ok: false, at: now });
      return false;
    }
    return Boolean(hit?.ok && now - hit.at < OUTAGE_GRACE);
  }
}

export async function deactivateLicense(key: string, instanceId: string): Promise<boolean> {
  cache.delete(`${key}\u0000${instanceId}`);
  try {
    await publicClient().licenses.deactivate({ license_key: key, license_key_instance_id: instanceId });
    return true;
  } catch {
    return false;
  }
}

export const LICENSE_HEADER = "x-lynkr-license";
export const INSTANCE_HEADER = "x-lynkr-instance";

// ---- account subscriptions ----

const subs = new Map<string, { ok: boolean; at: number }>();

/** Called from Dodo webhooks: the next check asks Dodo again. */
export function forgetSubscription(customerId: string | undefined): void {
  if (customerId) subs.delete(customerId);
}

/** True only if Dodo lists an active subscription to the Lynkr product for this customer. Fails closed. */
export async function subscriptionActive(customerId: string | null): Promise<boolean> {
  if (!customerId || testPaymentsBlocked() || !process.env.DODO_PAYMENTS_API_KEY?.trim()) return false;
  const now = Date.now();
  const hit = subs.get(customerId);
  if (hit && now - hit.at < (hit.ok ? VALID_TTL : INVALID_TTL)) return hit.ok;
  try {
    const client = new DodoPayments({ bearerToken: process.env.DODO_PAYMENTS_API_KEY, baseURL: dodoBaseUrl(), maxRetries: 1, timeout: 10_000 });
    const page = await client.subscriptions.list({ customer_id: customerId, status: "active", ...(billingProductId() ? { product_id: billingProductId() } : {}) });
    const ok = page.items.length > 0;
    if (subs.size > 5000) subs.clear();
    subs.set(customerId, { ok, at: now });
    return ok;
  } catch {
    return Boolean(hit?.ok && now - hit.at < OUTAGE_GRACE);
  }
}

/** True when the request carries a license key that Dodo confirms for this browser. */
export async function hasValidLicense(req: Request): Promise<boolean> {
  const key = req.headers.get(LICENSE_HEADER)?.trim() ?? "";
  const instance = req.headers.get(INSTANCE_HEADER)?.trim() ?? "";
  return Boolean(key && instance && key.length <= 200 && instance.length <= 100 && (await validateLicense(key, instance)));
}

/** Gate for every AI route: null means carry on, otherwise return the 402 response. See paywallEnabled(). */
export async function requireLicense(req: Request): Promise<Response | null> {
  if (!paywallEnabled()) return null;
  if (await hasValidLicense(req)) return null;
  // Imported here, not at the top: lib/auth imports this file.
  const { sessionUser } = await import("./auth");
  const user = await sessionUser(req);
  if (user && (await subscriptionActive(user.dodoCustomerId))) return null;
  return Response.json({ error: "An active subscription is needed. Subscribe, or enter your license key.", code: "subscription_required" }, { status: 402 });
}
