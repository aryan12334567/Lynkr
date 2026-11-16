import type { Db } from "../db";

/**
 * Posts storage (posts plan U1). Every function takes the user id and every statement filters on it, so one person can
 * never read or change another's post. Ids arrive from the browser as text, so they are compared as text: a malformed id
 * finds nothing instead of throwing.
 */

export const POST_TYPES = ["proof", "setback", "observation"] as const;
export type PostType = (typeof POST_TYPES)[number];
export type PostMode = "quick" | "thorough";
export type PostStatus = "draft" | "approved" | "scheduled" | "publishing" | "published" | "failed" | "cancelled" | "unknown";
export type VersionSource = "write" | "refine" | "manual";

export type Post = {
  id: string;
  type: PostType;
  brief: string;
  mode: PostMode;
  status: PostStatus;
  weekStart: string | null;
  slotIndex: number | null;
  scheduledAt: string | null;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PostAnswer = { turn: number; key: string; question: string; answer: string };
export type PostVersion = {
  id: string;
  n: number;
  batch: number;
  body: string;
  why: string;
  factRefs: string[];
  answerRefs: string[];
  source: VersionSource;
  instruction: string | null;
  parentId: string | null;
  createdAt: string;
};

type PostRow = { id: string; type: PostType; brief: string; mode: PostMode; status: PostStatus; week_start: string | null; slot_index: number | null; scheduled_at: string | Date | null; current_version_id: string | null; created_at: string | Date; updated_at: string | Date };
const POST_COLS = "id, type, brief, mode, status, week_start::text as week_start, slot_index, scheduled_at, current_version_id, created_at, updated_at";
const iso = (d: string | Date) => new Date(d).toISOString();
const toPost = (r: PostRow): Post => ({
  id: r.id, type: r.type, brief: r.brief, mode: r.mode, status: r.status, weekStart: r.week_start, slotIndex: r.slot_index === null ? null : Number(r.slot_index),
  scheduledAt: r.scheduled_at ? iso(r.scheduled_at) : null, currentVersionId: r.current_version_id, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
});

export async function getPost(db: Db, userId: string, id: string): Promise<Post | null> {
  const r = await db.query<PostRow>(`select ${POST_COLS} from posts where id::text = $2 and user_id = $1`, [userId, id]);
  return r.rows[0] ? toPost(r.rows[0]) : null;
}

/** Newest first. With `weekStart`, only the posts of that plan week. */
export async function listPosts(db: Db, userId: string, opts: { weekStart?: string; limit?: number } = {}): Promise<Post[]> {
  const r = opts.weekStart
    ? await db.query<PostRow>(`select ${POST_COLS} from posts where user_id = $1 and week_start = $2::date order by slot_index, created_at`, [userId, opts.weekStart])
    : await db.query<PostRow>(`select ${POST_COLS} from posts where user_id = $1 order by updated_at desc limit $2`, [userId, Math.min(opts.limit ?? 100, 200)]);
  return r.rows.map(toPost);
}

export type NewPost = { type: PostType; brief: string; mode: PostMode; weekStart?: string; slotIndex?: number };

/** A post for a plan slot is created once: asking again returns the one that exists. A free-write post has no slot. */
export async function createPost(db: Db, userId: string, p: NewPost): Promise<Post> {
  const slot = p.weekStart !== undefined && p.slotIndex !== undefined;
  const r = await db.query<PostRow>(
    `insert into posts (user_id, type, brief, mode, week_start, slot_index) values ($1, $2, $3, $4, $5::date, $6)
     on conflict (user_id, week_start, slot_index) where slot_index is not null do nothing
     returning ${POST_COLS}`,
    [userId, p.type, p.brief.slice(0, 400), p.mode, slot ? p.weekStart : null, slot ? p.slotIndex : null],
  );
  if (r.rows[0]) return toPost(r.rows[0]);
  const again = await db.query<PostRow>(`select ${POST_COLS} from posts where user_id = $1 and week_start = $2::date and slot_index = $3`, [userId, p.weekStart, p.slotIndex]);
  return toPost(again.rows[0]);
}

export type PostPatch = { type?: PostType; brief?: string; mode?: PostMode; status?: PostStatus };

export async function updatePost(db: Db, userId: string, id: string, patch: PostPatch): Promise<Post | null> {
  const r = await db.query<PostRow>(
    `update posts set type = coalesce($3, type), brief = coalesce($4, brief), mode = coalesce($5, mode), status = coalesce($6, status), updated_at = now()
     where id::text = $2 and user_id = $1 returning ${POST_COLS}`,
    [userId, id, patch.type ?? null, patch.brief === undefined ? null : patch.brief.slice(0, 400), patch.mode ?? null, patch.status ?? null],
  );
  return r.rows[0] ? toPost(r.rows[0]) : null;
}

/** Removes the post with its answers and versions (they cascade). */
export async function deletePost(db: Db, userId: string, id: string): Promise<boolean> {
  return (await db.query("delete from posts where id::text = $2 and user_id = $1 returning 1", [userId, id])).rows.length > 0;
}

// ---- interview answers ----

type AnswerRow = { turn: number; qkey: string; question: string; answer: string };
const toAnswer = (r: AnswerRow): PostAnswer => ({ turn: Number(r.turn), key: r.qkey, question: r.question, answer: r.answer });

export async function listAnswers(db: Db, userId: string, postId: string): Promise<PostAnswer[]> {
  const r = await db.query<AnswerRow>("select turn, qkey, question, answer from post_answers where user_id = $1 and post_id::text = $2 order by turn", [userId, postId]);
  return r.rows.map(toAnswer);
}

/** Adds the next answer to the person's own post. Null when the post is not theirs. */
export async function addAnswer(db: Db, userId: string, postId: string, a: { key: string; question: string; answer: string }): Promise<PostAnswer | null> {
  const r = await db.query<AnswerRow>(
    `insert into post_answers (user_id, post_id, turn, qkey, question, answer)
     select p.user_id, p.id, coalesce((select max(turn) from post_answers where post_id = p.id), 0) + 1, $3, $4, $5
     from posts p where p.id::text = $2 and p.user_id = $1
     returning turn, qkey, question, answer`,
    [userId, postId, a.key.slice(0, 40), a.question.slice(0, 400), a.answer.slice(0, 1500)],
  );
  return r.rows[0] ? toAnswer(r.rows[0]) : null;
}

// ---- versions ----

type VersionRow = { id: string; n: number; batch: number; body: string; why: string; fact_refs: string[]; answer_refs: string[]; source: VersionSource; instruction: string | null; parent_id: string | null; created_at: string | Date };
const VERSION_COLS = "id, n, batch, body, why, fact_refs, answer_refs, source, instruction, parent_id, created_at";
const toVersion = (r: VersionRow): PostVersion => ({
  id: r.id, n: Number(r.n), batch: Number(r.batch), body: r.body, why: r.why, factRefs: r.fact_refs, answerRefs: r.answer_refs, source: r.source,
  instruction: r.instruction, parentId: r.parent_id, createdAt: iso(r.created_at),
});

export async function listVersions(db: Db, userId: string, postId: string): Promise<PostVersion[]> {
  const r = await db.query<VersionRow>(`select ${VERSION_COLS} from post_versions where user_id = $1 and post_id::text = $2 order by n`, [userId, postId]);
  return r.rows.map(toVersion);
}

export async function getVersion(db: Db, userId: string, postId: string, versionId: string): Promise<PostVersion | null> {
  const r = await db.query<VersionRow>(`select ${VERSION_COLS} from post_versions where user_id = $1 and post_id::text = $2 and id::text = $3`, [userId, postId, versionId]);
  return r.rows[0] ? toVersion(r.rows[0]) : null;
}

export type NewVersion = { body: string; why: string; factRefs: string[]; answerRefs: string[]; source: VersionSource; batch?: number; instruction?: string; parentId?: string };

/** Adds a version and makes it the post's current one. Null when the post is not theirs. Nothing already stored changes. */
export async function addVersion(db: Db, userId: string, postId: string, v: NewVersion): Promise<PostVersion | null> {
  const r = await db.query<VersionRow>(
    `insert into post_versions (user_id, post_id, n, batch, body, why, fact_refs, answer_refs, source, instruction, parent_id)
     select p.user_id, p.id, coalesce((select max(n) from post_versions where post_id = p.id), 0) + 1, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10::uuid
     from posts p where p.id::text = $2 and p.user_id = $1
     returning ${VERSION_COLS}`,
    [userId, postId, v.batch ?? 0, v.body, v.why.slice(0, 400), JSON.stringify(v.factRefs), JSON.stringify(v.answerRefs), v.source, v.instruction?.slice(0, 300) ?? null, v.parentId ?? null],
  );
  if (!r.rows[0]) return null;
  await db.query("update posts set current_version_id = $3::uuid, updated_at = now() where id::text = $2 and user_id = $1", [userId, postId, r.rows[0].id]);
  return toVersion(r.rows[0]);
}

/** Going back to an earlier version makes it current; every version stays. Null when either is not theirs. */
export async function setCurrentVersion(db: Db, userId: string, postId: string, versionId: string): Promise<Post | null> {
  const r = await db.query(
    `update posts set current_version_id = $3::uuid, updated_at = now()
     where id::text = $2 and user_id = $1 and exists (select 1 from post_versions v where v.post_id = posts.id and v.user_id = $1 and v.id::text = $3)
     returning 1`,
    [userId, postId, versionId],
  );
  return r.rows.length ? getPost(db, userId, postId) : null;
}
