/**
 * Progress and the streak (calendar plan U6, R18, R19, KTD8). Pure: the plan store freezes a finished week into
 * `progress:<Monday>` the first time it is read, so editing or deleting old items later never changes the streak.
 *
 * Stage 1 counts the week's plan slots, which free and paid users both mark done by their own tap ("Mark sent",
 * "Mark posted"). Posts, outreach steps and comments join as sources in Stage 2; they pass the same shape.
 */
import { addDays, mondayOf } from "../ist";

/** The share of planned actions that makes a flame (decision D-K2). */
export const STREAK_THRESHOLD = 0.7;
/** How many finished weeks the streak row shows, besides the current week. */
export const STREAK_WEEKS = 6;

export type WeekCount = { planned: number; done: number };
export type CountableItem = { status: string; /** Replaced or dismissed: not planned (R18). */ superseded?: boolean };

/** R18: planned is every action that was not replaced or dismissed; done is the ones the person marked done. */
export function weekProgress(items: readonly CountableItem[]): WeekCount {
  const live = items.filter((i) => !i.superseded);
  return { planned: live.length, done: live.filter((i) => i.status === "done").length };
}

/** True from the Monday after the week's Sunday. A week is never frozen while it can still change. */
export const weekFinished = (weekStart: string, today: string): boolean => addDays(weekStart, 6) < today;

export const reachedThreshold = (c: WeekCount, threshold = STREAK_THRESHOLD): boolean => c.planned > 0 && c.done / c.planned >= threshold;

/** ISO 8601 week number of the week that starts on this Monday. */
export function isoWeek(weekStart: string): number {
  const d = new Date(`${weekStart}T00:00:00Z`);
  const thursday = new Date(d.getTime() + 3 * 86_400_000);
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.floor((thursday.getTime() - jan1.getTime()) / 86_400_000 / 7) + 1;
}

export type StreakWeek = { weekStart: string; week: number; planned: number; done: number; current: boolean; flame: boolean; label: string };
export type Streak = {
  weeks: StreakWeek[];
  /** Finished weeks in a row that reached the threshold, counted back from the last finished week with a plan. */
  streak: number;
  /** The current week has reached the threshold, so it adds a flame now. */
  currentKept: boolean;
  /** No finished week with a plan yet: "Your first week", no flame. */
  first: boolean;
};

/** R19 and AE4 wording. Never shames: below the threshold it says keep going. */
export function progressLine(c: WeekCount, finished: boolean, threshold = STREAK_THRESHOLD): string {
  if (c.planned === 0) return "Nothing planned this week";
  if (reachedThreshold(c, threshold)) return `${c.done} of ${c.planned} done`;
  return finished ? `${c.done} of ${c.planned} done` : `${c.done} of ${c.planned} — keep going`;
}

function label(week: number, c: WeekCount, flame: boolean, current: boolean): string {
  const base = `Week ${week}: ${c.done} of ${c.planned}`;
  if (flame) return `${base}, streak kept`;
  return current ? `${base} so far` : base;
}

/**
 * R19: the last 6 finished weeks that have a plan, plus the current week. A flame marks each week that reached the
 * threshold. A finished week with no stored progress, or with nothing planned, is skipped: a week off is not a reset.
 * The streak counts back from the last finished week and stops at the first one below the threshold.
 */
export function streak(byWeek: Readonly<Record<string, WeekCount>>, today: string, threshold = STREAK_THRESHOLD): Streak {
  const thisMonday = mondayOf(today);
  const finished: StreakWeek[] = [];
  for (let i = 1; i <= STREAK_WEEKS; i++) {
    const monday = addDays(thisMonday, -7 * i);
    const c = byWeek[monday];
    if (!c || c.planned <= 0) continue;
    const flame = reachedThreshold(c, threshold);
    finished.push({ weekStart: monday, week: isoWeek(monday), planned: c.planned, done: c.done, current: false, flame, label: label(isoWeek(monday), c, flame, false) });
  }
  const cur = byWeek[thisMonday] ?? { planned: 0, done: 0 };
  const currentKept = reachedThreshold(cur, threshold);
  const current: StreakWeek = { weekStart: thisMonday, week: isoWeek(thisMonday), planned: cur.planned, done: cur.done, current: true, flame: currentKept, label: label(isoWeek(thisMonday), cur, currentKept, true) };

  let run = 0;
  for (const w of finished) { // newest first
    if (!w.flame) break;
    run++;
  }
  return { weeks: [...finished.reverse(), current], streak: run, currentKept, first: finished.length === 0 };
}
