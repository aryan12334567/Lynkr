export type CalendarVersion = "v1" | "v2";

/**
 * LYNKR_CALENDAR=v1|v2 (calendar plan KTD9). v1 is today's "This week" list kept in the browser. v2 adds the mix rules,
 * the why line, progress and the streak, and keeps a signed-in person's plan in the account. An unset switch follows
 * the preview: v2 on a preview, v1 everywhere else.
 */
export function calendarVersion(): CalendarVersion {
  const v = process.env.LYNKR_CALENDAR?.trim();
  return v === "v1" || v === "v2" ? v : process.env.VERCEL_ENV === "preview" ? "v2" : "v1";
}
