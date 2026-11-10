import { buildIcs, googleCalendarUrl, type CalEvent } from "../ics";
import { addDays, istToUTC, todayIST } from "../ist";

/** An activity entered or confirmed by the user, with a link back to the contact. */
export const OUTREACH_EVENT_TYPES = ["connect_sent", "connect_approved", "meeting_scheduled", "meeting_completed", "reply_received", "follow_up_due", "outcome_recorded"] as const;
export type OutreachEventType = (typeof OUTREACH_EVENT_TYPES)[number];
export type OutreachEvent = {
  id: string;
  contactId: string;
  person: string;
  type: OutreachEventType;
  day: string;
  time: string;
  goal: string;
  intent: string;
  reason?: string;
  connectionStatus?: string;
  meetingOutcome?: "good" | "bad" | "neutral";
  replyStatus?: string;
  outcome?: string;
  /** Optional, explicitly entered by the user; never derived from a connections import. */
  attendeeEmail?: string;
};

const TITLES: Record<OutreachEventType, string> = {
  connect_sent: "Connection request sent",
  connect_approved: "Connection accepted",
  meeting_scheduled: "Meeting scheduled",
  meeting_completed: "Meeting completed",
  reply_received: "Reply received",
  follow_up_due: "Follow-up due",
  outcome_recorded: "Outcome recorded",
};

/** Reuse existing reminders; no event causes a message or invitation to be sent. */
export function calendarEvent(event: OutreachEvent): CalEvent {
  const details = [
    event.reason ? `Reason: ${event.reason}` : "",
    event.connectionStatus ? `Connection status: ${event.connectionStatus}` : "",
    event.meetingOutcome ? `Meeting outcome: ${event.meetingOutcome}` : "",
    event.replyStatus ? `Reply status: ${event.replyStatus}` : "",
    event.outcome ? `Outcome: ${event.outcome}` : "",
    event.goal ? `Goal: ${event.goal}` : "",
    event.intent ? `Intent: ${event.intent}` : "",
    "You take the next action yourself.",
  ].filter(Boolean).join("\n");
  return { uid: `outreach-${event.id}`, title: `${TITLES[event.type]}: ${event.person}`, description: details, day: event.day, time: event.time };
}

