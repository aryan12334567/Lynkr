/**
 * Moving one outreach step (build plan KTD15, KTD17). The step is superseded and a new one inserted in one transaction,
 * once per `op_id`. Shared by PATCH /api/outreach/calendar and the Calendar's move route (calendar plan KTD5), so a move
 * from either goes through the same owner code. The caller decides who may move (the paywall); this checks the rows.
 */
import type { Db } from "../db";
import { istToUTC } from "../ist";
import { DEFAULT_TIMES } from "../plan";
import { calendarItem, calendarRow, type CalendarItem, type CalendarRow } from "./calendar";
import { TimelineError, recordEvent } from "./timeline";

export const OUTREACH_SELECT = "select e.id, e.contact_id, e.kind, e.status, e.due_at, e.done_at, e.meeting_at, e.rule, c.name, c.goal from outreach_events e join contacts c on c.id = e.contact_id and c.user_id = e.user_id";

export type StepMove = { opId: string; id: string; day: string; time?: string };
export type StepMoveResult =
  | { status: 200; body: { item: CalendarItem | null; previous: CalendarItem | null; replayed: boolean } }
  | { status: 404 | 409 | 400 | 500; body: { error: string } };

export async function moveStep(db: Db, userId: string, m: StepMove): Promise<StepMoveResult> {
  const load = async (eventId: string): Promise<CalendarRow | null> => {
    const r = await db.query(`${OUTREACH_SELECT} where e.user_id = $1 and e.id = $2`, [userId, eventId]);
    return r.rows[0] ? calendarRow(r.rows[0]) : null;
  };
  // A retry: the move was already made, so return what it made and write nothing (AE10).
  const prior = await db.query<{ id: string; supersedes_id: string | null }>("select id, supersedes_id from outreach_events where user_id = $1 and op_id = $2", [userId, m.opId]);
  if (prior.rows[0]) {
    if (prior.rows[0].supersedes_id !== m.id) return { status: 409, body: { error: "That operation id was already used for something else." } };
    const [item, previous] = [await load(prior.rows[0].id), await load(m.id)];
    return { status: 200, body: { item: item && calendarItem(item), previous: previous && calendarItem(previous), replayed: true } };
  }

  const old = await db.query(
    "select id, contact_id, kind, status, due_at, meeting_at, rule, trigger_id from outreach_events where user_id = $1 and id = $2", [userId, m.id],
  );
  const e = old.rows[0] as { id: string; contact_id: string; kind: string; status: string; meeting_at: Date | null; rule: string | null; trigger_id: string | null } | undefined;
  if (!e) return { status: 404, body: { error: "Step not found." } };
  const isMeeting = e.kind === "meeting_booked";
  if (!(e.status === "due" || (isMeeting && e.status === "done"))) return { status: 409, body: { error: "Only a step that is still due can be moved." } };

  // A meeting keeps its own time of day unless a new one is given; other steps go to the outreach time.
  const keep = isMeeting && e.meeting_at ? new Date(new Date(e.meeting_at).getTime() + 330 * 60_000).toISOString().slice(11, 16) : DEFAULT_TIMES.message;
  const at = istToUTC(m.day, m.time ?? keep);
  try {
    const out = await recordEvent(db, userId, {
      type: "insert", opId: m.opId, contactId: e.contact_id, kind: e.kind as never, supersedes: { id: m.id, reason: "moved" },
      ...(isMeeting ? { status: "done" as const, meetingAt: at } : { status: "due" as const, dueAt: at, ...(e.rule ? { rule: e.rule } : {}), ...(e.trigger_id ? { triggerId: e.trigger_id } : {}) }),
    });
    const [item, previous] = [await load(out.event.id), await load(m.id)];
    return { status: 200, body: { item: item && calendarItem(item), previous: previous && calendarItem(previous), replayed: out.replayed } };
  } catch (err) {
    if (err instanceof TimelineError) return { status: err.code === "not_found" ? 404 : err.code === "conflict" ? 409 : 400, body: { error: err.message } };
    return { status: 500, body: { error: "Could not move that step." } };
  }
}
