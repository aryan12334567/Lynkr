import type { Db } from "../db";
import { istToUTC } from "../ist";
import type { MoveResult, PostsOwner } from "../calendar/move";
import { postFeedItems } from "../calendar/sources";
import { textProblems, type Problem } from "./checks";
import { getPost, getVersion, POST_COLUMNS, toPost, type Post, type PostRow } from "./db";
import { connectionStatus } from "./linkedin";
import { evidenceFor } from "./serve";

/**
 * Scheduling and the manual path (posts plan U7, U8, R32). Every statement filters on the user id, so a post that is not
 * the person's is a 404 that changes nothing. Scheduling never sends anything: it sets a time and a mode. 'auto' only when
 * the person can publish right now (switch on, LinkedIn connected with the write scope, token fresh); otherwise 'manual',
 * a reminder the person acts on themselves.
 */

export const MIN_LEAD_MS = 5 * 60_000;
export const MAX_LEAD_MS = 90 * 24 * 3600_000;

export type Outcome = { ok: true; post: Post; replayed?: boolean } | { ok: false; status: number; error: string; problems?: Problem[] };
const fail = (status: number, error: string, problems?: Problem[]): Outcome => ({ ok: false, status, error, ...(problems ? { problems } : {}) });

/** The text rules for scheduling: the same check the editor shows, without the word-count range (a hand edit may be short). */
async function textRulesFail(db: Db, userId: string, post: Post): Promise<Problem[] | null> {
  const version = post.currentVersionId ? await getVersion(db, userId, post.id, post.currentVersionId) : null;
  if (!version) return [{ code: "no_text", message: "Choose a version of the text first." }];
  const problems = textProblems(version.body, await evidenceFor(db, userId, post), { length: null });
  return problems.length ? problems : null;
}

function timeProblem(at: Date, now: Date): string | null {
  if (Number.isNaN(at.getTime())) return "Use a real date and time.";
  if (at.getTime() < now.getTime() + MIN_LEAD_MS) return "Pick a time at least 5 minutes from now.";
  if (at.getTime() > now.getTime() + MAX_LEAD_MS) return "Pick a time within the next 90 days.";
  return null;
}

async function whyNot(db: Db, userId: string, id: string, wantScheduled: boolean): Promise<Outcome> {
  const p = await getPost(db, userId, id);
  if (!p) return fail(404, "That post was not found.");
  if (p.status === "publishing") return fail(409, "Publishing now");
  if (wantScheduled) return fail(409, "This post isn't scheduled.");
  return fail(409, p.status === "published" ? "This post is already posted." : "Approve the post before you schedule it.");
}

/**
 * Schedule (or move the time of) an approved post, or with `at: null` cancel the schedule and return it to 'approved'.
 * `opId` is stored so the Calendar's move can be repeated safely.
 */
export async function setSchedule(db: Db, userId: string, id: string, at: Date | null, opts: { now?: Date; opId?: string } = {}): Promise<Outcome> {
  const now = opts.now ?? new Date();
  if (at === null) {
    const r = await db.query<PostRow>(
      `update posts set status = 'approved', scheduled_at = null, publish_mode = null, claimed_at = null, updated_at = now()
       where id::text = $2 and user_id = $1 and status = 'scheduled' returning ${POST_COLUMNS}`,
      [userId, id],
    );
    return r.rows[0] ? { ok: true, post: toPost(r.rows[0]) } : whyNot(db, userId, id, true);
  }
  const post = await getPost(db, userId, id);
  if (!post) return fail(404, "That post was not found.");
  if (post.status === "publishing") return fail(409, "Publishing now");
  if (post.status !== "approved" && post.status !== "scheduled") return whyNot(db, userId, id, false);
  const tooSoon = timeProblem(at, now);
  if (tooSoon) return fail(400, tooSoon);
  const problems = await textRulesFail(db, userId, post);
  if (problems) return fail(409, "Fix the text before you schedule it.", problems);
  const mode = (await connectionStatus(db, userId, now)).canPublish ? "auto" : "manual";
  const r = await db.query<PostRow>(
    `update posts set status = 'scheduled', scheduled_at = $3::timestamptz, publish_mode = $4, fail_reason = null, last_op_id = coalesce($5, last_op_id), updated_at = now()
     where id::text = $2 and user_id = $1 and status in ('approved', 'scheduled') returning ${POST_COLUMNS}`,
    [userId, id, at.toISOString(), mode, opts.opId ?? null],
  );
  return r.rows[0] ? { ok: true, post: toPost(r.rows[0]) } : whyNot(db, userId, id, false);
}

/**
 * The person posted it on LinkedIn themselves. Allowed from approved, from a scheduled reminder, and (so a post is never
 * stuck) from 'unknown' or 'failed' once they have checked LinkedIn. A scheduled 'auto' post is refused: the server will
 * publish it, so cancel the schedule first.
 */
export async function markPosted(db: Db, userId: string, id: string, now: Date = new Date()): Promise<Outcome> {
  const r = await db.query<PostRow>(
    `update posts set status = 'published', publish_mode = 'manual', published_at = $3::timestamptz, fail_reason = null, claimed_at = null, updated_at = now()
     where id::text = $2 and user_id = $1
       and (status in ('approved', 'unknown', 'failed') or (status = 'scheduled' and coalesce(publish_mode, 'manual') = 'manual'))
     returning ${POST_COLUMNS}`,
    [userId, id, now.toISOString()],
  );
  if (r.rows[0]) return { ok: true, post: toPost(r.rows[0]) };
  const p = await getPost(db, userId, id);
  if (!p) return fail(404, "That post was not found.");
  if (p.status === "publishing") return fail(409, "Publishing now");
  if (p.status === "scheduled") return fail(409, "Cancel the schedule first: Lynkr will post this one for you.");
  if (p.status === "published") return { ok: true, post: p, replayed: true };
  return fail(409, "Approve the post before you mark it posted.");
}

/** Posts' side of a Calendar move (lib/calendar/move.ts). Same rules as scheduling; one op id changes the post once. */
export function postsOwner(db: Db, opts: { now?: () => Date } = {}): PostsOwner {
  return {
    async reschedule(userId, id, day, time, opId): Promise<MoveResult> {
      const now = opts.now?.() ?? new Date();
      const post = await getPost(db, userId, id.slice(0, 60));
      if (!post) return { status: 404, body: { error: "Item not found." } };
      const item = (p: Post) => postFeedItems([p], { paid: true })[0] ?? null;
      const last = (await db.query<{ last_op_id: string | null }>("select last_op_id from posts where id::text = $2 and user_id = $1", [userId, id])).rows[0]?.last_op_id;
      if (last && last === opId) return { status: 200, body: { ok: true, replayed: true, item: item(post) } };
      if (post.status === "publishing") return { status: 409, body: { error: "Publishing now" } };
      if (post.status !== "scheduled" || !post.scheduledAt) return { status: 409, body: { error: "Only a scheduled post can be moved." } };
      const clock = time ?? new Date(new Date(post.scheduledAt).getTime() + 330 * 60_000).toISOString().slice(11, 16);
      const out = await setSchedule(db, userId, post.id, istToUTC(day, clock), { now, opId });
      if (!out.ok) return { status: out.status, body: { error: out.error, ...(out.problems ? { problems: out.problems } : {}) } };
      return { status: 200, body: { ok: true, replayed: false, item: item(out.post) } };
    },
  };
}

