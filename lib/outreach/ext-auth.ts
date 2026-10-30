import { createHash, randomBytes } from "node:crypto";
import { cloudReady, getDb, type Db } from "../db";
import { paywallEnabled, subscriptionActive } from "../billing";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
/** Pairing and revocation are cookie-authenticated; reject cross-origin browser requests. */
export function sameSiteRequest(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(req.url).origin; } catch { return false; }
}
export function corsHeaders(req: Request): Headers {
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin" });
  const id = process.env.LYNKR_EXT_ID?.trim();
  if (id && /^[a-p]{32}$/.test(id) && req.headers.get("origin") === `chrome-extension://${id}`) {
    headers.set("Access-Control-Allow-Origin", `chrome-extension://${id}`);
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  return headers;
}
export function preflight(req: Request): Response {
  const headers = corsHeaders(req);
  return new Response(null, { status: headers.has("Access-Control-Allow-Origin") ? 204 : 403, headers });
}
export function extJson(req: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}
export async function tokenOwner(db: Db, raw: string): Promise<{ userId: string; customerId: string | null } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) return null;
  const r = await db.query<{ user_id: string; customer_id: string | null }>(
    `update ext_tokens set last_used_at = now() where token_hash = $1 and revoked_at is null and expires_at > now()
     returning user_id, (select "dodoCustomerId" from "user" where id = ext_tokens.user_id) as customer_id`, [hashToken(raw)],
  );
  return r.rows[0] ? { userId: r.rows[0].user_id, customerId: r.rows[0].customer_id } : null;
}
export async function extensionAuth(req: Request): Promise<{ db: Db; userId: string } | { error: Response }> {
  const origin = req.headers.get("origin");
  if (origin && !corsHeaders(req).has("Access-Control-Allow-Origin")) return { error: extJson(req, { error: "Origin not allowed." }, 403) };
  if (!(await cloudReady())) return { error: extJson(req, { error: "Account storage is unavailable." }, 503) };
  const raw = /^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";
  const db = getDb();
  try {
    const owner = await tokenOwner(db, raw);
    if (!owner) return { error: extJson(req, { error: "Invalid or expired token." }, 401) };
    if (paywallEnabled() && !(await subscriptionActive(owner.customerId))) return { error: extJson(req, { error: "An active subscription is needed." }, 402) };
    return { db, userId: owner.userId };
  } catch { return { error: extJson(req, { error: "Extension access is unavailable." }, 503) }; }
}
