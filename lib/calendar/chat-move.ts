/**
 * Chat moves, server side (calendar plan U7, R12, AE6). A move the chat parsed or the model returned is matched to the
 * session user's own item in the week, then sent through the same owner code as a drag (lib/calendar/move.ts), so the
 * paywall, ownership and "publishing now" rules are not repeated here. Nothing in the text can publish or send anything:
 * the only thing this function can do is move one item that the person already has.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "../db";
import { addDays } from "../ist";
import { dayInWeek, type ChatMove } from "./chat";
import { moveItem, type PostsOwner } from "./move";
import { calendarFeed, type Switches } from "./server";
import type { FeedItem } from "./types";

const KINDS: Record<ChatMove["kind"], readonly string[]> = {
  post: ["post"],
  comment: ["comment"],
  message: ["message", "follow_up", "thank_you", "check_in", "invite", "second_person", "referral_ask"],
  meeting: ["meeting"],
};
const DAY_NAME: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
const OPEN: readonly FeedItem["status"][] = ["draft", "scheduled", "due"];

export type ChatMoveResult = { moved: boolean; reply: string };

export async function applyChatMove(
  db: Db, userId: string,
  o: { weekStart: string; move: ChatMove; switches: Switches; now?: Date; posts?: PostsOwner },
): Promise<ChatMoveResult> {
  const feed = await calendarFeed(db, userId, { from: o.weekStart, to: addDays(o.weekStart, 6), paid: true, switches: o.switches, now: o.now });
  const from = o.move.from_day ? dayInWeek(o.weekStart, o.move.from_day) : null;
  const found = feed.items.filter((i) => KINDS[o.move.kind].includes(i.kind) && i.movable && OPEN.includes(i.status) && (!from || i.day === from));
  if (found.length === 0) return { moved: false, reply: "I couldn't find that item." };
  if (found.length > 1) return { moved: false, reply: `I found ${found.length} ${o.move.kind === "meeting" ? "meetings" : `${o.move.kind}s`} that could be it. Use Change date on the one you mean.` };

  const item = found[0];
  const out = await moveItem(db, userId, { op_id: `chat-${randomUUID()}`, id: item.id, day: dayInWeek(o.weekStart, o.move.to_day), time: o.move.time ?? undefined }, { paid: true, now: o.now, posts: o.posts });
  if (out.status !== 200) return { moved: false, reply: String(out.body.error ?? "Couldn't move that.") };

  // R12: a chat change overrides the rule for that week only, and the Why line says so.
  // The move is done; the flag is best effort, and only a plan slot changes the week's plan.
  if (item.id.startsWith("plan:")) {
    await db.query(`update plan_items set data = jsonb_set(data, '{changedByUser}', 'true'::jsonb), updated_at = now() where user_id = $1 and item_key = $2`, [userId, `week:${o.weekStart}`]).catch(() => {});
  }
  return { moved: true, reply: `Moved your ${o.move.kind} to ${DAY_NAME[o.move.to_day]}.` };
}
