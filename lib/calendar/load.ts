/**
 * Loads each owner's rows for the feed (calendar plan KTD2). Server only. The owners' own library functions are called
 * directly, never their HTTP routes. One failing owner does not stop the others (the route catches per source).
 */
import type { Db } from "../db";
import { calendarItems, calendarRow, type CalendarItem } from "../outreach/calendar";
import { OUTREACH_SELECT } from "../outreach/move";

export type OutreachStepRow = CalendarItem & { /** When the step that replaced this one is scheduled (ISO), for "Replaced by <date>". */ replacedAt?: string };

/** Finished and closed contacts have left the Calendar (R46). Rows carry each contact's meeting answers, so a booked meeting reads as done once answered. */

export async function loadOutreachSteps(db: Db, userId: string, from: Date, to: Date): Promise<OutreachStepRow[]> {
  const ready = await db.query<{ name: string | null }>("select to_regclass('public.outreach_events')::text as name");
  if (!ready.rows[0]?.name) throw new Error("outreach storage is unavailable");
  const rows = await db.query(`${OUTREACH_SELECT} where e.user_id = $1 and e.kind <> 'why' and c.goal_reached_at is null and c.closed_at is null`, [userId]);
  const items = calendarItems(rows.rows.map(calendarRow));
  // A moved step's replacement points back at it (supersedes_id): that is where "Replaced by <date>" comes from.
  const links = await db.query<{ supersedes_id: string; due_at: Date | null; meeting_at: Date | null }>("select supersedes_id, due_at, meeting_at from outreach_events where user_id = $1 and supersedes_id is not null", [userId]);
  const to2 = new Map(links.rows.map((r) => [r.supersedes_id, r.meeting_at ?? r.due_at]));
  return items
    .map((i): OutreachStepRow => { const at = i.status === "superseded" ? to2.get(i.id) : null; return at ? { ...i, replacedAt: new Date(at).toISOString() } : i; })
    .filter((i) => i.at >= from.toISOString() && i.at < to.toISOString());
}
