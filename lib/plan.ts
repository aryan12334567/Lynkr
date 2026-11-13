import { addDays, daysBetween, mondayOf, todayIST, weekdayIndex } from "./ist";
import { parseMove, type ChatMove } from "./calendar/chat";
import type { Bucket, WeeklyTime } from "./schemas";

/**
 * Weekly plan: Lynkr's default week (3 messages, 2 comments, 1 post) placed on
 * Mon–Fri in IST. Spec: research/feature-spec.md.
 */
export type ItemKind = "post" | "comment" | "message" | "follow_up";
export type Tag = "proof" | "setback" | "observation" | "comment" | "outreach" | "follow_up";
export type Status = "draft" | "scheduled" | "done";

export type PlanItem = {
  id: string;
  kind: ItemKind;
  tag: Tag;
  draftId: string;
  day: string;
  time: string;
  status: Status;
  doneAt?: string;
  replied?: boolean;
  /** Where the slot was before each move, oldest first, so the Calendar can strike the old date through (R14). */
  moves?: { day: string; time: string }[];
};

export type Counts = { posts: number; comments: number; messages: number };
export type Times = { post: string; comment: string; message: string };

export type Plan = {
  weekStart: string;
  counts: Counts;
  times: Times;
  items: PlanItem[];
  /** Item ids already shown as a browser notification. */
  notified: string[];
  /** The person changed this week's counts (by chat or by hand), so the mix rules no longer recalculate it (R12). */
  changedByUser?: boolean;
  /** Move operation ids already applied to this week, newest last, so a retried move is a no-op (KTD5). */
  ops?: string[];
};

export const DEFAULT_COUNTS: Counts = { posts: 1, comments: 2, messages: 3 };
export const DEFAULT_TIMES: Times = { post: "09:00", comment: "12:30", message: "10:30" };
export const LIMITS: Counts = { posts: 5, comments: 10, messages: 10 };

export const TAG_LABEL: Record<Tag, string> = {
  proof: "Proof of work",
  setback: "Setback",
  observation: "Observation",
  comment: "Comment",
  outreach: "Outreach",
  follow_up: "Follow-up",
};

const POST_TAGS: Tag[] = ["proof", "setback", "observation"];
const MESSAGE_DRAFTS = ["out:referral", "out:hm"];
/** First weekday each kind starts on, so items don't pile up on Monday. */
const START_DAY: Record<"post" | "comment" | "message", number> = { message: 0, post: 1, comment: 2 };

/** Mon–Wed plans this week; Thu–Sun plans next week. */
export function planWeekStart(today: string = todayIST()): string {
  const monday = mondayOf(today);
  return weekdayIndex(today) <= 2 ? monday : addDays(monday, 7);
}

function spread(n: number, start: number): number[] {
  return Array.from({ length: n }, (_, i) => (Math.floor((i * 5) / n) + start) % 5);
}

export function clampCounts(c: Counts): Counts {
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(Number.isFinite(v) ? v : 0)));
  return { posts: clamp(c.posts, LIMITS.posts), comments: clamp(c.comments, LIMITS.comments), messages: clamp(c.messages, LIMITS.messages) };
}

/** Build the plan's items. Items whose id already exists keep their status, day and time. */
export function layoutItems(weekStart: string, counts: Counts, times: Times, previous: PlanItem[] = []): PlanItem[] {
  const prev = new Map(previous.map((p) => [p.id, p]));
  const items: PlanItem[] = [];
  const make = (kind: "post" | "comment" | "message", i: number, day: number): PlanItem => {
    const id = `${kind}-${i}`;
    const old = prev.get(id);
    if (old) return old;
    const tag: Tag = kind === "post" ? POST_TAGS[i % 3] : kind === "comment" ? "comment" : "outreach";
    const draftId = kind === "post" ? `post:${i % 3}` : kind === "comment" ? `comment:${i % 2}` : MESSAGE_DRAFTS[i % 2];
    return { id, kind, tag, draftId, day: addDays(weekStart, day), time: times[kind], status: "draft" };
  };
  spread(counts.messages, START_DAY.message).forEach((d, i) => items.push(make("message", i, d)));
  spread(counts.posts, START_DAY.post).forEach((d, i) => items.push(make("post", i, d)));
  spread(counts.comments, START_DAY.comment).forEach((d, i) => items.push(make("comment", i, d)));
  // Follow-ups are added by the user from a sent message; keep them.
  for (const p of previous) if (p.kind === "follow_up") items.push(p);
  return items.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
}

