import { accountsConfigured, appleConfigured, googleConfigured, sessionUser } from "@/lib/auth";
import { subscriptionActive } from "@/lib/billing";

/**
 * Who is signed in, and whether their account has an active subscription. No secrets, no Dodo ids.
 * The Google client ID is public by design (Google One Tap needs it in the browser).
 */
export async function GET(req: Request) {
  const user = await sessionUser(req);
  return Response.json({
    accounts: accountsConfigured(),
    google: googleConfigured(),
    googleClientId: googleConfigured() ? process.env.GOOGLE_CLIENT_ID!.trim() : null,
    apple: appleConfigured(),
    signedIn: Boolean(user),
    email: user?.email ?? null,
    subscribed: user ? await subscriptionActive(user.dodoCustomerId) : false,
  });
}
