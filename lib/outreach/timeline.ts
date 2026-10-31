import { randomUUID } from "node:crypto";
import { transaction, type Db } from "../db";
import { todayIST } from "../ist";
import { getContact, type Contact, type ContactStatus } from "./contacts-db";
import { suggest } from "./followup";

/**
 * The contact timeline (build plan KTD14, KTD15): every step is an event row, and the contact's
 * summary (status, stage dates, next step, outcome) is rewritten from those events in the same
 * transaction. `recordEvent` is the only code that writes either.
 */

export const EVENT_KINDS = [
  "why", "invite_sent", "accepted", "message_sent", "reply", "meeting_booked", "meeting_done", "thank_you",
  "follow_up", "second_person", "check_in", "referral_ask", "reschedule", "withdraw", "goal_reached", "closed",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export type EventStatus = "due" | "done" | "superseded";
export type Happened = "yes" | "no_show" | "moved";
export type Rating = "good" | "neutral" | "bad";
export type SupersededReason = "moved" | "reply" | "dismissed" | "undone" | "finished";
export const NOTE_MAX = 280;

export type TimelineEvent = {
  id: string; userId: string; contactId: string; kind: EventKind; status: EventStatus;
  dueAt: Date | null; doneAt: Date | null; meetingAt: Date | null; happened: Happened | null; rating: Rating | null;
  note: string | null; rule: string | null; supersededReason: SupersededReason | null;
  supersedesId: string | null; triggerId: string | null; opId: string; createdAt: Date;
};

/** Add an event. A done event defaults to now; a due event needs `dueAt`. `opId` makes a retry a no-op. */
export type InsertOp = {
  type: "insert"; opId: string; contactId: string; kind: EventKind; status?: "done" | "due";
  doneAt?: Date; dueAt?: Date; meetingAt?: Date; happened?: Happened; rating?: Rating; note?: string;
  rule?: string; triggerId?: string;
  /** Replace an earlier event with this one (moving a date): the old one is superseded in the same transaction. */
  supersedes?: { id: string; reason: SupersededReason };
};
/** Change an event that is not superseded. `done: true` turns a due event into a done one. */
export type UpdateOp = {
  type: "update"; eventId: string;
  patch: { dueAt?: Date | null; doneAt?: Date; meetingAt?: Date | null; happened?: Happened | null; rating?: Rating | null; note?: string | null; done?: true };
};
/** Strike an event out (undo, dismiss, moved ...). Repeating it changes nothing. */
export type SupersedeOp = { type: "supersede"; eventId: string; reason: SupersededReason };
export type TimelineOp = InsertOp | UpdateOp | SupersedeOp;

export type RecordResult = {
  /** The event this op inserted, changed or superseded. */
  event: TimelineEvent;
  /** The contact's whole timeline after the op, oldest first. */
  events: TimelineEvent[];
  contact: Contact;
  /** True when `opId` had been used before: nothing was written and `event` is the earlier row. */
  replayed: boolean;
};

export class TimelineError extends Error {
  readonly code: "not_found" | "invalid" | "conflict";
  constructor(code: "not_found" | "invalid" | "conflict", message: string) {
    super(message);
    this.code = code;
    this.name = "TimelineError";
  }
}

/**
 * Suggestion rules (KTD16). `followup.suggest(contact, events, now)` returns the ops to apply after the
 * user's op: due events (each with its `opId`, `rule` text and the `triggerId` of the event that caused it)
 * and supersede ops.
 */
export type Suggest = (contact: Contact, events: TimelineEvent[], now: Date) => Array<InsertOp | SupersedeOp>;
export { suggest };

type Row = Record<string, unknown>;
const when = (x: unknown) => (x ? new Date(x as string) : null);
const toEvent = (r: Row): TimelineEvent => ({
  id: r.id as string, userId: r.user_id as string, contactId: r.contact_id as string, kind: r.kind as EventKind,
  status: r.status as EventStatus, dueAt: when(r.due_at), doneAt: when(r.done_at), meetingAt: when(r.meeting_at),
  happened: (r.happened as Happened | null) ?? null, rating: (r.rating as Rating | null) ?? null, note: (r.note as string | null) ?? null,
  rule: (r.rule as string | null) ?? null, supersededReason: (r.superseded_reason as SupersededReason | null) ?? null,
  supersedesId: (r.supersedes_id as string | null) ?? null, triggerId: (r.trigger_id as string | null) ?? null,
  opId: r.op_id as string, createdAt: new Date(r.created_at as string),
});

/** A contact's timeline, oldest first. Only the owner's rows come back. */
export async function listEvents(db: Db, userId: string, contactId: string): Promise<TimelineEvent[]> {
  const r = await db.query("select * from outreach_events where user_id = $1 and contact_id = $2 order by coalesce(done_at, due_at, created_at), created_at, id", [userId, contactId]);
  return r.rows.map(toEvent);
}

async function getEvent(db: Db, userId: string, id: string): Promise<TimelineEvent | null> {
  const r = await db.query("select * from outreach_events where user_id = $1 and id = $2", [userId, id]);
  return r.rows[0] ? toEvent(r.rows[0]) : null;
}

const bad = (message: string): never => {
  throw new TimelineError("invalid", message);
};

/** The rules every stored event follows (R40, R41). */
function check(e: Pick<TimelineEvent, "kind" | "status" | "dueAt" | "doneAt" | "meetingAt" | "happened" | "rating" | "note">, now: Date) {
  if (!EVENT_KINDS.includes(e.kind)) bad("Unknown step.");
  if (e.note !== null && e.note.length > NOTE_MAX) bad(`A note can be at most ${NOTE_MAX} characters.`);
  if (e.status === "done") {
    if (!e.doneAt || Number.isNaN(e.doneAt.getTime())) bad("A done step needs a date.");
    else if (todayIST(e.doneAt) > todayIST(now)) bad("A done step can be dated today or earlier.");
  }
  if (e.status === "due" && (!e.dueAt || Number.isNaN(e.dueAt.getTime()))) bad("A suggested step needs a due date.");
  if (e.kind === "meeting_booked" && (!e.meetingAt || Number.isNaN(e.meetingAt.getTime()))) bad("A booked meeting needs its date and time.");
  if (e.kind === "meeting_done" && e.status === "done" && !e.happened) bad("Say whether the meeting happened.");
  if (e.rating && e.kind !== "meeting_done") bad("Only a meeting can be rated.");
}

/** Applies one op. Returns the event it touched and whether it was a retry. Runs inside recordEvent's transaction. */
async function apply(db: Db, userId: string, op: InsertOp | UpdateOp | SupersedeOp, now: Date): Promise<{ event: TimelineEvent; replayed: boolean }> {
  if (op.type === "insert") {
    const prior = await db.query("select * from outreach_events where user_id = $1 and op_id = $2", [userId, op.opId]);
    if (prior.rows[0]) {
      const event = toEvent(prior.rows[0]);
      if (event.contactId !== op.contactId) throw new TimelineError("conflict", "That operation id was already used for another contact.");
      return { event, replayed: true };
    }
    const status = op.status ?? "done";
    const draft = {
      kind: op.kind, status, dueAt: status === "due" ? op.dueAt ?? null : null, doneAt: status === "done" ? op.doneAt ?? now : null,
      meetingAt: op.meetingAt ?? null, happened: op.happened ?? null, rating: op.rating ?? null, note: op.note ?? null,
    };
    check(draft, now);
    if (op.supersedes) {
      const old = await getEvent(db, userId, op.supersedes.id);
      if (!old || old.contactId !== op.contactId) throw new TimelineError("not_found", "Step not found.");
    }
    const r = await db.query(
      `insert into outreach_events (id, user_id, contact_id, kind, status, due_at, done_at, meeting_at, happened, rating, note, rule, supersedes_id, trigger_id, op_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,
      [randomUUID(), userId, op.contactId, op.kind, status, draft.dueAt, draft.doneAt, draft.meetingAt, draft.happened, draft.rating, draft.note, op.rule ?? null, op.supersedes?.id ?? null, op.triggerId ?? null, op.opId],
    );
    if (op.supersedes) {
      await db.query("update outreach_events set status = 'superseded', superseded_reason = $3 where user_id = $1 and id = $2 and status <> 'superseded'", [userId, op.supersedes.id, op.supersedes.reason]);
    }
    return { event: toEvent(r.rows[0]), replayed: false };
  }
  const current = await getEvent(db, userId, op.eventId);
  if (!current) throw new TimelineError("not_found", "Step not found.");
  if (op.type === "supersede") {
    if (current.status === "superseded") return { event: current, replayed: true };
    const r = await db.query("update outreach_events set status = 'superseded', superseded_reason = $3 where user_id = $1 and id = $2 returning *", [userId, current.id, op.reason]);
    return { event: toEvent(r.rows[0]), replayed: false };
  }
  if (current.status === "superseded") bad("A replaced step can't be changed.");
  const p = op.patch;
  const next = {
    kind: current.kind, status: p.done ? ("done" as const) : current.status,
    dueAt: p.dueAt !== undefined ? p.dueAt : current.dueAt,
    doneAt: p.doneAt ?? (p.done ? now : current.doneAt),
    meetingAt: p.meetingAt !== undefined ? p.meetingAt : current.meetingAt,
    happened: p.happened !== undefined ? p.happened : current.happened,
    rating: p.rating !== undefined ? p.rating : current.rating,
    note: p.note !== undefined ? p.note : current.note,
  };
  if (current.status === "due" && !p.done && p.doneAt) bad("Mark the step done to give it a done date.");
  check(next, now);
  const r = await db.query(
    "update outreach_events set status = $3, due_at = $4, done_at = $5, meeting_at = $6, happened = $7, rating = $8, note = $9 where user_id = $1 and id = $2 returning *",
    [userId, current.id, next.status, next.dueAt, next.doneAt, next.meetingAt, next.happened, next.rating, next.note],
  );
  return { event: toEvent(r.rows[0]), replayed: false };
}

/** Furthest stage first. A done, non-superseded event of this kind lifts the contact to at least this status. */
const STAGE: Partial<Record<EventKind, ContactStatus>> = {
  invite_sent: "invited", accepted: "accepted", message_sent: "messaged", reply: "replied",
  meeting_booked: "meeting", meeting_done: "meeting", goal_reached: "outcome", closed: "outcome",
};
const RANK: ContactStatus[] = ["to_contact", "invited", "accepted", "messaged", "replied", "meeting", "outcome"];

export type Summary = {
  status: ContactStatus; invitedAt: Date | null; acceptedAt: Date | null; messagedAt: Date | null; repliedAt: Date | null;
  outcomeAt: Date | null; goalReachedAt: Date | null; closedAt: Date | null; nextActionAt: Date | null; outcome: "positive" | "no_response" | null;
};

/**
 * What the contact row should say, from its events alone. The stage is the furthest done, non-superseded
 * step, whatever order the steps were recorded in. The next step is the earliest suggested step or the
 * meeting that hasn't been answered yet; a finished or closed contact has none.
 */
export function summarize(events: TimelineEvent[]): Summary {
  const live = events.filter((e) => e.status !== "superseded");
  const done = live.filter((e) => e.status === "done" && e.doneAt);
  const first = (kind: EventKind) => done.filter((e) => e.kind === kind).map((e) => e.doneAt!.getTime()).sort((a, b) => a - b)[0];
  const at = (kind: EventKind) => { const t = first(kind); return t === undefined ? null : new Date(t); };
  let status: ContactStatus = "to_contact";
  for (const e of done) { const s = STAGE[e.kind]; if (s && RANK.indexOf(s) > RANK.indexOf(status)) status = s; }
  const goalReachedAt = at("goal_reached"), closedAt = at("closed");
  const finished = [goalReachedAt, closedAt].filter((d): d is Date => !!d).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const times = live.filter((e) => e.status === "due" && e.dueAt).map((e) => e.dueAt!.getTime());
  const booked = done.filter((e) => e.kind === "meeting_booked" && e.meetingAt).sort((a, b) => b.doneAt!.getTime() - a.doneAt!.getTime())[0];
  if (booked && !done.some((e) => e.kind === "meeting_done" && e.doneAt!.getTime() > booked.doneAt!.getTime())) times.push(booked.meetingAt!.getTime());
  return {
    status, invitedAt: at("invite_sent"), acceptedAt: at("accepted"), messagedAt: at("message_sent"), repliedAt: at("reply"),
    outcomeAt: finished, goalReachedAt, closedAt,
    nextActionAt: finished || !times.length ? null : new Date(Math.min(...times)),
    outcome: goalReachedAt ? "positive" : closedAt ? "no_response" : null,
  };
}

/**
 * Record one step on a contact's timeline. Everything below happens in one transaction:
 *  1. apply the op (insert, update or supersede)
 *  2. ask `suggest` for follow-on ops, and apply them
 *  3. rewrite the contact's summary from its events
 * so a failure anywhere leaves no trace. A repeated insert (same `opId`) returns the earlier row and writes nothing.
 * Another user's contact or event is reported as not found.
 */
export async function recordEvent(db: Db, userId: string, op: TimelineOp, opts: { now?: Date; suggest?: Suggest } = {}): Promise<RecordResult> {
  const now = opts.now ?? new Date();
  const ask = opts.suggest ?? suggest;
  return transaction(db, async (tx) => {
    let contactId: string;
    if (op.type === "insert") contactId = op.contactId;
    else {
      const found = await getEvent(tx, userId, op.eventId);
      if (!found) throw new TimelineError("not_found", "Step not found.");
      contactId = found.contactId;
    }
    // Locking the contact row serialises two records on the same contact, so the summary can't go stale.
    const locked = await tx.query("select id from contacts where user_id = $1 and id = $2 for update", [userId, contactId]);
    if (!locked.rows.length) throw new TimelineError("not_found", "Contact not found.");

    const applied = await apply(tx, userId, op, now);
    if (applied.replayed) {
      const contact = (await getContact(tx, userId, contactId))!;
      return { event: applied.event, events: await listEvents(tx, userId, contactId), contact, replayed: true };
    }
    const suggestions = ask((await getContact(tx, userId, contactId))!, await listEvents(tx, userId, contactId), now);
    for (const s of suggestions) await apply(tx, userId, s, now);

    const events = await listEvents(tx, userId, contactId);
    const s = summarize(events);
    await tx.query(
      `update contacts set status = $3, invited_at = $4, accepted_at = $5, messaged_at = $6, replied_at = $7, outcome_at = $8,
         goal_reached_at = $9, closed_at = $10, next_action_at = $11, outcome = $12, updated_at = now() where user_id = $1 and id = $2`,
      [userId, contactId, s.status, s.invitedAt, s.acceptedAt, s.messagedAt, s.repliedAt, s.outcomeAt, s.goalReachedAt, s.closedAt, s.nextActionAt, s.outcome],
    );
    const event = (await getEvent(tx, userId, applied.event.id))!;
    return { event, events, contact: (await getContact(tx, userId, contactId))!, replayed: false };
  });
}
