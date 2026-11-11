import { accountContext, noCloud, unauthorized } from "@/lib/account";
import { activateLicense, deactivateLicense } from "@/lib/billing";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { checkLimits } from "@/lib/limit";
import { getLink, removeLink, saveLink } from "@/lib/license-link";
import { sessionUser } from "@/lib/auth";

export const maxDuration = 30;

const ERRORS: Record<string, { error: string; status: number }> = {
  invalid: { error: "That key wasn't recognised. Check it and try again.", status: 400 },
  limit: { error: "That key can't be activated. It may be inactive, or already in use on the most devices it allows.", status: 409 },
  wrong_product: { error: "That key is for a different product.", status: 400 },
  unavailable: { error: "Couldn't reach the license service. Please try again.", status: 503 },
};

/**
 * Link a Dodo license key to the signed-in account (B6b). The key is checked with Dodo before it is kept, is stored
 * encrypted, and is never sent back: the answer is only whether a key is linked.
 *   GET    -> { linked }
 *   POST   { key } -> { linked: true }     activates the key for this account and keeps it
 *   DELETE -> { linked: false }            deactivates it and forgets it
 */
export async function GET(req: Request) {
  const user = await sessionUser(req);
  if (!user) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return Response.json({ linked: false });
  return Response.json({ linked: (await getLink(ctx.db, ctx.userId)) !== null });
}

export async function POST(req: Request) {
  const limited = checkLimits(req, "license");
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const user = await sessionUser(req);
  if (!user) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, BODY_LIMIT.license);
  if ("error" in read) return read.error;
  const raw = (read.body as { key?: unknown } | null)?.key;
  const key = typeof raw === "string" ? raw.trim().slice(0, 200) : "";
  if (!key) return Response.json({ error: "Enter your license key." }, { status: 400 });
  const activated = await activateLicense(key, "Lynkr account");
  if (!activated.ok) {
    const e = ERRORS[activated.reason];
    return Response.json({ error: e.error }, { status: e.status });
  }
  // A replaced key gives its device slot back.
  const old = await removeLink(ctx.db, ctx.userId);
  if (old) await deactivateLicense(old.key, old.instanceId);
  await saveLink(ctx.db, ctx.userId, key, activated.instanceId);
  return Response.json({ linked: true });
}

export async function DELETE(req: Request) {
  const user = await sessionUser(req);
  if (!user) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const old = await removeLink(ctx.db, ctx.userId);
  if (old) await deactivateLicense(old.key, old.instanceId);
  return Response.json({ linked: false });
}
