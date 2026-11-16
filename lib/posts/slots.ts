import { confirmedFacts, type Db } from "../db";
import { factsFor } from "../facts";
import { getWeek, isMonday } from "../calendar/plan-store";
import { planForWeek, type Plan } from "../plan";
import type { FactKind, FactRef } from "../schemas";
import { createPost, listPosts, POST_TYPES, type Post, type PostType } from "./db";

/**
 * This week's post slots and their briefs (posts plan U2, R1 to R3). A slot is a post item of the week's plan: its type,
 * day and time come from the plan, and its brief is written once, when the person opens it, from the type and their
 * confirmed Story Vault facts. After that the brief is the person's to edit. Posts already made stay visible even when the
 * plan later asks for fewer (R2): they come back under `others`.
 */

export type Slot = { index: number; type: PostType; day: string; time: string; brief: string; post: Post | null };

const LEAD: Record<PostType, string> = {
  proof: "Show one piece of work you did and what it led to.",
  setback: "Tell one thing that went wrong and what you changed.",
  observation: "Share one thing you noticed first-hand and why it matters.",
};
/** Which of the person's facts a type starts from, best first. */
const STARTS_FROM: Record<PostType, readonly FactKind[]> = {
  proof: ["project", "contribution", "evidence"],
  setback: ["challenge", "constraint"],
  observation: ["opinion", "learning"],
};
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, ""));

/** A one-to-two line brief from the post type and, when the person has one, a confirmed fact of the fitting kind. Deterministic. */
export function briefFor(type: PostType, facts: readonly FactRef[]): string {
  const fact = STARTS_FROM[type].map((k) => facts.find((f) => f.kind === k)).find(Boolean);
  const text = fact ? clip(fact.text.replace(/\s+/g, " ").trim(), 140).replace(/[.\s]+$/, "") : "";
  return text ? `${LEAD[type]} Starting point from your facts: ${text}.` : LEAD[type];
}

const isType = (t: string): t is PostType => (POST_TYPES as readonly string[]).includes(t);

/** The plan's post items, in order, as slots without a post yet. */
export function planSlots(plan: Plan, facts: readonly FactRef[]): Omit<Slot, "post">[] {
  return plan.items
    .filter((i) => i.kind === "post" && isType(i.tag))
    .map((i, index) => ({ index, type: i.tag as PostType, day: i.day, time: i.time, brief: briefFor(i.tag as PostType, facts) }));
}

/** Puts each stored post on its slot. Posts of the week with no slot in the plan (the plan shrank) are returned as `others`. */
export function mergeSlots(slots: Omit<Slot, "post">[], posts: readonly Post[]): { slots: Slot[]; others: Post[] } {
  const bySlot = new Map(posts.filter((p) => p.slotIndex !== null).map((p) => [p.slotIndex as number, p]));
  const used = new Set<number>();
  const merged = slots.map((s) => {
    const post = bySlot.get(s.index) ?? null;
    if (post) used.add(s.index);
    return { ...s, brief: post?.brief ?? s.brief, post };
  });
  return { slots: merged, others: posts.filter((p) => p.slotIndex === null || !used.has(p.slotIndex)) };
}

/** The week as the person sees it. With no stored plan for that week, the default plan's slots show. */
export async function slotsForWeek(db: Db, userId: string, weekStart: string): Promise<{ weekStart: string; slots: Slot[]; others: Post[] }> {
  const [plan, facts, posts] = await Promise.all([getWeek(db, userId, weekStart), confirmedFacts(db, userId), listPosts(db, userId, { weekStart })]);
  const forPosts = factsFor("post", facts);
  return { weekStart, ...mergeSlots(planSlots(plan ?? planForWeek(weekStart), forPosts), posts) };
}

/**
 * Opens a slot: creates its post once, with the stored brief (or the one the person typed). Null when the week or slot
 * is not valid. Asking again returns the post that exists.
 */
export async function postForSlot(db: Db, userId: string, weekStart: string, index: number, over: { type?: PostType; brief?: string } = {}): Promise<Post | null> {
  if (!isMonday(weekStart)) return null;
  const view = await slotsForWeek(db, userId, weekStart);
  const slot = view.slots.find((s) => s.index === index);
  if (slot?.post) return slot.post;
  const type = over.type ?? slot?.type;
  if (!type) return null;
  const brief = (over.brief ?? "").trim() || (slot && slot.type === type ? slot.brief : briefFor(type, factsFor("post", await confirmedFacts(db, userId))));
  return createPost(db, userId, { type, brief, mode: "quick", weekStart, slotIndex: index });
}
