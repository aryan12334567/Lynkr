import { addDays, daysBetween, mondayOf, todayIST, weekdayIndex } from "./ist";

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
  return { ...plan, counts: c, times, items: layoutItems(plan.weekStart, c, times, retimed) };
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

export type PlanChange = { counts: Counts; times: Times; understood: boolean; reply: string };

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

/** Understands: "2 posts", "no comments", "more/fewer outreach", "posts at 8am", "comments at 1:30 pm". */
export function parsePlanChat(text: string, counts: Counts, times: Times): PlanChange {
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
