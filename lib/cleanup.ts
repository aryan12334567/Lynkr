import { deleteAll, inactiveUsers, type Db } from "./db";

/**
 * Scheduled cleanup (decision 6: data is kept until the person deletes it, and removed after
 * 12 months of inactivity). Removes Lynkr's rows for those users; the sign-in account stays.
 */
export const INACTIVE_MONTHS = 12;

export function cutoff(now: Date): Date {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - INACTIVE_MONTHS);
  return d;
}

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET". Refuse everything when the secret isn't set. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 16) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Returns how many users matched. In dry-run mode nothing is deleted. Never returns ids or content. */
export async function cleanup(db: Db, opts: { now?: Date; dryRun: boolean }): Promise<{ users: number; rows: number; dryRun: boolean }> {
  const ids = await inactiveUsers(db, cutoff(opts.now ?? new Date()));
  let rows = 0;
  if (!opts.dryRun) for (const id of ids) rows += Object.values(await deleteAll(db, id)).reduce((a, b) => a + b, 0);
  return { users: ids.length, rows, dryRun: opts.dryRun };
}
