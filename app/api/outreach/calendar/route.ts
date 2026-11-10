import { z } from "zod";
import { sessionUser } from "@/lib/auth";
import { requireLicense } from "@/lib/billing";
import { cloudReady, getDb, type Db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { addDays, istToUTC, todayIST } from "@/lib/ist";
import { DEFAULT_TIMES } from "@/lib/plan";
import { calendarItem, calendarItems, calendarRow, clampWindow, type CalendarRow } from "@/lib/outreach/calendar";
import { TimelineError, recordEvent } from "@/lib/outreach/timeline";

/**
 * The Calendar feed (KTD17). GET returns a window of items; PATCH moves one: the old item is superseded and the new
 * date inserted in one transaction, once per `op_id`. Reads need a signed-in account only; the move needs a paid one.
 */
async function context(req: Request, write: boolean): Promise<{ db: Db; userId: string } | { error: Response }> {
  if (write) { const denied = await requireLicense(req); if (denied) return { error: denied }; }
  const user = await sessionUser(req);
  if (!user) return { error: Response.json({ error: "Please sign in first." }, { status: 401 }) };
  if (!(await cloudReady())) return { error: Response.json({ error: "Account storage is unavailable." }, { status: 409 }) };
  const db = getDb();
  const ready = await db.query<{ name: string | null }>("select to_regclass('public.outreach_events')::text as name");
  if (!ready.rows[0]?.name) return { error: Response.json({ error: "Outreach storage is unavailable." }, { status: 409 }) };
  return { db, userId: user.id };
}

const SELECT = "select e.id, e.contact_id, e.kind, e.status, e.due_at, e.done_at, e.meeting_at, e.rule, c.name, c.goal from outreach_events e join contacts c on c.id = e.contact_id and c.user_id = e.user_id";

/** A day ("2026-11-14") or an instant. Either reads as the IST day it falls on. */
const point = z.string().max(40).refine((v) => /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/.test(v) && !Number.isNaN(new Date(v).getTime()), "Use a date.");
const Query = z.object({ from: point.optional(), to: point.optional() }).strict();
const Move = z.object({
  op_id: z.string().min(8).max(100), id: z.string().min(1).max(64),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(istToUTC(d, "00:00").getTime()), "Use a real date."),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
}).strict();

export async function GET(req: Request) {
  const c = await context(req, false); if ("error" in c) return c.error;
  const q = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return Response.json({ error: "Use dates like 2026-11-01." }, { status: 400 });
  const now = new Date();
  const start = q.data.from ? istToUTC(todayIST(new Date(q.data.from.length === 10 ? `${q.data.from}T12:00:00+05:30` : q.data.from)), "00:00") : undefined;
  // `to` is the last day wanted, so the window runs to the start of the day after it.
  const end = q.data.to ? istToUTC(addDays(todayIST(new Date(q.data.to.length === 10 ? `${q.data.to}T12:00:00+05:30` : q.data.to)), 1), "00:00") : undefined;
  const win = clampWindow(now, start, end);
  // Finished and closed contacts have left the Calendar (R46). Rows carry each contact's meeting answers, so a booked meeting reads as done once answered.
  const rows = await c.db.query(`${SELECT} where e.user_id = $1 and e.kind <> 'why' and c.goal_reached_at is null and c.closed_at is null`, [c.userId]);
  const items = calendarItems(rows.rows.map(calendarRow)).filter((i) => i.at >= win.from.toISOString() && i.at < win.to.toISOString());
  return Response.json({ items, from: win.from.toISOString(), to: win.to.toISOString(), clamped: win.clamped });
}

export async function PATCH(req: Request) {
  const c = await context(req, true); if ("error" in c) return c.error;
  const read = await readJson(req, 2 * 1024); if ("error" in read) return read.error;
  const parsed = Move.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Check the item and the new date." }, { status: 400 });
  const { op_id: opId, id, day, time } = parsed.data;

  const load = async (eventId: string): Promise<CalendarRow | null> => {
    const r = await c.db.query(`${SELECT} where e.user_id = $1 and e.id = $2`, [c.userId, eventId]);
    return r.rows[0] ? calendarRow(r.rows[0]) : null;
  };
  // A retry: the move was already made, so return what it made and write nothing (AE10).
  const prior = await c.db.query<{ id: string; supersedes_id: string | null }>("select id, supersedes_id from outreach_events where user_id = $1 and op_id = $2", [c.userId, opId]);
  if (prior.rows[0]) {
    if (prior.rows[0].supersedes_id !== id) return Response.json({ error: "That operation id was already used for something else." }, { status: 409 });
    const [item, previous] = [await load(prior.rows[0].id), await load(id)];
    return Response.json({ item: item && calendarItem(item), previous: previous && calendarItem(previous), replayed: true });
  }

  const old = await c.db.query(
    "select id, contact_id, kind, status, due_at, meeting_at, rule, trigger_id from outreach_events where user_id = $1 and id = $2", [c.userId, id],
  );
  const e = old.rows[0] as { id: string; contact_id: string; kind: string; status: string; meeting_at: Date | null; rule: string | null; trigger_id: string | null } | undefined;
  if (!e) return Response.json({ error: "Step not found." }, { status: 404 });
  const isMeeting = e.kind === "meeting_booked";
  if (!(e.status === "due" || (isMeeting && e.status === "done"))) return Response.json({ error: "Only a step that is still due can be moved." }, { status: 409 });

  // A meeting keeps its own time of day unless a new one is given; other steps go to the outreach time.
  const keep = isMeeting && e.meeting_at ? new Date(new Date(e.meeting_at).getTime() + 330 * 60_000).toISOString().slice(11, 16) : DEFAULT_TIMES.message;
  const at = istToUTC(day, time ?? keep);
  try {
    const out = await recordEvent(c.db, c.userId, {
      type: "insert", opId, contactId: e.contact_id, kind: e.kind as never, supersedes: { id, reason: "moved" },
      ...(isMeeting ? { status: "done" as const, meetingAt: at } : { status: "due" as const, dueAt: at, ...(e.rule ? { rule: e.rule } : {}), ...(e.trigger_id ? { triggerId: e.trigger_id } : {}) }),
    });
    const [item, previous] = [await load(out.event.id), await load(id)];
    return Response.json({ item: item && calendarItem(item), previous: previous && calendarItem(previous), replayed: out.replayed });
  } catch (err) {
    if (err instanceof TimelineError) return Response.json({ error: err.message }, { status: err.code === "not_found" ? 404 : err.code === "conflict" ? 409 : 400 });
    return Response.json({ error: "Could not move that step." }, { status: 500 });
  }
}
