import type { Db } from "../db";
import { autopublishOn } from "./flags";

/**
 * LinkedIn side of publishing (posts plan U7/U8). Only used when LYNKR_AUTOPUBLISH is "on"; with it off nothing here is
 * ever called with a token and nothing is sent. The token is the one Better Auth stored when the person signed in with
 * LinkedIn (table "account"). It is read only inside this file and the run, never returned, logged or put in an error.
 */

/** A constant, overridable by LINKEDIN_API_VERSION (YYYYMM). */
export const LINKEDIN_API_VERSION = "202609";
export const linkedinVersion = (): string => process.env.LINKEDIN_API_VERSION?.trim() || LINKEDIN_API_VERSION;
export const POSTS_URL = "https://api.linkedin.com/rest/posts";
export const PUBLISH_TIMEOUT_MS = 20_000;
const WRITE_SCOPE = "w_member_social";

/**
 * LinkedIn's "little text format" treats these characters as markup in `commentary`; each gets a backslash so the post
 * reads exactly as the person wrote it: \ | { } @ [ ] ( ) < > # * _ ~
 */
export function escapeCommentary(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

export type Connection = { autopublish: boolean; connected: boolean; canPublish: boolean; expiresAt: string | null };
type AccountRow = { accountId: string; accessToken: string | null; accessTokenExpiresAt: string | Date | null; scope: string | null };

/** The person's LinkedIn sign-in row, with the token. Internal: callers must not return this. */
export async function linkedinAccount(db: Db, userId: string): Promise<{ accountId: string; token: string | null; expiresAt: Date | null; scopes: string[] } | null> {
  const r = await db.query<AccountRow>(
    `select "accountId", "accessToken", "accessTokenExpiresAt", "scope" from "account" where "userId" = $1 and "providerId" = 'linkedin' order by "updatedAt" desc nulls last limit 1`,
    [userId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    accountId: row.accountId,
    token: row.accessToken,
    expiresAt: row.accessTokenExpiresAt ? new Date(row.accessTokenExpiresAt) : null,
    scopes: (row.scope ?? "").split(/[\s,]+/).filter(Boolean),
  };
}

/** What the UI may know: no token, no member id. canPublish = switch on, a LinkedIn row, the write scope, and a token that has not expired. */
export async function connectionStatus(db: Db, userId: string, now: Date = new Date()): Promise<Connection> {
  const autopublish = autopublishOn();
  let acct: Awaited<ReturnType<typeof linkedinAccount>> = null;
  try { acct = await linkedinAccount(db, userId); } catch { /* no account table: not connected */ }
  const connected = Boolean(acct?.token);
  const fresh = acct?.expiresAt ? acct.expiresAt.getTime() > now.getTime() : false;
  const canPublish = autopublish && connected && Boolean(acct?.scopes.includes(WRITE_SCOPE)) && fresh;
  return { autopublish, connected, canPublish, expiresAt: acct?.expiresAt ? acct.expiresAt.toISOString() : null };
}

export type PublishOutcome =
  | { kind: "published"; urn: string | null }
  /** A definite refusal (4xx other than 429): LinkedIn did not create the post. `code` is ours, never provider text. */
  | { kind: "refused"; code: "auth" | "rejected" }
  /** Timeout, network error, 429 or 5xx after the request was sent: the post may or may not exist. Never retried. */
  | { kind: "unknown" };

/**
 * POST https://api.linkedin.com/rest/posts. This request shape is from LinkedIn's public documentation (Posts API,
 * versioned header, little text format) and has NOT been verified against the live API.
 */
export async function publishText(args: { token: string; accountId: string; text: string; fetch?: typeof fetch }): Promise<PublishOutcome> {
  const doFetch = args.fetch ?? fetch;
  let res: Response;
  try {
    res = await doFetch(POSTS_URL, {
      method: "POST",
      signal: AbortSignal.timeout(PUBLISH_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${args.token}`,
        "LinkedIn-Version": linkedinVersion(),
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        author: `urn:li:person:${args.accountId}`,
        commentary: escapeCommentary(args.text),
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
  } catch {
    return { kind: "unknown" };
  }
  if (res.status === 201) return { kind: "published", urn: res.headers.get("x-restli-id")?.slice(0, 200) || null };
  if (res.status === 429 || res.status >= 500) return { kind: "unknown" };
  if (res.status >= 400) return { kind: "refused", code: res.status === 401 || res.status === 403 ? "auth" : "rejected" };
  // Any other answer is not the documented 201: we cannot tell, so do not retry.
  return { kind: "unknown" };
}
