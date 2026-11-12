import type { Db } from "../db";
import type { LogEntry } from "./log";

/**
 * Comments that warm Outreach (Commenter plan R17). A posted comment is linked to a contact only when the person
 * confirms it; the name match only suggests. A linked comment may give a first message one bridge: the date and the
 * person's own comment, nothing else from the log (the author's headline is never used).
 */

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().toLowerCase();

type Row = { id: string; author_name: string | null; author_headline: string | null; body: string; goal: string; angle: string; source: string; posted: boolean | null; contact_id: string | null; created_at: string | Date };
const COLS = "id, author_name, author_headline, body, goal, angle, source, posted, contact_id, created_at";
const toEntry = (r: Row): LogEntry => ({
  id: r.id, authorName: r.author_name, authorHeadline: r.author_headline, body: r.body, goal: r.goal, angle: r.angle, source: r.source,
  posted: r.posted, contactId: r.contact_id, createdAt: new Date(r.created_at).toISOString(),
});

/** Posted, not-yet-linked entries whose author's name matches (case, accents and spacing ignored). Several matches are all returned: the person picks. */
export async function suggestForName(db: Db, userId: string, name: string): Promise<LogEntry[]> {
  const want = norm(name);
  if (!want) return [];
  const r = await db.query<Row>(`select ${COLS} from comment_log where user_id = $1 and posted is true and contact_id is null and author_name is not null order by created_at desc limit 200`, [userId]);
  return r.rows.filter((x) => norm(x.author_name ?? "") === want).map(toEntry);
}

/** Links one posted entry to one of the person's contacts. False when either is not theirs, or the entry was not posted. */
export async function linkEntry(db: Db, userId: string, entryId: string, contactId: string | null): Promise<boolean> {
  if (contactId !== null) {
    const c = await db.query("select 1 from contacts where id = $1 and user_id = $2", [contactId, userId]);
    if (!c.rows[0]) return false;
  }
  const r = await db.query("update comment_log set contact_id = $3 where id::text = $2 and user_id = $1 and posted is true returning 1", [userId, entryId, contactId]);
  return r.rows.length > 0;
}

/** The newest linked, posted comment on this contact's post, or null. */
export async function linkedFor(db: Db, userId: string, contactId: string): Promise<LogEntry | null> {
  const r = await db.query<Row>(`select ${COLS} from comment_log where user_id = $1 and contact_id = $2 and posted is true order by created_at desc limit 1`, [userId, contactId]);
  return r.rows[0] ? toEntry(r.rows[0]) : null;
}

/** "3 Nov" in IST. */
export const shortDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));

/** The one line a draft may use. Only the date and the person's own comment; it is cleaned again by the draft engine. */
export function bridgeText(e: LogEntry): string {
  return `Commented on their post on ${shortDate(e.createdAt)}: "${e.body.replace(/\s+/g, " ").trim().slice(0, 240)}"`;
}
