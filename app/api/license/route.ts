import { activateLicense, deactivateLicense, validateLicense } from "@/lib/billing";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { checkLimits } from "@/lib/limit";

export const maxDuration = 30;

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

const ACTIVATE_ERROR: Record<string, { error: string; status: number }> = {
  invalid: { error: "That key wasn't recognised. Check it and try again.", status: 400 },
  limit: { error: "That key can't be activated. It may be inactive, or already in use on the most devices it allows.", status: 409 },
  wrong_product: { error: "That key is for a different product.", status: 400 },
  unavailable: { error: "Couldn't reach the license service. Please try again.", status: 503 },
};

/**
 * Unlocking with a Dodo license key.
 *  activate:   { action: "activate", key }                -> { instanceId }
 *  validate:   { action: "validate", key, instanceId }    -> { valid }
 *  deactivate: { action: "deactivate", key, instanceId }  -> { ok }
 */
export async function POST(req: Request) {
  const limited = checkLimits(req, "license");
  if (limited) return Response.json({ error: limited }, { status: 429 });
  const read = await readJson(req, BODY_LIMIT.license);
  if ("error" in read) return read.error;
  const b = (read.body ?? {}) as Record<string, unknown>;
  const action = clean(b.action, 20);
  const key = clean(b.key, 200);
  const instanceId = clean(b.instanceId, 100);
  if (!key) return Response.json({ error: "Enter your license key." }, { status: 400 });

  if (action === "activate") {
    const r = await activateLicense(key, "Lynkr in a browser");
    if (r.ok) return Response.json({ instanceId: r.instanceId });
    const e = ACTIVATE_ERROR[r.reason];
    return Response.json({ error: e.error }, { status: e.status });
  }
  if (action === "validate" && instanceId) return Response.json({ valid: await validateLicense(key, instanceId) });
  if (action === "deactivate" && instanceId) return Response.json({ ok: await deactivateLicense(key, instanceId) });
  return Response.json({ error: "Invalid request." }, { status: 400 });
}
