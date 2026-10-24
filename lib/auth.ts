import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, oneTap } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { checkout, dodopayments, portal, webhooks } from "@dodopayments/better-auth";
import DodoPayments from "dodopayments";
import { Pool } from "pg";
import { billingProductId, dodoBaseUrl, forgetSubscription } from "./billing";
import { sendEmail } from "./email";

/**
 * Lynkr accounts (Better Auth on Postgres). The account holds only sign-in details and the link to the
 * person's Dodo customer: the Story Vault, drafts and plan stay in their browser.
 *
 * Off until DATABASE_URL and BETTER_AUTH_SECRET are set; the app then falls back to license keys only.
 * Sign-in methods: email + password (verified email), a one-time email code, passkeys, and Google (with One Tap)
 * and Apple when their clients are configured.
 */
export const accountsConfigured = (): boolean => Boolean(process.env.DATABASE_URL?.trim() && process.env.BETTER_AUTH_SECRET?.trim());
export const googleConfigured = (): boolean => Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
/** Apple needs a Services ID and a client secret (a signed JWT that Apple lets live for at most six months). */
export const appleConfigured = (): boolean => Boolean(process.env.APPLE_CLIENT_ID?.trim() && process.env.APPLE_CLIENT_SECRET?.trim());

/** The passkey "relying party": the site's registrable domain, so a passkey made on www.lynkr.cloud also works on lynkr.cloud. */
function relyingParty(site: string): string {
  return new URL(site).hostname.replace(/^www\./, "");
}

/** The checkout slug the browser asks for; mapped to DODO_PRODUCT_ID on the server. */
export const PLAN_SLUG = "lynkr-monthly";

function build() {
  const dodo = new DodoPayments({ bearerToken: process.env.DODO_PAYMENTS_API_KEY || "unset", baseURL: dodoBaseUrl(), maxRetries: 1, timeout: 15_000 });
  const site = process.env.BETTER_AUTH_URL?.trim() || "http://localhost:3000";
  return betterAuth({
    appName: "Lynkr",
    baseURL: site,
    secret: process.env.BETTER_AUTH_SECRET,
    database: new Pool({ connectionString: process.env.DATABASE_URL, max: 3 }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => sendEmail(user.email, "reset", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => sendEmail(user.email, "verify", url),
    },
    socialProviders: {
      ...(googleConfigured() && { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, prompt: "select_account" as const } }),
      ...(appleConfigured() && { apple: { clientId: process.env.APPLE_CLIENT_ID!, clientSecret: process.env.APPLE_CLIENT_SECRET! } }),
    },
    // Apple returns to the site with a form POST from its own origin.
    trustedOrigins: appleConfigured() ? ["https://appleid.apple.com"] : [],
    account: { accountLinking: { enabled: true, trustedProviders: ["google", "apple"] } },
    rateLimit: { enabled: true, window: 60, max: 30 },
    plugins: [
      // A six-digit code instead of a link: it works even when the email opens in a different browser or app.
      emailOTP({ otpLength: 6, expiresIn: 600, sendVerificationOTP: async ({ email, otp }) => sendEmail(email, "code", otp) }),
      passkey({ rpID: relyingParty(site), rpName: "Lynkr", origin: site }),
      ...(googleConfigured() ? [oneTap()] : []),
      dodopayments({
        client: dodo,
        // The Dodo customer is created at first checkout, not at sign-up: signing up never depends on Dodo being reachable.
        createCustomerOnSignUp: false,
        use: [
          checkout({ products: [{ productId: billingProductId(), slug: PLAN_SLUG }], successUrl: `${site}/?subscribed=1#app/today`, authenticatedUsersOnly: true }),
          portal(),
          webhooks({
            webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "",
            // Access is always re-checked against Dodo; a webhook only clears the cached answer so changes apply at once.
            onPayload: async (payload) => {
              const data = (payload as { data?: { customer?: { customer_id?: string } } }).data;
              forgetSubscription(data?.customer?.customer_id);
            },
          }),
        ],
      }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof build>;
let instance: Auth | null = null;

/** The Better Auth server, created on first use (so builds without a database still work). */
export function getAuth(): Auth {
  if (!accountsConfigured()) throw new Error("Accounts aren't configured.");
  return (instance ??= build());
}

/** The signed-in account for this request, or null. Never throws. */
export async function sessionUser(req: Request): Promise<{ id: string; email: string; dodoCustomerId: string | null } | null> {
  if (!accountsConfigured()) return null;
  try {
    const s = await getAuth().api.getSession({ headers: req.headers });
    if (!s?.user) return null;
    const u = s.user as typeof s.user & { dodoCustomerId?: string | null };
    return { id: u.id, email: u.email, dodoCustomerId: u.dodoCustomerId ?? null };
  } catch {
    return null;
  }
}
