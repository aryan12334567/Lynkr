import { readJson } from "@/lib/http";
import { listExtensionTokens, revokeExtensionToken } from "@/lib/outreach/contacts-db";
import { z } from "zod";
import { extDeps, sameSiteRequest } from "@/lib/outreach/ext-auth";
const Body = z.object({ id: z.string().uuid() }).strict();
export async function GET(req: Request) {
  const user = await extDeps.session(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!(await extDeps.ready())) return Response.json({ error: "Account storage is unavailable." }, { status: 503 });
  try { return Response.json({ tokens: (await listExtensionTokens(extDeps.db(), user.id)).map(({ id, expiresAt, revokedAt, lastUsedAt }) => ({ id, expiresAt, revokedAt, lastUsedAt })) }, { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Extension access is unavailable." }, { status: 503 }); }
}
export async function POST(req: Request) {
  if (!sameSiteRequest(req)) return Response.json({ error: "Origin not allowed." }, { status: 403 });
  const user = await extDeps.session(req);
  if (!user) return Response.json({ error: "Please sign in first." }, { status: 401 });
  if (!(await extDeps.ready())) return Response.json({ error: "Account storage is unavailable." }, { status: 503 });
  const read = await readJson(req, 1024); if ("error" in read) return read.error;
  const data = Body.safeParse(read.body); if (!data.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  try { const token = await revokeExtensionToken(extDeps.db(), user.id, data.data.id); return Response.json({ revoked: !!token }); }
  catch { return Response.json({ error: "Couldn't revoke the token." }, { status: 503 }); }
}
