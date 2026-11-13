/**
 * Pure helpers for the Calendar screens (calendar plan U5): which days a view shows, how items group into them, which
 * drops are allowed, and the words on a chip. No React and no fetch, so the rules are tested without a browser.
 */
import { addDays, formatMonth, mondayOf } from "../ist";
import { shortDay } from "./sources";
import type { FeedItem } from "./types";

export const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
/** Month cells show this many chips, then "+N more" (R1). */
export const MONTH_CHIPS = 3;

export const weekDays = (monday: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** The 6 x 7 grid of days for the month that contains `anyDay`, Monday first. */
export function monthCells(anyDay: string): { first: string; days: string[] } {
  const first = `${anyDay.slice(0, 7)}-01`;
  const start = mondayOf(first);
  return { first, days: Array.from({ length: 42 }, (_, i) => addDays(start, i)) };
}

export function groupByDay(items: readonly FeedItem[]): Map<string, FeedItem[]> {
  const out = new Map<string, FeedItem[]>();
  for (const it of [...items].sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time) || a.id.localeCompare(b.id))) {
    const list = out.get(it.day) ?? [];
    list.push(it);
    out.set(it.day, list);
  }
  return out;
}

/** Month cell contents: the first three chips and how many are left (R1). */
export function monthSlice(list: readonly FeedItem[]): { shown: FeedItem[]; more: number } {
  return { shown: list.slice(0, MONTH_CHIPS), more: Math.max(0, list.length - MONTH_CHIPS) };
}

/** R14: a past day is never a drop target, and an item that cannot move has none. Dropping on its own day does nothing. */
export function dropAllowed(item: Pick<FeedItem, "movable" | "day">, day: string, today: string): boolean {
  return item.movable && day >= today && day !== item.day;
}

/** The status as the chip shows it. A replaced item says where it went, when known. */
export function chipStatus(item: Pick<FeedItem, "status" | "statusText" | "replacedBy">): string {
  return item.status === "replaced" && item.replacedBy ? `Replaced by ${shortDay(item.replacedBy)}` : item.statusText;
}

/** What a screen reader hears for a chip: type, time, status, goal, all as words (R4, R5). */
export function chipSummary(item: FeedItem): string {
  return [item.title, `${item.time} IST`, chipStatus(item), item.label ? `for ${item.label}` : ""].filter(Boolean).join(", ");
}

/** The words for "Change date" validation: null when the date and time are fine. IST, like every time in the Calendar. */
export function dateProblem(day: string, time: string, today: string, nowHHMM: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return "Pick a date and a time.";
  if (day < today) return "Pick a day that hasn't passed.";
  if (day === today && time < nowHHMM) return "That time has passed.";
  return null;
}

/** Days with at least one item, for the dots under the phone week strip (R3). */
export function daysWithItems(items: readonly FeedItem[]): Set<string> {
  return new Set(items.filter((i) => i.status !== "replaced").map((i) => i.day));
}

/** The month the grid shows, from the day on screen: "November 2026" even when the grid starts in October. */
export const monthLabel = (anyDay: string): string => formatMonth(monthCells(anyDay).first);
