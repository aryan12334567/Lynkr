/**
 * Every move goes to its owner, once (calendar plan U4, R14, R15, KTD5, KTD6). One entry point for the Calendar:
 *   plan:<Monday>:<slot>   a plan slot: the day and time change and the old place is kept in `moves`
 *   outreach:<event id>    the outreach step's own supersede (lib/outreach/move.ts), one op per `op_id`
 *   post:<id>              Posts' reschedule, through the `posts` seam. Posts is not built, so without it a post move is 404.
 * Undo is the reverse move with a new `op_id` (KTD6): the client sends it; nothing here remembers history.
 * Ownership: every owner call carries the session user's id, and an item that is not that user's is a 404 that changes nothing.
 */
import type { Db } from "../db";
import { addDays, istToUTC, todayIST } from "../ist";
import { clampWindow } from "../outreach/calendar";
import { moveStep } from "../outreach/move";
import type { Plan } from "../plan";
import { getWeek } from "./plan-store";
import { outreachFeedItems, parsePlanFeedId, planItems, type Access } from "./sources";
import type { FeedItem } from "./types";

export type MoveRequest = { op_id: string; id: string; day: string; time?: string };
export type MoveResult = { status: number; body: Record<string, unknown> };

/** Posts' side of a move. `status` is the owner's own answer: 409 "Publishing now", 402 for a lapsed account, 404 for someone else's post. */
export type PostsOwner = { reschedule(userId: string, id: string, day: string, time: string | undefined, opId: string): Promise<MoveResult> };

export type MoveContext = { paid: boolean; now?: Date; posts?: PostsOwner };

const PAID_ANSWER: MoveResult = { status: 402, body: { error: "An active subscription is needed. Subscribe, or enter your license key.", code: "subscription_required" } };
const OPS_KEPT = 40;

export async function moveItem(db: Db, userId: string, req: MoveRequest, ctx: MoveContext): Promise<MoveResult> {
  const now = ctx.now ?? new Date();
  const today = todayIST(now);
  if (Number.isNaN(Date.parse(`${req.day}T00:00:00Z`)) || new Date(`${req.day}T00:00:00Z`).toISOString().slice(0, 10) !== req.day) return { status: 400, body: { error: "Use a real date." } };
  if (req.day < today) return { status: 400, body: { error: "Pick a day that hasn't passed." } };
  // The Calendar shows five months ahead (clampWindow); nothing can be moved past what it can show.
  if (req.day >= todayIST(clampWindow(now).to)) return { status: 400, body: { error: "That date is too far ahead." } };

  if (req.id.startsWith("plan:")) return movePlanSlot(db, userId, req, today, now);

  if (req.id.startsWith("outreach:")) {
    if (!ctx.paid) return PAID_ANSWER;
    const out = await moveStep(db, userId, { opId: req.op_id, id: req.id.slice("outreach:".length), day: req.day, time: req.time });
    if (out.status !== 200) return out;
    const items = out.body.item ? outreachFeedItems([out.body.item], { paid: true }) : [];
    return { status: 200, body: { ok: true, replayed: out.body.replayed, item: items[0] ?? null } };
  }

  if (req.id.startsWith("post:")) {
    if (!ctx.paid) return PAID_ANSWER;
    if (!ctx.posts) return { status: 404, body: { error: "Posts aren't available yet." } };
    return ctx.posts.reschedule(userId, req.id.slice("post:".length), req.day, req.time, req.op_id);
  }

  return { status: 404, body: { error: "Item not found." } };
}

async function movePlanSlot(db: Db, userId: string, req: MoveRequest, today: string, now: Date): Promise<MoveResult> {
  const ref = parsePlanFeedId(req.id);
  if (!ref) return { status: 404, body: { error: "Item not found." } };
  // Read, change, and write back only if nobody wrote in between; try again a few times (KTD3: one key per write).
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = await db.query<{ data: Plan }>("select data from plan_items where user_id = $1 and item_key = $2", [userId, `week:${ref.week}`]);
    const raw = before.rows[0]?.data;
    const plan = await getWeek(db, userId, ref.week);
    const slot = plan?.items.find((i) => i.id === ref.slot);
    if (!raw || !plan || !slot) return { status: 404, body: { error: "Item not found." } };
    // An op id is remembered with its slot: the same move again is a no-op, the same id for another slot is refused.
    const seen = plan.ops?.find((o) => o === req.op_id || o.startsWith(`${req.op_id}@`));
    if (seen) {
      if (seen === `${req.op_id}@${ref.slot}`) return { status: 200, body: { ok: true, replayed: true, item: feedItem(plan, ref.slot) } };
      return { status: 409, body: { error: "That operation id was already used for something else." } };
    }
    if (slot.status === "done") return { status: 409, body: { error: "That one is already done." } };
    if (req.day < ref.week || req.day > addDays(ref.week, 6)) return { status: 400, body: { error: "A plan slot stays in its own week. Use another week's slot or change the plan." } };
    if (req.day === slot.day && (req.time ?? slot.time) === slot.time) return { status: 200, body: { ok: true, replayed: false, item: feedItem(plan, ref.slot) } };
    const time = req.time ?? slot.time;
    if (istToUTC(req.day, time).getTime() < now.getTime() - 60_000 && req.day === today) return { status: 400, body: { error: "That time has passed." } };

    const next: Plan = {
      ...plan,
      items: plan.items.map((i) => (i.id === ref.slot ? { ...i, day: req.day, time, moves: [...(i.moves ?? []), { day: slot.day, time: slot.time }].slice(-20) } : i)),
      ops: [...(plan.ops ?? []), `${req.op_id}@${ref.slot}`].slice(-OPS_KEPT),
    };
    const done = await db.query(
      "update plan_items set data = $3::jsonb, updated_at = now() where user_id = $1 and item_key = $2 and data = $4::jsonb returning 1",
      [userId, `week:${ref.week}`, JSON.stringify(next), JSON.stringify(raw)],
    );
    if (done.rows.length) return { status: 200, body: { ok: true, replayed: false, item: feedItem(next, ref.slot) } };
  }
  return { status: 409, body: { error: "The plan changed while moving that. Try again." } };
}

function feedItem(plan: Plan, slot: string): FeedItem | null {
  return planItems(plan, null, null).find((i) => i.id.endsWith(`:${slot}`)) ?? null;
}

export type { Access };
