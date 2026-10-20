import DodoPayments from "dodopayments";

/**
 * Lynkr is a paid subscription sold through Dodo Payments (Merchant of Record).
 *
 * How access works, with no accounts or database:
 *  1. The person subscribes at a Dodo checkout. Dodo emails them a license key for the product.
 *  2. They paste the key into Lynkr. The server activates it for their browser (one "instance").
 *  3. Every AI route re-validates key + instance with Dodo (cached briefly). For subscription keys Dodo
 *     switches the key off itself when the subscription is cancelled, expired, paused or on hold.
 *
 * Safety defaults: the Dodo environment is TEST unless DODO_ENVIRONMENT=live_mode is set on purpose, and
 * the paywall only turns on when LYNKR_PAYWALL=1. Validation fails closed.
 */
const BASE_URL = {
  test_mode: "https://test.dodopayments.com",
  live_mode: "https://live.dodopayments.com",
} as const;

export type DodoEnvironment = keyof typeof BASE_URL;

export function dodoEnvironment(): DodoEnvironment {
  return process.env.DODO_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

export const paywallEnabled = (): boolean => process.env.LYNKR_PAYWALL === "1";

/** The Dodo subscription product (pdt_...) that a license key must belong to. */
export const billingProductId = (): string => process.env.DODO_PRODUCT_ID?.trim() || "";

/** Checkout needs a server API key and the product id. */
export const checkoutConfigured = (): boolean => Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim()) && Boolean(billingProductId());

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

/** Gate for every AI route: null means carry on, otherwise return the 402 response. Off unless LYNKR_PAYWALL=1. */
export async function requireLicense(req: Request): Promise<Response | null> {
  if (!paywallEnabled()) return null;
  const key = req.headers.get(LICENSE_HEADER)?.trim() ?? "";
  const instance = req.headers.get(INSTANCE_HEADER)?.trim() ?? "";
  if (key && instance && key.length <= 200 && instance.length <= 100 && (await validateLicense(key, instance))) return null;
  return Response.json({ error: "An active subscription is needed. Subscribe, or enter your license key.", code: "subscription_required" }, { status: 402 });
}
