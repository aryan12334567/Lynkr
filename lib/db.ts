import { databaseUrl } from "./dbUrl";
import { Pool } from "pg";
import type { FactConfidence, FactKind, ReviewStatus, StoryFact } from "./schemas";
import type { Answer } from "./interview/engine";

/**
 * Account storage for vertical 1 (build plan Part 1b): the context brief, Story Vault, interview
 * answers, drafts and plan items, all keyed to the Better Auth user. Every function takes the
 * user id and every statement filters on it, so one person can never read or change another's rows.
 * Answer text is never logged.
 */

/** Anything that runs a parameterised query: a pg Pool in the app, an in-process Postgres in tests. */
export type Db = { query: <R = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: R[] }> };

let pool: Pool | null = null;

/** The app's pooled connection (see lib/dbUrl.ts). Created on first use. */
export function getDb(): Db {
  if (!pool) pool = new Pool({ connectionString: databaseUrl(), max: 3 });
  return pool as unknown as Db;
}

const LATEST = "001_vertical1.sql";
let ready: { ok: boolean; at: number } | null = null;

/**
 * True once migration 001 has run on this database. Until then (for example a preview build that
 * shares a database nobody has migrated), the app keeps the person's context in the browser instead.
 */
export async function cloudReady(db?: Db): Promise<boolean> {
  if (!databaseUrl() && !db) return false;
  if (!db && ready && Date.now() - ready.at < 5 * 60_000) return ready.ok;
  let ok = false;
  try {
    const d = db ?? getDb();
    const r = await d.query<{ t: string | null }>("select to_regclass('public.lynkr_migrations')::text as t");
    if (r.rows[0]?.t) ok = (await d.query("select 1 from lynkr_migrations where name = $1", [LATEST])).rows.length > 0;
  } catch {
    ok = false;
  }
  if (!db) ready = { ok, at: Date.now() };
  return ok;
}

/** Test hook: forget the cached readiness answer. */
export function resetCloudReady() {
  ready = null;
}

// ---- the Lynkr user row: consent, "save my answers", last activity ----

export type Settings = { consentAt: string | null; saveAnswers: boolean };

export async function touchUser(db: Db, userId: string): Promise<Settings> {
  const r = await db.query<{ consent_at: Date | null; save_answers: boolean }>(
    `insert into lynkr_user (user_id) values ($1)
     on conflict (user_id) do update set last_active_at = now()
     returning consent_at, save_answers`,
    [userId],
  );
  const row = r.rows[0];
  return { consentAt: row.consent_at ? new Date(row.consent_at).toISOString() : null, saveAnswers: row.save_answers };
}

export async function updateSettings(db: Db, userId: string, s: { consent?: boolean; saveAnswers?: boolean }): Promise<void> {
  await touchUser(db, userId);
  if (s.consent) await db.query("update lynkr_user set consent_at = coalesce(consent_at, now()) where user_id = $1", [userId]);
  if (typeof s.saveAnswers === "boolean") {
    await db.query("update lynkr_user set save_answers = $2 where user_id = $1", [userId, s.saveAnswers]);
    // Switching it off removes the answers already saved.
    if (!s.saveAnswers) await db.query("delete from interview_answers where user_id = $1", [userId]);
  }
}

// ---- context brief (versioned) ----

export async function getBrief<T = Record<string, unknown>>(db: Db, userId: string): Promise<{ version: number; data: T } | null> {
  const r = await db.query<{ version: number; data: T }>("select version, data from context_brief where user_id = $1 order by version desc limit 1", [userId]);
  return r.rows[0] ?? null;
}

/** Adds a new version only when something changed. Returns the current version. */
export async function saveBrief(db: Db, userId: string, data: Record<string, unknown>): Promise<number> {
  const cur = await getBrief(db, userId);
  if (cur && JSON.stringify(cur.data) === JSON.stringify(data)) return cur.version;
  const r = await db.query<{ version: number }>(
    `insert into context_brief (user_id, version, data)
     values ($1, coalesce((select max(version) from context_brief where user_id = $1), 0) + 1, $2::jsonb)
     returning version`,
    [userId, JSON.stringify(data)],
  );
  return r.rows[0].version;
}