export function newPlan(today: string = todayIST(), counts = DEFAULT_COUNTS, times = DEFAULT_TIMES): Plan {
  return planForWeek(planWeekStart(today), counts, times);
}

/** A fresh plan for a given Monday; unfinished items from another week are not carried over. */
export function planForWeek(weekStart: string, counts = DEFAULT_COUNTS, times = DEFAULT_TIMES): Plan {
  return { weekStart, counts, times, items: layoutItems(weekStart, counts, times), notified: [] };
}

export function withCounts(plan: Plan, counts: Counts, times: Times = plan.times): Plan {
  const c = clampCounts(counts);
  // A changed default time applies to items still in Draft.
  const retimed = plan.items.map((it) =>
    it.kind !== "follow_up" && it.status === "draft" && times[it.kind] !== plan.times[it.kind] ? { ...it, time: times[it.kind] } : it,
  );
  const changed = c.posts !== plan.counts.posts || c.comments !== plan.counts.comments || c.messages !== plan.counts.messages;
  return { ...plan, counts: c, times, items: layoutItems(plan.weekStart, c, times, retimed), ...(changed ? { changedByUser: true } : {}) };
}

export function updateItem(plan: Plan, id: string, patch: Partial<PlanItem>): Plan {
  return { ...plan, items: plan.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) };
}

export function setStatus(plan: Plan, id: string, status: Status, now: Date = new Date()): Plan {
  return updateItem(plan, id, status === "done" ? { status, doneAt: now.toISOString() } : { status, doneAt: undefined, replied: undefined });
}

/** A sent message with no reply after 5+ days needs a follow-up (spec: follow up after 5–7 days). */
export function followUpDue(item: PlanItem, now: Date = new Date()): boolean {
  if (item.kind !== "message" || item.status !== "done" || item.replied || !item.doneAt) return false;
  return daysBetween(item.doneAt, now) >= 5;
}

export function hasFollowUp(plan: Plan, messageId: string): boolean {
  return plan.items.some((it) => it.id === `follow_up-${messageId}`);
}

export function addFollowUp(plan: Plan, messageId: string, today: string = todayIST()): Plan {
  if (hasFollowUp(plan, messageId)) return plan;
  const item: PlanItem = {
    id: `follow_up-${messageId}`,
    kind: "follow_up",
    tag: "follow_up",
    draftId: "out:follow",
    day: today,
    time: plan.times.message,
    status: "draft",
  };
  return { ...plan, items: [...plan.items, item].sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time)) };
}

// ---- adjust by chat (rule-based; used without an AI key) ----

export type PlanChange = { counts: Counts; times: Times; understood: boolean; reply: string; /** The server moved the item (calendar plan U7): the client reloads the calendar. */ moved?: boolean; /** One item to move (calendar plan U7); the server matches it to the person's own item. */ move?: ChatMove };

