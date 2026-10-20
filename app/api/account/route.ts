import { accountsConfigured, googleConfigured, sessionUser } from "@/lib/auth";
import { subscriptionActive } from "@/lib/billing";

/** Who is signed in, and whether their account has an active subscription. No secrets, no Dodo ids. */
export async function GET(req: Request) {
  const user = await sessionUser(req);
  return Response.json({
    accounts: accountsConfigured(),
    google: googleConfigured(),
    signedIn: Boolean(user),
    email: user?.email ?? null,
    subscribed: user ? await subscriptionActive(user.dodoCustomerId) : false,
  });
}