// ---- Story Vault ----

type FactRow = {
  fact_key: string;
  kind: FactKind;
  text: string;
  confidence: FactConfidence | null;
  source_qid: string | null;
  status: ReviewStatus;
  use_in_drafts: boolean;
  updated_at: Date;
};

const toFact = (r: FactRow): StoryFact => ({
  id: r.fact_key,
  kind: r.kind,
  text: r.text,
  sourceTurnIds: [],
  reviewStatus: r.status,
  useInDrafts: r.use_in_drafts,
  ...(r.source_qid ? { sourceQid: r.source_qid } : {}),
  ...(r.confidence ? { confidence: r.confidence } : {}),
  updatedAt: new Date(r.updated_at).toISOString(),
});

export async function listFacts(db: Db, userId: string): Promise<StoryFact[]> {
  const r = await db.query<FactRow>(
    "select fact_key, kind, text, confidence, source_qid, status, use_in_drafts, updated_at from facts where user_id = $1 order by updated_at, fact_key",
    [userId],
  );
  return r.rows.map(toFact);
}

/** Confirmed facts that are switched on for drafts: what every AI request may use. */
export async function confirmedFacts(db: Db, userId: string): Promise<StoryFact[]> {
  return (await listFacts(db, userId)).filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts);
}

async function nextKey(db: Db, userId: string): Promise<string> {
  const r = await db.query<{ n: number | null }>("select max(substring(fact_key from 2)::int) as n from facts where user_id = $1 and fact_key ~ '^F[0-9]+$'", [userId]);
  return `F${(r.rows[0]?.n ?? 0) + 1}`;
}

/**
 * Facts from one interview answer. Re-saving the same answer updates the same rows (never duplicates);
 * a fact the person already confirmed or excluded keeps their wording.
 */
export async function upsertAnswerFacts(
  db: Db,
  userId: string,
  qid: string,
  attempt: number,
  facts: { kind: FactKind; text: string; confidence: FactConfidence }[],
): Promise<StoryFact[]> {
  const out: StoryFact[] = [];
  for (const [i, f] of facts.entries()) {
    const key = await nextKey(db, userId);
    const r = await db.query<FactRow>(
      `insert into facts (user_id, fact_key, kind, text, confidence, source_qid, source_attempt, source_idx, status, use_in_drafts)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, 'candidate', false)
       on conflict (user_id, source_qid, source_attempt, source_idx) where source_qid is not null
       do update set kind = excluded.kind, text = excluded.text, confidence = excluded.confidence, updated_at = now()
         where facts.status = 'candidate'
       returning fact_key, kind, text, confidence, source_qid, status, use_in_drafts, updated_at`,
      [userId, key, f.kind, f.text.slice(0, 400), JSON.stringify(f.confidence), qid, attempt, i],
    );
    if (r.rows[0]) out.push(toFact(r.rows[0]));
  }
  // Fewer facts than before from this answer: drop the leftover candidates.
  await db.query("delete from facts where user_id = $1 and source_qid = $2 and source_attempt = $3 and source_idx >= $4 and status = 'candidate'", [userId, qid, attempt, facts.length]);
  return out;
}

/**
 * Save edits from the vault screen or another browser. Newest edit wins: a row only changes
 * when the incoming copy is at least as new as the stored one. Returns the facts that lost.
 */
