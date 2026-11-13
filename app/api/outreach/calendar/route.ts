import { z } from "zod";
import { sessionUser } from "@/lib/auth";
import { requireLicense } from "@/lib/billing";
import { cloudReady, getDb, type Db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { addDays, istToUTC, todayIST } from "@/lib/ist";
import { calendarItems, calendarRow, clampWindow } from "@/lib/outreach/calendar";
import { OUTREACH_SELECT, moveStep } from "@/lib/outreach/move";

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

const SELECT = OUTREACH_SELECT;

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
  const out = await moveStep(c.db, c.userId, { opId, id, day, time });
  return Response.json(out.body, { status: out.status });
}