export function outreachIcs(events: OutreachEvent[], now = new Date()): string {
  let i = 0;
  return buildIcs(events.map(calendarEvent), now).replace(/END:VEVENT/g, () => {
    const email = attendee(events[i++]);
    return email ? `ATTENDEE:mailto:${email}\r\nEND:VEVENT` : "END:VEVENT";
  });
}
export function downloadOutreachIcs(filename: string, events: OutreachEvent[]): void {
  const blob = new Blob([outreachIcs(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function attendee(event: OutreachEvent): string | null {
  const email = event.attendeeEmail?.trim();
  // Keep the iCalendar property under 75 bytes and reject delimiters and line breaks.
  return email && email.length <= 58 && /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email) ? email : null;
}

/** Google opens a review screen; an attendee is included only when explicitly supplied. */
export function outreachGoogleCalendarUrl(event: OutreachEvent): string {
  const u = new URL(googleCalendarUrl(calendarEvent(event)));
  const email = attendee(event);
  if (email) u.searchParams.set("add", email);
  return u.toString();
}

/** Replace an existing event by id, preserving unrelated contact events. */
export function saveOutreachEvent(events: OutreachEvent[], event: OutreachEvent): OutreachEvent[] {
  return [...events.filter(item => item.id !== event.id), event].sort((a, b) => `${a.day}${a.time}`.localeCompare(`${b.day}${b.time}`));
}
export function removeOutreachEvent(events: OutreachEvent[], id: string): OutreachEvent[] {
  return events.filter(event => event.id !== id);
}

// ---------------------------------------------------------------------------------------------
// Timeline events as Calendar items (build plan KTD17, R44, R45). Pure: the routes load the rows and call these.
// Nothing here imports the database, because the browser imports this file too.
// ---------------------------------------------------------------------------------------------

/** R44's step types, as the Calendar names them. */
export const CALENDAR_KINDS = ["invite", "message", "follow_up", "second_person", "meeting", "reschedule", "thank_you", "check_in", "referral_ask", "withdraw", "close"] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];
export type CalendarStatus = "due" | "done" | "superseded";

/** What A5's grid, Today and the Monday to-do read. A superseded item is returned, flagged, so the old date can be struck through. */
export type CalendarItem = {
  id: string; contactId: string; person: string; kind: CalendarKind;
  /** ISO instant. A meeting has the time entered; other steps are at the outreach time on their day. */
  at: string; status: CalendarStatus; goal: string;
  /** Why the step was suggested; null for a step the user added. */
  rule: string | null;
};

/** The columns of an `outreach_events` row, plus its contact's name and goal. */
export type CalendarRow = {
  id: string; contactId: string; person: string; goal: string; kind: string; status: CalendarStatus;
  dueAt: Date | null; doneAt: Date | null; meetingAt: Date | null; rule: string | null;
};
/** The part of a timeline event that the meeting-card query needs; a `TimelineEvent` fits it. */
export type EventLike = Pick<CalendarRow, "id" | "kind" | "status" | "dueAt" | "doneAt" | "meetingAt" | "rule" | "contactId">;

const when = (x: unknown): Date | null => (x ? new Date(x as string) : null);
/** Reads one row of the calendar query (snake_case columns, `name` and `goal` from the contact). */
export function calendarRow(r: Record<string, unknown>): CalendarRow {
  return {
    id: r.id as string, contactId: r.contact_id as string, person: r.name as string, goal: r.goal as string, kind: r.kind as string,
    status: r.status as CalendarStatus, dueAt: when(r.due_at), doneAt: when(r.done_at), meetingAt: when(r.meeting_at), rule: (r.rule as string | null) ?? null,
  };
}

const KIND_OF: Record<string, CalendarKind> = {
  invite_sent: "invite", message_sent: "message", follow_up: "follow_up", second_person: "second_person", meeting_booked: "meeting",
  reschedule: "reschedule", thank_you: "thank_you", check_in: "check_in", referral_ask: "referral_ask", withdraw: "withdraw", closed: "close",
};

function instant(r: EventLike): Date | null {
  if (r.kind === "meeting_booked" && r.meetingAt) return r.meetingAt;
  return r.status === "done" ? r.doneAt ?? r.dueAt : r.dueAt ?? r.doneAt;
}

/** A meeting card is owed for a booked meeting more than an hour past, with no later "meeting done" and no newer booking (R41, KTD16). */
export function pendingMeetings<T extends EventLike>(events: readonly T[], now: Date): T[] {
  const cutoff = now.getTime() - 60 * 60_000;
  return events
    .filter((b) => b.kind === "meeting_booked" && b.status === "done" && b.doneAt && b.meetingAt && b.meetingAt.getTime() < cutoff)
    .filter((b) => !events.some((o) => o.contactId === b.contactId && o.id !== b.id && o.status === "done" && o.doneAt
      && (o.kind === "meeting_done" || o.kind === "meeting_booked") && o.doneAt.getTime() > b.doneAt!.getTime()))
    .sort((a, b) => a.meetingAt!.getTime() - b.meetingAt!.getTime() || a.id.localeCompare(b.id));
}

/** One row as an item. `answered` says a booked meeting already has its "did it happen" answer. */
export function calendarItem(r: CalendarRow, answered = false): CalendarItem | null {
  const kind = KIND_OF[r.kind], at = instant(r);
  if (!kind || !at) return null;
  const status: CalendarStatus = r.status === "superseded" ? "superseded" : r.kind === "meeting_booked" ? (answered ? "done" : "due") : r.status;
  return { id: r.id, contactId: r.contactId, person: r.person, kind, at: at.toISOString(), status, goal: r.goal, rule: r.rule };
}

/** Every Calendar item in `rows`, oldest first. `rows` must hold each contact's meeting answers too, so a booked meeting reads as done once answered. */
export function calendarItems(rows: readonly CalendarRow[]): CalendarItem[] {
  const open = new Set(pendingMeetings(rows, new Date(8.64e15)).map((m) => m.id));
  return rows
    .map((r) => calendarItem(r, r.kind === "meeting_booked" && r.status === "done" && !open.has(r.id)))
    .filter((i): i is CalendarItem => !!i)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

// ---- the window ----

function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
const MONTHS_BACK = 1, MONTHS_AHEAD = 5;
/** The Calendar shows one month back and five ahead (UpLinked #8). A longer request is cut down to that, not refused. `to` is exclusive. */
export function clampWindow(now: Date, from?: Date, to?: Date): { from: Date; to: Date; clamped: boolean } {
  const today = todayIST(now);
  const min = istToUTC(addMonths(today, -MONTHS_BACK), "00:00");
  const max = istToUTC(addDays(addMonths(today, MONTHS_AHEAD), 1), "00:00");
  const wantFrom = from ?? min, wantTo = to ?? max;
  const f = new Date(Math.max(wantFrom.getTime(), min.getTime())), t = new Date(Math.min(wantTo.getTime(), max.getTime()));
  return { from: f, to: t, clamped: f.getTime() !== wantFrom.getTime() || t.getTime() !== wantTo.getTime() };
}

// ---- the Monday to-do (R45) ----

export type TodoGroup = "meeting" | "question" | "step";
export type TodoItem = CalendarItem & { group: TodoGroup; overdue: boolean };
const QUESTION_KINDS: readonly string[] = ["second_person", "follow_up", "withdraw", "close"];
export const TODO_EMPTY = "All caught up this week";

/**
 * What the user still owes, in R45's order: meetings with an unanswered card, then the "did they reply / accept?"
 * questions, then the other due steps they haven't recorded. Anything due today or earlier counts; a step due
 * later in the week is not owed yet. Within a group the oldest comes first. `rows` must be for unfinished contacts.
 */
export function mondayTodo(rows: readonly CalendarRow[], now: Date): { items: TodoItem[]; empty: boolean; message: string } {
  const today = todayIST(now);
  const items: TodoItem[] = [];
  for (const m of pendingMeetings(rows, now)) {
    items.push({ id: m.id, contactId: m.contactId, person: m.person, kind: "meeting", at: m.meetingAt!.toISOString(), status: "due", goal: m.goal, rule: null, group: "meeting", overdue: true });
  }
  for (const r of rows) {
    if (r.status !== "due" || !r.dueAt || todayIST(r.dueAt) > today) continue;
    const item = calendarItem(r);
    if (item) items.push({ ...item, group: QUESTION_KINDS.includes(item.kind) ? "question" : "step", overdue: todayIST(r.dueAt) < today });
  }
  const rank: Record<TodoGroup, number> = { meeting: 0, question: 1, step: 2 };
  items.sort((a, b) => rank[a.group] - rank[b.group] || a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  return { items, empty: items.length === 0, message: items.length ? "" : TODO_EMPTY };
}

// ---- a meeting item as .ics and a Google link (R44) ----

const istTime = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(11, 16);
/** The meeting as an OutreachEvent for `outreachIcs` and `outreachGoogleCalendarUrl`: the person's name and time (IST), and an attendee only when the user entered one. */
export function meetingEvent(item: Pick<CalendarItem, "id" | "contactId" | "person" | "at" | "goal">, opts: { attendeeEmail?: string; reason?: string } = {}): OutreachEvent {
  const at = new Date(item.at);
  return { id: item.id, contactId: item.contactId, person: item.person, type: "meeting_scheduled", day: todayIST(at), time: istTime(at), goal: item.goal, intent: "", reason: opts.reason, attendeeEmail: opts.attendeeEmail };
}