export async function saveFacts(db: Db, userId: string, facts: StoryFact[]): Promise<{ saved: number; older: string[] }> {
  let saved = 0;
  const older: string[] = [];
  for (const f of facts) {
    const at = f.updatedAt ? new Date(f.updatedAt) : new Date();
    const r = await db.query(
      `insert into facts (user_id, fact_key, kind, text, confidence, source_qid, status, use_in_drafts, updated_at)
       values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
       on conflict (user_id, fact_key) do update
         set kind = excluded.kind, text = excluded.text, confidence = excluded.confidence,
             status = excluded.status, use_in_drafts = excluded.use_in_drafts, updated_at = excluded.updated_at
         where facts.updated_at <= excluded.updated_at
       returning fact_key`,
      [userId, f.id.slice(0, 12), f.kind, f.text.trim().slice(0, 400), f.confidence ? JSON.stringify(f.confidence) : null, f.sourceQid ?? null, f.reviewStatus, f.useInDrafts, at],
    );
    if (r.rows.length) saved++;
    else older.push(f.id);
  }
  return { saved, older };
}

/** Drop unreviewed facts from follow-ups that no longer exist (the main answer was edited). */
export async function pruneAnswerFacts(db: Db, userId: string, qid: string, keepAttempts: number[]): Promise<void> {
  await db.query("delete from facts where user_id = $1 and source_qid = $2 and status = 'candidate' and not (source_attempt = any($3::smallint[]))", [userId, qid, keepAttempts]);
}

export async function deleteFact(db: Db, userId: string, factKey: string): Promise<boolean> {
  const r = await db.query("delete from facts where user_id = $1 and fact_key = $2 returning fact_key", [userId, factKey]);
  return r.rows.length > 0;
}

// ---- interview answers ----

type AnswerRow = { qid: string; attempt: number; status: Answer["status"]; answer: string; meta: Partial<Answer> };

export async function listAnswers(db: Db, userId: string): Promise<Answer[]> {
  const r = await db.query<AnswerRow>("select qid, attempt, status, answer, meta from interview_answers where user_id = $1 order by updated_at, qid, attempt", [userId]);
  return r.rows.map((x) => ({ ...(x.meta ?? {}), qid: x.qid, attempt: Number(x.attempt), status: x.status, text: x.answer }));
}

/** Insert or replace by (question, attempt). Saving twice never adds a second row. */
export async function upsertAnswer(db: Db, userId: string, a: Answer): Promise<void> {
  const meta: Partial<Answer> = {};
  for (const k of ["trigger", "round", "vague", "should", "followUpText", "at"] as const) if (a[k] !== undefined) (meta as Record<string, unknown>)[k] = a[k];
  await db.query(
    `insert into interview_answers (user_id, qid, attempt, status, answer, meta) values ($1, $2, $3, $4, $5, $6::jsonb)
     on conflict (user_id, qid, attempt) do update set status = excluded.status, answer = excluded.answer, meta = excluded.meta, updated_at = now()`,
    [userId, a.qid, a.attempt, a.status, a.text.slice(0, 1500), JSON.stringify(meta)],
  );
}

/** Drop follow-ups that no longer match an edited main answer. */
export async function deleteAnswers(db: Db, userId: string, keep: { qid: string; attempt: number }[], qid: string): Promise<void> {
  const attempts = keep.filter((k) => k.qid === qid).map((k) => k.attempt);
  await db.query("delete from interview_answers where user_id = $1 and qid = $2 and not (attempt = any($3::smallint[]))", [userId, qid, attempts]);
}

// ---- drafts and plan items ----

export async function saveDraft(db: Db, userId: string, key: string, kind: string, body: unknown): Promise<void> {
  await db.query(
    `insert into drafts (user_id, draft_key, kind, body) values ($1, $2, $3, $4::jsonb)
     on conflict (user_id, draft_key) do update set kind = excluded.kind, body = excluded.body, updated_at = now()`,
    [userId, key.slice(0, 80), kind.slice(0, 40), JSON.stringify(body)],
  );
}

export async function listDrafts(db: Db, userId: string): Promise<{ key: string; kind: string; body: unknown }[]> {
  const r = await db.query<{ draft_key: string; kind: string; body: unknown }>("select draft_key, kind, body from drafts where user_id = $1 order by updated_at", [userId]);
  return r.rows.map((x) => ({ key: x.draft_key, kind: x.kind, body: x.body }));
}

