/**
 * Loads each owner's rows for the feed (calendar plan KTD2). Server only. The owners' own library functions are called
 * directly, never their HTTP routes. One failing owner does not stop the others (the route catches per source).
 */
import type { Db } from "../db";
import { calendarItems, calendarRow, type CalendarItem } from "../outreach/calendar";

export type OutreachStepRow = CalendarItem;

/** Finished and closed contacts have left the Calendar (R46). Rows carry each contact's meeting answers, so a booked meeting reads as done once answered. */
export const OUTREACH_SELECT = "select e.id, e.contact_id, e.kind, e.status, e.due_at, e.done_at, e.meeting_at, e.rule, c.name, c.goal from outreach_events e join contacts c on c.id = e.contact_id and c.user_id = e.user_id";

export async function loadOutreachSteps(db: Db, userId: string, from: Date, to: Date): Promise<OutreachStepRow[]> {
  const ready = await db.query<{ name: string | null }>("select to_regclass('public.outreach_events')::text as name");
  if (!ready.rows[0]?.name) throw new Error("outreach storage is unavailable");
  const rows = await db.query(`${OUTREACH_SELECT} where e.user_id = $1 and e.kind <> 'why' and c.goal_reached_at is null and c.closed_at is null`, [userId]);
  return calendarItems(rows.rows.map(calendarRow)).filter((i) => i.at >= from.toISOString() && i.at < to.toISOString());
}
