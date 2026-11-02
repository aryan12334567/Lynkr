import { z } from "zod";
import { sessionUser } from "@/lib/auth";
import { requireLicense } from "@/lib/billing";
import { cloudReady, getDb, type Db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { istToUTC } from "@/lib/ist";
import { DEFAULT_TIMES } from "@/lib/plan";
import { pendingMeetings } from "@/lib/outreach/calendar";
import { getContact } from "@/lib/outreach/contacts-db";
import { EVENT_KINDS, NOTE_MAX, TimelineError, listEvents, recordEvent, type TimelineOp } from "@/lib/outreach/timeline";

/**
 * One contact's timeline (R40, R41, R47). GET reads it; POST records, changes or strikes out one step through
 * `recordEvent`, the only writer. Reads need a signed-in account and nothing more, so a lapsed subscription can still
 * read its timeline. Writes need a paid account, and a refused write changes nothing.
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

/** A date or a date and time. A bare date means that day at the outreach time (IST). */
const when = z.string().max(40).refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(v), "Use a date or a date and time.")
  .transform((v) => (v.length === 10 ? istToUTC(v, DEFAULT_TIMES.message) : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), "Use a real date.");
const id = z.string().min(1).max(64);
const note = z.string().trim().max(NOTE_MAX);
const happened = z.enum(["yes", "no_show", "moved"]);
const rating = z.enum(["good", "neutral", "bad"]);

const Insert = z.object({
  type: z.literal("insert"), op_id: z.string().min(8).max(100), contactId: id, kind: z.enum(EVENT_KINDS), status: z.enum(["done", "due"]).optional(),
  doneAt: when.optional(), dueAt: when.optional(), meetingAt: when.optional(), happened: happened.optional(), rating: rating.optional(),
  note: note.optional(), rule: z.string().trim().max(400).optional(), triggerId: id.optional(),
}).strict();
const Update = z.object({
  type: z.literal("update"), eventId: id,
  patch: z.object({
    dueAt: when.nullable().optional(), doneAt: when.optional(), meetingAt: when.nullable().optional(), happened: happened.nullable().optional(),
    rating: rating.nullable().optional(), note: note.nullable().optional(), done: z.literal(true).optional(),
  }).strict(),
}).strict();
// "moved" belongs to the Calendar's PATCH; "reply" and "finished" are the rules' own reasons.
const Supersede = z.object({ type: z.literal("supersede"), eventId: id, reason: z.enum(["undone", "dismissed"]) }).strict();
const Body = z.discriminatedUnion("type", [Insert, Update, Supersede]);

export async function GET(req: Request) {
  const c = await context(req, false); if ("error" in c) return c.error;
  const q = z.object({ contactId: id }).strict().safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!q.success) return Response.json({ error: "Say which contact." }, { status: 400 });
  const contact = await getContact(c.db, c.userId, q.data.contactId);
  if (!contact) return Response.json({ error: "Contact not found." }, { status: 404 });
  const events = await listEvents(c.db, c.userId, contact.id);
  // The meeting card (R41) is a query over the timeline, not a timer.
  const card = pendingMeetings(events, new Date())[0] ?? null;
  return Response.json({ contact, events, meetingCard: card ? { eventId: card.id, meetingAt: card.meetingAt } : null });
}

export async function POST(req: Request) {
  const c = await context(req, true); if ("error" in c) return c.error;
  const read = await readJson(req, 8 * 1024); if ("error" in read) return read.error;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Check the step and its dates." }, { status: 400 });
  const b = parsed.data;
  let op: TimelineOp;
  if (b.type === "insert") {
    if (b.triggerId) {
      const found = await c.db.query("select 1 from outreach_events where user_id = $1 and contact_id = $2 and id = $3", [c.userId, b.contactId, b.triggerId]);
      if (!found.rows.length) return Response.json({ error: "Step not found." }, { status: 404 });
    }
    op = {
      type: "insert", opId: b.op_id, contactId: b.contactId, kind: b.kind, status: b.status, doneAt: b.doneAt, dueAt: b.dueAt, meetingAt: b.meetingAt,
      happened: b.happened, rating: b.rating, note: b.note, rule: b.rule, triggerId: b.triggerId,
    };
  } else if (b.type === "update") op = { type: "update", eventId: b.eventId, patch: b.patch };
  else op = { type: "supersede", eventId: b.eventId, reason: b.reason };
  try {
    const out = await recordEvent(c.db, c.userId, op);
    return Response.json(out, { status: b.type === "insert" && !out.replayed ? 201 : 200 });
  } catch (e) {
    if (e instanceof TimelineError) {
      const status = e.code === "not_found" ? 404 : e.code === "conflict" ? 409 : 400;
      return Response.json({ error: e.message }, { status });
    }
    return Response.json({ error: "Could not save that step." }, { status: 500 });
  }
}
