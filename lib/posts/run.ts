import type { Db } from "../db";
import { autopublishOn } from "./flags";
import { linkedinAccount, publishText } from "./linkedin";
import { notify, NOTICE, type SendNotice } from "./notify";

/**
 * The publishing run (posts plan U8, R32). One call claims the posts that are due and publishes each once. Safe to call
 * from any pinger every few minutes, and safe if two calls overlap:
 *  - nothing is claimed unless LYNKR_AUTOPUBLISH is "on", so with it off nothing is ever sent;
 *  - the claim is ONE statement (scheduled -> publishing, for update skip locked), so a post belongs to one run;
 *  - after LinkedIn answers: 201 -> published; a definite refusal -> failed; a timeout, network error, 429 or 5xx -> unknown;
 *    an unknown post is never retried by the run;
 *  - 'publishing' for over 10 minutes (the process died) becomes unknown, never published again;
 *  - more than 6 hours late is failed "late", not published. 'manual' posts are never touched.
 * Counts only; no text, token or id leaves this function.
 */

export const BATCH = 20;
export const STUCK_MS = 10 * 60_000;
export const LATE_MS = 6 * 3600_000;

export type RunDeps = { db: Db; now?: Date; fetch?: typeof fetch; send?: SendNotice; /** For tests: ignore the switch's current value. */ enabled?: boolean };
export type RunCounts = { claimed: number; published: number; failed: number; unknown: number; late: number };

type Claimed = { id: string; user_id: string; current_version_id: string | null };

export async function runDue(deps: RunDeps): Promise<RunCounts> {
  const { db } = deps;
  const now = deps.now ?? new Date();
  const counts: RunCounts = { claimed: 0, published: 0, failed: 0, unknown: 0, late: 0 };
  if (!(deps.enabled ?? autopublishOn())) return counts;
  const said = (userId: string, sentence: string) => notify(db, userId, sentence, deps.send);

  // 1. A post stuck in 'publishing' (the process died mid-call): we cannot know whether LinkedIn got it. Never re-published.
  const stuck = await db.query<{ user_id: string }>(
    `update posts set status = 'unknown', fail_reason = 'stuck', claimed_at = null, updated_at = now()
     where status = 'publishing' and claimed_at < $1::timestamptz returning user_id`,
    [new Date(now.getTime() - STUCK_MS).toISOString()],
  );
  for (const r of stuck.rows) { counts.unknown++; await said(r.user_id, NOTICE.unknown); }

  // 2. Too late to publish: the person planned a time, hours ago. Say so rather than post at a surprising moment.
  const late = await db.query<{ user_id: string }>(
    `update posts set status = 'failed', fail_reason = 'late', updated_at = now()
     where status = 'scheduled' and publish_mode = 'auto' and scheduled_at < $1::timestamptz returning user_id`,
    [new Date(now.getTime() - LATE_MS).toISOString()],
  );
  for (const r of late.rows) { counts.late++; await said(r.user_id, NOTICE.late); }

  // 3. Claim what is due: one atomic statement.
  const claimed = await db.query<Claimed>(
    `update posts set status = 'publishing', claimed_at = $1::timestamptz, updated_at = now()
     where id in (
       select id from posts where status = 'scheduled' and publish_mode = 'auto' and scheduled_at <= $1::timestamptz
       order by scheduled_at limit ${BATCH} for update skip locked
     ) and status = 'scheduled'
     returning id, user_id, current_version_id`,
    [now.toISOString()],
  );
  counts.claimed = claimed.rows.length;

  await Promise.all(claimed.rows.map(async (row) => {
    const result = await publishOne(db, row, deps.fetch, now);
    if (result.status === "published") { counts.published++; return; }
    if (result.status === "unknown") { counts.unknown++; await said(row.user_id, NOTICE.unknown); return; }
    counts.failed++;
    await said(row.user_id, NOTICE.failed);
  }));
  return counts;
}

type Settled = { status: "published" | "failed" | "unknown" };

async function settle(db: Db, id: string, status: "published" | "failed" | "unknown", extra: { urn?: string | null; reason?: string; now?: Date } = {}): Promise<Settled> {
  await db.query(
    `update posts set status = $2::text, linkedin_urn = $3, fail_reason = $4, published_at = case when $2::text = 'published' then $5::timestamptz else published_at end, claimed_at = null, updated_at = now()
     where id = $1::uuid and status = 'publishing'`,
    [id, status, extra.urn ?? null, extra.reason ?? null, (extra.now ?? new Date()).toISOString()],
  );
  return { status };
}

async function publishOne(db: Db, row: Claimed, doFetch: typeof fetch | undefined, now: Date): Promise<Settled> {
  try {
    const version = row.current_version_id
      ? (await db.query<{ body: string }>("select body from post_versions where id = $1::uuid and user_id = $2", [row.current_version_id, row.user_id])).rows[0]
      : undefined;
    if (!version?.body.trim()) return await settle(db, row.id, "failed", { reason: "no_text" });
    const acct = await linkedinAccount(db, row.user_id);
    // Not connected, no write scope or an expired token: LinkedIn was never called, so this is a definite failure.
    if (!acct?.token || !acct.scopes.includes("w_member_social") || !acct.expiresAt || acct.expiresAt.getTime() <= now.getTime()) {
      return await settle(db, row.id, "failed", { reason: "not_connected" });
    }
    const out = await publishText({ token: acct.token, accountId: acct.accountId, text: version.body, fetch: doFetch });
    if (out.kind === "published") return await settle(db, row.id, "published", { urn: out.urn, now });
    if (out.kind === "refused") return await settle(db, row.id, "failed", { reason: out.code });
    return await settle(db, row.id, "unknown", { reason: "no_answer" });
  } catch {
    // Anything unexpected after the claim: do not guess, and never retry. If LinkedIn might have the post, it is "check".
    try { return await settle(db, row.id, "unknown", { reason: "error" }); } catch { return { status: "unknown" }; }
  }
}
