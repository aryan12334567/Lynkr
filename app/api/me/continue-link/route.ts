import { accountsConfigured, getAuth, sessionUser } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";

/**
 * "Continue on your laptop": LinkedIn's app can't save a profile PDF, so a phone user can email
 * themselves a single-use sign-in link (15 minutes) and pick up the import on a laptop.
 * The link goes only to the signed-in person's own address. Never logs the address or the link.
 */
const sent = new Map<string, number[]>();
const HOUR = 60 * 60 * 1000;

function allowed(userId: string): boolean {
  const now = Date.now();
  const recent = (sent.get(userId) ?? []).filter((t) => now - t < HOUR);
  if (recent.length >= 3) return false;
  recent.push(now);
  if (sent.size > 5000) sent.clear();
  sent.set(userId, recent);
  return true;
}

export async function POST(req: Request) {
  const user = await sessionUser(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(process.env.BETTER_AUTH_URL?.trim() ?? "");
  if (!accountsConfigured() || (!emailConfigured() && !local)) {
    return Response.json({ error: "Email links aren't available right now. Use the paste option instead." }, { status: 409 });
  }
  if (!allowed(user.id)) return Response.json({ error: "We've sent a few links already. Check your inbox, or try again in an hour." }, { status: 429 });
  try {
    await getAuth().api.signInMagicLink({ body: { email: user.email, callbackURL: "/#start" }, headers: req.headers });
    return Response.json({ sent: true });
  } catch {
    return Response.json({ error: "Couldn't send the link. Please try again." }, { status: 502 });
  }
}
