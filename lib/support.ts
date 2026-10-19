import DodoPayments from "dodopayments";

/**
 * "Support Lynkr" checkout through Dodo Payments. Paying unlocks nothing: Lynkr stays free.
 *
 * Test mode only. The client is pinned to Dodo's test base URL (an explicit option, so the
 * DODO_PAYMENTS_BASE_URL variable can't redirect it), which means a live key can never create a
 * real charge: the test server rejects it. Going live is a separate, deliberate change.
 */
const TEST_BASE_URL = "https://test.dodopayments.com";

/** The Test Mode placeholder product created in the Dodo dashboard on 2026-10-19. Override with DODO_SUPPORT_PRODUCT_ID. */
export const SUPPORT_TEST_PRODUCT_ID = "pdt_0Nq4xfcLSjI2OGsQqQdbF";

export function supportConfigured(): boolean {
  return Boolean(process.env.DODO_PAYMENTS_API_KEY?.trim()) && process.env.LYNKR_SUPPORT !== "0";
}

export function supportProductId(): string {
  return process.env.DODO_SUPPORT_PRODUCT_ID?.trim() || SUPPORT_TEST_PRODUCT_ID;
}

/** Where Dodo sends the person after paying or cancelling. */
export function supportReturnUrl(origin: string): string {
  return `${origin}/?supported=1`;
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

/** Creates a Dodo test-mode checkout session and returns its https URL, or null if Dodo returned none. */
export async function createSupportCheckout(origin: string): Promise<string | null> {
  const client = new DodoPayments({
    bearerToken: process.env.DODO_PAYMENTS_API_KEY,
    // Explicit baseURL, not `environment`: the SDK refuses both together, and this wins over DODO_PAYMENTS_BASE_URL.
    baseURL: TEST_BASE_URL,
    maxRetries: 1,
    timeout: 15_000,
  });
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: supportProductId(), quantity: 1 }],
    return_url: supportReturnUrl(origin),
  });
  return safeCheckoutUrl(session.checkout_url);
}