const WORD_NUM: Record<string, number> = { no: 0, zero: 0, none: 0, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const KIND_WORD: [RegExp, keyof Counts, keyof Times][] = [
  [/^posts?$/, "posts", "post"],
  [/^comments?$/, "comments", "comment"],
  [/^(messages?|outreach|dms?|referrals?)$/, "messages", "message"],
];

function kindOf(word: string): [keyof Counts, keyof Times] | null {
  for (const [re, c, t] of KIND_WORD) if (re.test(word)) return [c, t];
  return null;
}

function toTime(h: number, m: number, ampm?: string): string | null {
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Understands: "2 posts", "no comments", "more/fewer outreach", "posts at 8am", "comments at 1:30 pm", and "move Thursday's post to Friday" (U7). */
export function parsePlanChat(text: string, counts: Counts, times: Times): PlanChange {
  const move = parseMove(text);
  if (move) return { counts, times, understood: true, reply: "Moving it.", move };
  const t = text.toLowerCase();
  const next: Counts = { ...counts };
  const nextTimes: Times = { ...times };
  const done: string[] = [];

  const COUNTED = /(?:^|[\s,;(])(-?\d+|no|zero|none|one|a|an|two|three|four|five|six)\s+(more\s+)?(posts?|comments?|messages?|outreach|dms?|referrals?)\b/g;
  for (const m of t.matchAll(COUNTED)) {
    const k = kindOf(m[3]);
    if (!k) continue;
    const n = /^-?\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUM[m[1]];
    // "2 more posts" adds; "2 posts" sets.
    next[k[0]] = m[2] ? next[k[0]] + n : n;
    done.push(m[2] ? `+${n} ${k[0]}` : `${k[0]} → ${n}`);
  }
  // Phrases already handled above ("2 more posts") are removed so they aren't counted twice.
  const rest = t.replace(COUNTED, " ");
  for (const m of rest.matchAll(/\b(more|fewer|less)\s+(posts?|comments?|messages?|outreach|dms?|referrals?)\b/g)) {
    const k = kindOf(m[2]);
    if (!k) continue;
    next[k[0]] += m[1] === "more" ? 1 : -1;
    done.push(`${m[1]} ${k[0]}`);
  }
  for (const m of t.matchAll(/\b(posts?|comments?|messages?|outreach|dms?|referrals?)\s+(?:at|around|by)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/g)) {
    const k = kindOf(m[1]);
    const time = k && toTime(Number(m[2]), Number(m[3] ?? 0), m[4]);
    if (!k || !time) continue;
    nextTimes[k[1]] = time;
    done.push(`${k[1]} time → ${time}`);
  }

  const clamped = clampCounts(next);
  if (done.length === 0) {
    return {
      counts,
      times,
      understood: false,
      reply: 'I couldn\'t read that. Try "2 posts", "no comments", "more outreach" or "posts at 8am".',
    };
  }
  const capped = (Object.keys(clamped) as (keyof Counts)[]).filter((k) => clamped[k] !== Math.max(0, next[k]));
  const note = capped.length ? ` Capped ${capped.join(", ")} at the weekly maximum.` : "";
  return {
    counts: clamped,
    times: nextTimes,
    understood: true,
    reply: `Updated: ${clamped.messages} messages, ${clamped.comments} comments, ${clamped.posts} posts.${note}`,
  };
}

// ---- the week's mix from the person's goals and time (calendar plan U1, R10 to R13, KTD4) ----

export type GoalFamily = "job_seeker" | "visibility" | "freelancer";
export const FAMILY_LABEL: Record<GoalFamily, string> = { job_seeker: "Job seeker", visibility: "Visibility builder", freelancer: "Freelancer" };

/** What the mix rules read. Every field is optional: nothing known gives the standard week. */
export type MixInput = {
  bucket?: Bucket | null;
  /** The interview's "what do you want" answers. */
  wants?: readonly string[];
  /** Outreach goal ids, in the order the person picked them. */
  outreachGoals?: readonly string[];
  weeklyTime?: WeeklyTime | null;
};

const OUTREACH_FAMILY: Record<string, GoalFamily> = { job: "job_seeker", referral: "job_seeker", network: "visibility", mentor: "visibility", clients: "freelancer" };
const BUCKET_FAMILY: Partial<Record<Bucket, GoalFamily>> = { fresher: "job_seeker", experienced: "job_seeker", switcher: "job_seeker", networker: "visibility", founder: "freelancer" };
const WANT_FAMILY: Record<string, GoalFamily> = { job: "job_seeker", internship: "job_seeker", referral: "job_seeker", network: "visibility", mentor: "visibility", clients: "freelancer" };

/**
 * R10: the first Outreach goal that has a family wins; without one the interview bucket decides; without a bucket the
 * interview's wants do. Outreach goals with no family (hire, fund, buy, partner, reconnect) are skipped.
 */
export function goalFamily(input: MixInput): GoalFamily | null {
  for (const g of input.outreachGoals ?? []) if (OUTREACH_FAMILY[g]) return OUTREACH_FAMILY[g];
  if (input.bucket && BUCKET_FAMILY[input.bucket]) return BUCKET_FAMILY[input.bucket]!;
  for (const w of input.wants ?? []) if (WANT_FAMILY[w]) return WANT_FAMILY[w];
  return null;
}

/** The default table of R10 (lead defaults, D-K1): posts, comments, messages per weekly time. */
export const WEEK_MIX: Record<GoalFamily, Record<WeeklyTime, Counts>> = {
  job_seeker: { "15m": { posts: 0, comments: 1, messages: 2 }, "30m": { posts: 1, comments: 2, messages: 3 }, "1h": { posts: 1, comments: 3, messages: 5 }, "2h": { posts: 2, comments: 4, messages: 7 } },
  visibility: { "15m": { posts: 1, comments: 2, messages: 0 }, "30m": { posts: 2, comments: 3, messages: 1 }, "1h": { posts: 3, comments: 4, messages: 2 }, "2h": { posts: 4, comments: 6, messages: 3 } },
  freelancer: { "15m": { posts: 0, comments: 2, messages: 1 }, "30m": { posts: 1, comments: 3, messages: 2 }, "1h": { posts: 2, comments: 4, messages: 3 }, "2h": { posts: 3, comments: 5, messages: 5 } },
};

/** The week's counts. Nothing known (no family) gives the standard week; an unknown time is 30 minutes. Always within LIMITS. */
export function weekMix(family: GoalFamily | null, weeklyTime?: WeeklyTime | null): Counts {
  if (!family) return { ...DEFAULT_COUNTS };
  return clampCounts(WEEK_MIX[family][weeklyTime && WEEK_MIX[family][weeklyTime] ? weeklyTime : "30m"]);
}

const TIME_LABEL: Record<WeeklyTime, string> = { "15m": "15 minutes", "30m": "30 minutes", "1h": "1 hour", "2h": "2 hours or more" };
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** What each family's week is for, by kind. A fixed template: no model call, so the free Calendar costs nothing (R11). */
const PURPOSE: Record<GoalFamily, { messages: string; comments: string; posts: string }> = {
  job_seeker: { messages: "outreach first", comments: "to warm your targets", posts: "to show your proof" },
  visibility: { messages: "to keep conversations going", comments: "to join conversations", posts: "to be seen" },
  freelancer: { messages: "to reach buyers", comments: "to meet buyers", posts: "to show your work" },
};

/**
 * R11 and R12: one line saying why this week looks the way it does. A week the person changed says so and names no rule.
 * Zero counts are left out ("Visibility builder, 15 minutes a week" has no messages).
 */
export function whyThisWeek(counts: Counts, input: MixInput, changedByUser = false): string {
  const parts = (purpose?: (typeof PURPOSE)[GoalFamily]) => {
    const out: string[] = [];
    if (counts.messages) out.push(purpose ? `${n(counts.messages, "message", "messages")} (${purpose.messages})` : n(counts.messages, "message", "messages"));
    if (counts.comments) out.push(purpose ? `${n(counts.comments, "comment", "comments")} ${purpose.comments}` : n(counts.comments, "comment", "comments"));
    if (counts.posts) out.push(purpose ? `${n(counts.posts, "post", "posts")} ${purpose.posts}` : n(counts.posts, "post", "posts"));
    return out.join(", ");
  };
  if (changedByUser) return `Changed by you: ${parts() || "no actions"} this week.`;
  const family = goalFamily(input);
  if (!family) return `The standard week: ${parts()}.`;
  return `${FAMILY_LABEL[family]}, ${TIME_LABEL[input.weeklyTime ?? "30m"]} a week: ${parts(PURPOSE[family])}.`;
}

/**
 * R13: a new set of counts changes only what is still a Draft slot the plan owns. Anything scheduled or done stays where
 * it is, even when the new counts would drop it. A week the person changed is left alone (R12).
 */
export function applyMix(plan: Plan, counts: Counts): Plan {
  if (plan.changedByUser) return plan;
  const c = clampCounts(counts);
  // Every existing slot keeps its id, day, time and status; only missing ids become new drafts.
  const next = layoutItems(plan.weekStart, c, plan.times, plan.items);
  const kept = plan.items.filter((it) => it.kind !== "follow_up" && it.status !== "draft");
  const have = new Set(next.map((it) => it.id));
  const items = [...next, ...kept.filter((it) => !have.has(it.id))].sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  // A slot that was kept but would not exist at the new counts still counts toward the plan's counts.
  const live = { posts: items.filter((i) => i.kind === "post").length, comments: items.filter((i) => i.kind === "comment").length, messages: items.filter((i) => i.kind === "message").length };
  return { ...plan, counts: live, items };
}

/** A new week for this person: counts from the mix rules (R10), never from a browser default. */
export function planForPerson(today: string, input: MixInput, times: Times = DEFAULT_TIMES): Plan {
  return planForWeek(planWeekStart(today), weekMix(goalFamily(input), input.weeklyTime), times);
}

/**
 * Comments the person logged as posted this week (Commenter plan R16). Marks that many comment items done, in date order.
 * Never un-ticks anything and never lowers a count: when the person has also ticked items by hand, the larger number wins.
 */
export function commentsDone(plan: Plan, posted: number, now: Date = new Date()): Plan {
  const comments = plan.items.filter((it) => it.kind === "comment").sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  const already = comments.filter((it) => it.status === "done").length;
  const need = Math.min(Math.max(0, Math.floor(posted)), comments.length) - already;
  if (need <= 0) return plan;
  const mark = new Set(comments.filter((it) => it.status !== "done").slice(0, need).map((it) => it.id));
  return { ...plan, items: plan.items.map((it) => (mark.has(it.id) ? { ...it, status: "done" as const, doneAt: now.toISOString() } : it)) };
}
