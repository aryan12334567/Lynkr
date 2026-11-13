/**
 * Today is today's slice of the Calendar (calendar plan U8, R23): what is due or scheduled today, what is overdue, the
 * week's "N of M" for the ring, and the week's mix in words for the "Plan this week" card. Pure.
 */
import { mondayOf } from "../ist";
import { feedProgress } from "./feed";
import { chipStatus } from "./grid";
import type { Counts } from "../plan";
import type { WeekCount } from "./progress";
import type { FeedItem } from "./types";

const OPEN: readonly FeedItem["status"][] = ["draft", "scheduled", "due", "overdue", "check", "failed"];

export function todaySlice(items: readonly FeedItem[], today: string): { today: FeedItem[]; overdue: FeedItem[] } {
  const open = items.filter((i) => OPEN.includes(i.status));
  const by = (a: FeedItem, b: FeedItem) => (a.day + a.time).localeCompare(b.day + b.time) || a.id.localeCompare(b.id);
  return { today: open.filter((i) => i.day === today).sort(by), overdue: open.filter((i) => i.day < today).sort(by) };
}

/** The ring: this week's planned and done, counted over the feed the same way the week screen counts them (R18). */
export function weekRing(items: readonly FeedItem[], today: string): WeekCount {
  return feedProgress(items, mondayOf(today));
}

/** "2 messages, 1 comment and 1 post": the calculated mix, not a fixed sentence. */
export function mixWords(c: Counts): string {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const parts = [n(c.messages, "message", "messages"), n(c.comments, "comment", "comments"), n(c.posts, "post", "posts")];
  return `${parts[0]}, ${parts[1]} and ${parts[2]}`;
}

/** One row of the Today list: the time, the title and the status as words, plus how late it is when it is overdue. */
export function todayRow(item: FeedItem, today: string): { time: string; title: string; status: string; late: string | null } {
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.day}T00:00:00Z`)) / 86_400_000);
  return { time: item.time, title: item.title, status: chipStatus(item), late: days > 0 ? `${days} ${days === 1 ? "day" : "days"} late` : null };
}
