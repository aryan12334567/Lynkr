/**
 * Date helpers for India Standard Time (UTC+5:30, no daylight saving).
 * Dates are "YYYY-MM-DD" strings so they never shift with the viewer's time zone.
 */
const IST_OFFSET_MIN = 330;

/** Today's date in IST as "YYYY-MM-DD". */
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

function toUTC(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(day: string, n: number): string {
  const t = toUTC(day);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  return (toUTC(day).getUTCDay() + 6) % 7;
}

export function mondayOf(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

/** IST date + "HH:MM" → the matching instant in UTC. */
export function istToUTC(day: string, time: string): Date {
  const [h, min] = time.split(":").map(Number);
  const t = toUTC(day);
  t.setUTCMinutes(h * 60 + min - IST_OFFSET_MIN);
  return t;
}

export function daysBetween(fromISO: string, to: Date): number {
  return (to.getTime() - new Date(fromISO).getTime()) / 86_400_000;
}

const DAY_FMT = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const MONTH_FMT = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/** "Mon, 19 Oct" */
export function formatDay(day: string): string {
  return DAY_FMT.format(toUTC(day));
}

export function formatMonth(day: string): string {
  return MONTH_FMT.format(toUTC(day));
}
