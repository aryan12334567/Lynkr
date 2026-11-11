import { accountsConfigured, appleConfigured, googleConfigured, linkedinConfigured, sessionUser } from "@/lib/auth";
import { linkedKeyActive, subscriptionActive } from "@/lib/billing";

/**
 * Who is signed in, whether their account has an active subscription, and whether it has a billing record (so a
 * customer whose payment failed can still reach the Dodo portal to fix it). No secrets, no Dodo ids.
 * The Google client ID is public by design (Google One Tap needs it in the browser).
 */
export async function GET(req: Request) {
  const user = await sessionUser(req);
  return Response.json({
    accounts: accountsConfigured(),
    google: googleConfigured(),
    googleClientId: googleConfigured() ? process.env.GOOGLE_CLIENT_ID!.trim() : null,
    apple: appleConfigured(),
    linkedin: linkedinConfigured(),
    signedIn: Boolean(user),
    email: user?.email ?? null,
    subscribed: user ? (await subscriptionActive(user.dodoCustomerId)) || (await linkedKeyActive(user.id)) : false,
    hasBilling: Boolean(user?.dodoCustomerId),
  });
}
