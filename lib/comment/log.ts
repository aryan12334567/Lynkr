import { takeDaily, type Db } from "../db";
import type { Verified } from "./receipt";

/** The comment log (Commenter plan U1, R13, R18). Rows come only from a verified receipt. */

export const DAILY_LOG_WRITES = 60;
export const UNPOSTED_DAYS = 7;
export const KEEP_MONTHS = 12;

export type LogEntry = {
  id: string;
  authorName: string | null;
  authorHeadline: string | null;
  body: string;
  goal: string;
  angle: string;
  source: string;
  posted: boolean | null;
  contactId: string | null;
  createdAt: string;
};

type Row = { id: string; author_name: string | null; author_headline: string | null; body: string; goal: string; angle: string; source: string; posted: boolean | null; contact_id: string | null; created_at: string | Date };
const toEntry = (r: Row): LogEntry => ({
  id: r.id, authorName: r.author_name, authorHeadline: r.author_headline, body: r.body, goal: r.goal, angle: r.angle, source: r.source,
  posted: r.posted, contactId: r.contact_id, createdAt: new Date(r.created_at).toISOString(),
});
const COLS = "id, author_name, author_headline, body, goal, angle, source, posted, contact_id, created_at";

/** One row per receipt: an Insert followed by a Copy of the same option updates one row. Null when the day's cap is used. */
export async function recordFromReceipt(db: Db, userId: string, v: Verified, body: string): Promise<LogEntry | null> {
  const existing = await db.query<Row>(`select ${COLS} from comment_log where receipt_id = $1 and user_id = $2`, [v.id, userId]);
  if (existing.rows[0]) return toEntry(existing.rows[0]);
  if (!(await takeDaily(db, userId, "comment_log", DAILY_LOG_WRITES))) return null;
  const r = await db.query<Row>(
    `insert into comment_log (user_id, author_name, author_headline, body, goal, angle, source, receipt_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (receipt_id) do update set receipt_id = excluded.receipt_id
     returning ${COLS}`,
    [userId, v.authorName.slice(0, 120) || null, v.authorHeadline.slice(0, 220) || null, body, v.goal, v.angle, v.source, v.id],
  );
  return toEntry(r.rows[0]);
}

/** Sets the person's answer. Only on their own row. */
export async function setPosted(db: Db, userId: string, id: string, posted: boolean | null): Promise<LogEntry | null> {
  const r = await db.query<Row>(`update comment_log set posted = $3 where id::text = $2 and user_id = $1 returning ${COLS}`, [userId, id, posted]);
  return r.rows[0] ? toEntry(r.rows[0]) : null;
}

export async function removeEntry(db: Db, userId: string, id: string): Promise<boolean> {
  return (await db.query(`delete from comment_log where id::text = $2 and user_id = $1 returning 1`, [userId, id])).rows.length > 0;
}

/** The last posted entries, newest first (R14). */
export async function listPosted(db: Db, userId: string, limit = 50, since?: Date): Promise<LogEntry[]> {
  const r = await db.query<Row>(
    `select ${COLS} from comment_log where user_id = $1 and posted is true ${since ? "and created_at >= $3" : ""} order by created_at desc limit $2`,
    since ? [userId, limit, since] : [userId, limit],
  );
  return r.rows.map(toEntry);
}

export async function countPostedSince(db: Db, userId: string, since: Date): Promise<number> {
  const r = await db.query<{ n: string | number }>("select count(*) as n from comment_log where user_id = $1 and posted is true and created_at >= $2", [userId, since]);
  return Number(r.rows[0]?.n ?? 0);
}

/** Retention (KTD5): unposted entries after 7 days, everything after 12 months. Returns the number removed. */
export async function purgeOld(db: Db, now: Date = new Date()): Promise<number> {
  const week = new Date(now.getTime() - UNPOSTED_DAYS * 86400000);
  const year = new Date(now);
  year.setUTCMonth(year.getUTCMonth() - KEEP_MONTHS);
  const r = await db.query("delete from comment_log where (posted is not true and created_at < $1) or created_at < $2 returning 1", [week, year]);
  return r.rows.length;
}
