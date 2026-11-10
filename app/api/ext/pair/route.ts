import { paywallEnabled } from "@/lib/billing";
import { createExtensionToken } from "@/lib/outreach/contacts-db";
import { extDeps, newToken, sameSiteRequest } from "@/lib/outreach/ext-auth";

export async function POST(req: Request) {
  if (!sameSiteRequest(req)) return Response.json({ error: "Origin not allowed." }, { status: 403 });
  const user = await extDeps.session(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (paywallEnabled() && !(await extDeps.subscribed(user.dodoCustomerId))) return Response.json({ error: "An active subscription is needed." }, { status: 402 });
  if (!(await extDeps.ready())) return Response.json({ error: "Account storage is unavailable." }, { status: 503 });
  try {
    const token = newToken();
    const record = await createExtensionToken(extDeps.db(), user.id, token);
    return Response.json({ token, id: record.id, expiresAt: record.expiresAt }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Couldn't pair the extension." }, { status: 503 }); }
}