export async function savePlanItems(db: Db, userId: string, items: { key: string; data: unknown }[]): Promise<void> {
  await db.query("delete from plan_items where user_id = $1 and not (item_key = any($2::text[]))", [userId, items.map((i) => i.key)]);
  for (const i of items) {
    await db.query(
      `insert into plan_items (user_id, item_key, data) values ($1, $2, $3::jsonb)
       on conflict (user_id, item_key) do update set data = excluded.data, updated_at = now()`,
      [userId, i.key.slice(0, 80), JSON.stringify(i.data)],
    );
  }
}

export async function listPlanItems(db: Db, userId: string): Promise<{ key: string; data: unknown }[]> {
  const r = await db.query<{ item_key: string; data: unknown }>("select item_key, data from plan_items where user_id = $1 order by item_key", [userId]);
  return r.rows.map((x) => ({ key: x.item_key, data: x.data }));
}

// ---- durable daily caps ----

/**
 * Count one use of `kind` today for this user, atomically, if under `max`.
 * Holds across every server instance because the count lives in the database.
 */
export async function takeDaily(db: Db, userId: string, kind: string, max: number): Promise<boolean> {
  const r = await db.query(
    `insert into usage_daily (user_id, day, kind, count) values ($1, (now() at time zone 'Asia/Kolkata')::date, $2, 1)
     on conflict (user_id, day, kind) do update set count = usage_daily.count + 1 where usage_daily.count < $3
     returning count`,
    [userId, kind, max],
  );
  return r.rows.length > 0;
}

// ---- export and delete ----

const TABLES = ["facts", "interview_answers", "context_brief", "drafts", "plan_items", "usage_daily", "lynkr_user", "contacts", "ext_tokens", "outreach_daily_usage", "lynkr_user_outreach"] as const;

/** Everything Lynkr holds for this user, as plain JSON ("Download my data"). */
export async function exportAll(db: Db, userId: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString() };
  for (const t of TABLES) {
    if (["contacts", "ext_tokens", "outreach_daily_usage", "lynkr_user_outreach"].includes(t) && !(await db.query<{ t: string | null }>("select to_regclass($1)::text as t", [`public.${t}`])).rows[0]?.t) continue;
    out[t] = (await db.query(`select * from ${t} where user_id = $1`, [userId])).rows.map(({ user_id, token_hash, ...rest }) => (void user_id, void token_hash, rest));
  }
  return out;
}

/** "Delete my data": every Lynkr row for this user, in every table. The sign-in account itself stays. */
export async function deleteAll(db: Db, userId: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    if (["contacts", "ext_tokens", "outreach_daily_usage", "lynkr_user_outreach"].includes(t) && !(await db.query<{ t: string | null }>("select to_regclass($1)::text as t", [`public.${t}`])).rows[0]?.t) continue;
    counts[t] = (await db.query(`delete from ${t} where user_id = $1 returning 1`, [userId])).rows.length;
  }
  return counts;
}

// ---- 12-month inactivity cleanup ----

export async function inactiveUsers(db: Db, before: Date): Promise<string[]> {
  const r = await db.query<{ user_id: string }>("select user_id from lynkr_user where last_active_at < $1 order by last_active_at limit 500", [before]);
  return r.rows.map((x) => x.user_id);
}

// ---- count-only metrics ----

export async function bumpMetric(db: Db, event: string, label = "", value = 0): Promise<void> {
  await db.query(
    `insert into metric_counts (day, event, label, count, sum_value) values ((now() at time zone 'Asia/Kolkata')::date, $1, $2, 1, $3)
     on conflict (day, event, label) do update set count = metric_counts.count + 1, sum_value = metric_counts.sum_value + excluded.sum_value`,
    [event.slice(0, 40), label.slice(0, 40), Math.max(0, Math.round(value))],
  );
}
