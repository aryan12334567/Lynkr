/**
 * The week's plan in the account (calendar plan U2, R22, R24, KTD3). Rows live in `plan_items` with no new migration:
 *   week:<Monday>      the week's Plan as JSON
 *   progress:<Monday>  that week's { planned, done }, frozen once the week has ended
 *
 * Every write touches exactly one key with an upsert. Never call `savePlanItems` from here: it deletes every key that is
 * not in its list, so two overlapping writes (a move and a progress freeze) would delete each other's rows.
 */
import { z } from "zod";
import type { Db } from "../db";
import type { Plan } from "../plan";
import { weekFinished, weekProgress, type WeekCount } from "./progress";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const WEEK_PREFIX = "week:";
export const PROGRESS_PREFIX = "progress:";

export const isMonday = (day: string): boolean => DAY.test(day) && !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).getUTCDay() === 1;

const Item = z.object({
  id: z.string().max(80),
  kind: z.enum(["post", "comment", "message", "follow_up"]),
  tag: z.enum(["proof", "setback", "observation", "comment", "outreach", "follow_up"]),
  draftId: z.string().max(80),
  day: z.string().regex(DAY),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.enum(["draft", "scheduled", "done"]),
  doneAt: z.string().max(40).optional(),
  replied: z.boolean().optional(),
  moves: z.array(z.object({ day: z.string().regex(DAY), time: z.string().regex(/^\d{2}:\d{2}$/) })).max(20).optional(),
});
const Counts = z.object({ posts: z.number().int().min(0).max(10), comments: z.number().int().min(0).max(10), messages: z.number().int().min(0).max(10) });
/** What the browser may send for a week. The server never trusts the day to be a Monday: the key says which week it is. */
export const PlanBody = z.object({
  weekStart: z.string().regex(DAY),
  counts: Counts,
  times: z.object({ post: z.string().regex(/^\d{2}:\d{2}$/), comment: z.string().regex(/^\d{2}:\d{2}$/), message: z.string().regex(/^\d{2}:\d{2}$/) }),
  items: z.array(Item).max(60),
  notified: z.array(z.string().max(80)).max(60).default([]),
  changedByUser: z.boolean().optional(),
  ops: z.array(z.string().max(100)).max(40).optional(),
});

export async function getWeek(db: Db, userId: string, monday: string): Promise<Plan | null> {
  if (!isMonday(monday)) return null;
  const r = await db.query<{ data: unknown }>("select data from plan_items where user_id = $1 and item_key = $2", [userId, WEEK_PREFIX + monday]);
  const parsed = PlanBody.safeParse(r.rows[0]?.data);
  return parsed.success ? (parsed.data as Plan) : null;
}

/** Replaces one week's plan. Returns false when the week or the body is not valid. Touches no other key. */
export async function putWeek(db: Db, userId: string, monday: string, body: unknown): Promise<boolean> {
  const parsed = PlanBody.safeParse(body);
  if (!isMonday(monday) || !parsed.success || parsed.data.weekStart !== monday) return false;
  await db.query(
    `insert into plan_items (user_id, item_key, data) values ($1, $2, $3::jsonb)
     on conflict (user_id, item_key) do update set data = excluded.data, updated_at = now()`,
    [userId, WEEK_PREFIX + monday, JSON.stringify(parsed.data)],
  );
  return true;
}

/**
 * The one-time move from the browser (AE5): writes the week only if the account has none. An existing week is never
 * overwritten, so a reload or a second device cannot duplicate or clobber it. Returns the week the account now holds.
 */
export async function importWeekOnce(db: Db, userId: string, monday: string, body: unknown): Promise<{ plan: Plan | null; imported: boolean }> {
  const parsed = PlanBody.safeParse(body);
  if (!isMonday(monday) || !parsed.success || parsed.data.weekStart !== monday) return { plan: await getWeek(db, userId, monday), imported: false };
  const r = await db.query(
    `insert into plan_items (user_id, item_key, data) values ($1, $2, $3::jsonb) on conflict (user_id, item_key) do nothing returning 1`,
    [userId, WEEK_PREFIX + monday, JSON.stringify(parsed.data)],
  );
  return { plan: await getWeek(db, userId, monday), imported: r.rows.length > 0 };
}

export async function getProgress(db: Db, userId: string): Promise<Record<string, WeekCount>> {
  const r = await db.query<{ item_key: string; data: unknown }>("select item_key, data from plan_items where user_id = $1 and item_key like $2", [userId, `${PROGRESS_PREFIX}%`]);
  const out: Record<string, WeekCount> = {};
  for (const row of r.rows) {
    const p = z.object({ planned: z.number().int().min(0), done: z.number().int().min(0) }).safeParse(row.data);
    if (p.success) out[row.item_key.slice(PROGRESS_PREFIX.length)] = p.data;
  }
  return out;
}

/**
 * KTD3 and KTD8: a finished week is frozen the first time it is read, so editing or deleting its items later cannot change
 * the streak. `do nothing` on conflict: the first freeze wins. Returns the frozen counts, or null when the week is not
 * finished yet or has no plan.
 */
export async function freezeWeek(db: Db, userId: string, monday: string, today: string): Promise<WeekCount | null> {
  if (!isMonday(monday) || !weekFinished(monday, today)) return null;
  const existing = await db.query<{ data: WeekCount }>("select data from plan_items where user_id = $1 and item_key = $2", [userId, PROGRESS_PREFIX + monday]);
  if (existing.rows[0]) return existing.rows[0].data;
  const plan = await getWeek(db, userId, monday);
  if (!plan) return null;
  const counts = weekProgress(plan.items);
  await db.query(
    `insert into plan_items (user_id, item_key, data) values ($1, $2, $3::jsonb) on conflict (user_id, item_key) do nothing`,
    [userId, PROGRESS_PREFIX + monday, JSON.stringify(counts)],
  );
  const again = await db.query<{ data: WeekCount }>("select data from plan_items where user_id = $1 and item_key = $2", [userId, PROGRESS_PREFIX + monday]);
  return again.rows[0]?.data ?? counts;
}

/** Every `week:` key, newest first, for freezing and for the streak. */
export async function listWeeks(db: Db, userId: string): Promise<string[]> {
  const r = await db.query<{ item_key: string }>("select item_key from plan_items where user_id = $1 and item_key like $2 order by item_key desc", [userId, `${WEEK_PREFIX}%`]);
  return r.rows.map((x) => x.item_key.slice(WEEK_PREFIX.length));
}
