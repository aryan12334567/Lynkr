// The person card's timeline (R38-R41, R46): rows, text statuses, date rules, and the request bodies the taps send.
// Pure, so node tests run it. The screens (PersonTimeline, MeetingCard) only draw what this returns.
import { istToUTC, todayIST } from "../ist";
import { pendingMeetings } from "./calendar";
import type { ContactStatus } from "./contacts-db";
import type { EventKind, EventStatus, Happened, Rating, SupersededReason } from "./timeline";
import type { UiContact } from "./ui-board";

export const NOTE_MAX = 280; // the same limit as timeline.ts NOTE_MAX (a test keeps them equal)
export const WHY_MAX = 200;
export const LAPSED_NOTE = "Subscribe to record steps";

/** An outreach_events row as the browser gets it (dates are ISO strings). */
export type UiEvent = {
  id: string; contactId: string; kind: EventKind; status: EventStatus;
  dueAt: string | null; doneAt: string | null; meetingAt: string | null; happened: Happened | null; rating: Rating | null;
  note: string | null; rule: string | null; supersededReason: SupersededReason | null; supersedesId: string | null; triggerId: string | null;
  opId: string; createdAt: string;
};

/** One tap. `timeline` is POST /api/outreach/timeline; `calendar` is PATCH /api/outreach/calendar (moving a date). */
export type TimelineRequest =
  | { route: "timeline"; contactId: string; body: Record<string, unknown> }
  | { route: "calendar"; contactId: string; body: { op_id: string; id: string; day: string; time?: string } };
export type TimelineResult = { events: UiEvent[]; contact: UiContact | null; event?: UiEvent; replayed: boolean };
export type Send = (req: TimelineRequest) => Promise<TimelineResult>;

export const newOpId = (): string => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

// ---- dates ----

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-11-14" to "14 Nov". */
export function shortDay(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
export const shortDate = (iso: string): string => shortDay(todayIST(new Date(iso)));
/** "6:00 pm", in India time. */
export function clockTime(iso: string): string {
  const [h, m] = new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(11, 16).split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}
/** The "HH:MM" India time of an instant, for a time input. */
export const timeValue = (iso: string): string => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(11, 16);

/** The date a step sits on in the timeline. A booked meeting sits on the day of the meeting. */
export function eventDate(e: UiEvent): string | null {
  if (e.kind === "meeting_booked") return e.meetingAt ?? e.doneAt;
  if (e.status === "due") return e.dueAt ?? e.doneAt;
  return e.doneAt ?? e.dueAt ?? e.meetingAt;
}

// ---- labels ----

const DONE_LABEL: Record<EventKind, string> = {
  why: "Why you connected", invite_sent: "Invite sent", accepted: "Accepted", message_sent: "Message sent", reply: "Reply received",
  meeting_booked: "Meeting booked", meeting_done: "Meeting done", thank_you: "Thank-you sent", follow_up: "Follow-up sent",
  second_person: "Second person found", check_in: "Check-in sent", referral_ask: "Referral asked", reschedule: "Message to reschedule sent",
  withdraw: "Invite withdrawn", goal_reached: "Goal reached", closed: "Closed",
};
const DUE_LABEL: Record<EventKind, string> = {
  why: "Why you connected", invite_sent: "Send the invite", accepted: "Check if they accepted", message_sent: "Send a message", reply: "Check for a reply",
  meeting_booked: "Book the meeting", meeting_done: "Answer the meeting card", thank_you: "Send a thank-you note", follow_up: "Send a follow-up",
  second_person: "Find a second person at the same company", check_in: "Check in", referral_ask: "Ask for a referral",
  reschedule: "Send a short message to reschedule", withdraw: "Withdraw the invite", goal_reached: "Reach your goal", closed: "Close: no response",
};
export const RECORD_DONE_LABEL: Record<EventKind, string> = DONE_LABEL;

/** The step's name. A follow-up made by a meeting answer reads "Act on what they suggested". */
export function stepLabel(e: UiEvent, events: readonly UiEvent[]): string {
  if (e.kind === "follow_up" && e.triggerId && events.find((x) => x.id === e.triggerId)?.kind === "meeting_done") return "Act on what they suggested";
  return e.doneAt || e.kind === "meeting_booked" ? DONE_LABEL[e.kind] : DUE_LABEL[e.kind];
}

/** Steps that Lynkr can write a message for (the draft route's step kinds). */
export const WRITABLE: readonly EventKind[] = ["thank_you", "follow_up", "reschedule", "check_in", "referral_ask"];
export const canWriteIt = (e: Pick<UiEvent, "kind" | "status">): boolean => e.status === "due" && WRITABLE.includes(e.kind);

/** The one record that completes a suggested step. */
export function completeLabel(kind: EventKind): string {
  return ({
    second_person: "Mark second person found", follow_up: "Mark follow-up sent", withdraw: "Mark invite withdrawn", closed: "Close: no response",
    thank_you: "Mark thank-you sent", check_in: "Mark check-in sent", referral_ask: "Mark referral asked", reschedule: "Mark message sent",
  } as Partial<Record<EventKind, string>>)[kind] ?? "Mark done";
}

// ---- meeting card query ----

type WithDates = ReturnType<typeof asLike>;
function asLike(e: UiEvent) {
  return { ...e, dueAt: e.dueAt ? new Date(e.dueAt) : null, doneAt: e.doneAt ? new Date(e.doneAt) : null, meetingAt: e.meetingAt ? new Date(e.meetingAt) : null };
}
/** A booked meeting more than an hour past with no answer and no newer booking (R41). Nothing is pushed: this is a query. */
export function pendingMeeting(events: readonly UiEvent[], now: Date): UiEvent | null {
  const live = events.filter((e) => e.status !== "superseded").map(asLike);
  const first: WithDates | undefined = pendingMeetings(live, now)[0];
  return first ? events.find((e) => e.id === first.id) ?? null : null;
}

// ---- rows ----

export type RowTone = "done" | "scheduled" | "suggested" | "superseded";
export type TimelineRow = {
  event: UiEvent; label: string; tone: RowTone;
  /** What a screen reader hears after the label. The strike-through is only a look. */
  statusText: string; struck: boolean; onCalendar: boolean;
  /** "Useful" or "No-show", for a meeting that was answered. */
  detail: string; noteLine: string | null; reason: string | null;
};

const RATING_WORD: Record<Rating, string> = { good: "Useful", neutral: "OK", bad: "Not useful" };
export const ratingWord = (r: Rating): string => RATING_WORD[r];
const HAPPENED_WORD: Record<Happened, string> = { yes: "Happened", no_show: "No-show", moved: "Moved" };

function replacedText(e: UiEvent, events: readonly UiEvent[]): string {
  switch (e.supersededReason) {
    case "moved": {
      const next = events.find((x) => x.supersedesId === e.id);
      const at = next && eventDate(next);
      return at ? `Replaced by ${shortDate(at)}` : "Replaced";
    }
    case "dismissed": return "Dismissed";
    case "undone": return "Undone";
    case "reply": return "Not needed: they replied";
    case "finished": return "Not needed: this contact is finished";
    default: return "Replaced";
  }
}

export function timelineRows(events: readonly UiEvent[], now: Date): TimelineRow[] {
  const today = todayIST(now);
  const pending = pendingMeeting(events, now);
  const key = (e: UiEvent) => { const d = eventDate(e); return d ? new Date(d).getTime() : 0; };
  return events
    .filter((e) => e.kind !== "why")
    .sort((a, b) => key(a) - key(b) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((e): TimelineRow => {
      const at = eventDate(e);
      let tone: RowTone, statusText: string, onCalendar = false;
      if (e.status === "superseded") { tone = "superseded"; statusText = replacedText(e, events); }
      else if (e.kind === "meeting_booked" && e.meetingAt) {
        const upcoming = new Date(e.meetingAt).getTime() > now.getTime();
        const when = `${shortDate(e.meetingAt)}, ${clockTime(e.meetingAt)} IST`;
        if (upcoming) { tone = "scheduled"; statusText = `Scheduled ${when}`; onCalendar = true; }
        else if (pending?.id === e.id) { tone = "scheduled"; statusText = `Waiting for your answer: did it happen? (${when})`; onCalendar = true; }
        else { tone = "done"; statusText = `Done ${when}`; }
      } else if (e.status === "due") {
        tone = "suggested"; onCalendar = true;
        statusText = `Suggested for ${at ? shortDate(at) : "a date to pick"}${at && todayIST(new Date(at)) < today ? " (overdue)" : ""}`;
      } else { tone = "done"; statusText = `Done ${at ? shortDate(at) : ""}`.trim(); }
      const detail = [e.happened && HAPPENED_WORD[e.happened], e.rating && RATING_WORD[e.rating]].filter(Boolean).join(" · ");
      return {
        event: e, label: stepLabel(e, events), tone, statusText, struck: tone === "superseded", onCalendar, detail,
        noteLine: e.note ? `Your note, ${shortDate(e.doneAt ?? e.createdAt)}: ${e.note}` : null,
        reason: e.status === "due" ? e.rule : null,
      };
    });
}

/** What can be done to a row. Every suggested step can change date or be set aside (R38). */
export function stepActions(row: Pick<TimelineRow, "tone">): ("change_date" | "not_now")[] {
  return row.tone === "suggested" ? ["change_date", "not_now"] : [];
}

/** The earliest suggested step that is still live. */
export function nextStep(events: readonly UiEvent[]): UiEvent | null {
  return events.filter((e) => e.status === "due" && e.kind !== "why").sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "") || a.id.localeCompare(b.id))[0] ?? null;
}

/** R42: a suggestion opens as a question. "Yes" is a record; "No" reveals the step. */
export function questionFor(e: UiEvent, events: readonly UiEvent[], name: string): { ask: string; yes: "reply" | "accepted"; yesLabel: string; noLabel: string } | null {
  if (e.status !== "due") return null;
  const fromMeeting = e.triggerId && events.find((x) => x.id === e.triggerId)?.kind === "meeting_done";
  if (fromMeeting) return null;
  if (e.kind === "withdraw") return { ask: `Did ${name} accept your invite?`, yes: "accepted", yesLabel: "Yes, record that they accepted", noLabel: "No" };
  if (e.kind === "second_person" || e.kind === "follow_up" || e.kind === "closed") return { ask: `Did ${name} reply?`, yes: "reply", yesLabel: "Yes, record the reply", noLabel: "No" };
  return null;
}

// ---- the contact's stage ----

const STAGE: Partial<Record<EventKind, ContactStatus>> = {
  invite_sent: "invited", accepted: "accepted", message_sent: "messaged", reply: "replied",
  meeting_booked: "meeting", meeting_done: "meeting", goal_reached: "outcome", closed: "outcome",
};
const RANK: ContactStatus[] = ["to_contact", "invited", "accepted", "messaged", "replied", "meeting", "outcome"];
/** The furthest stage among done steps that are not replaced, whatever order they were recorded in. The server does the same. */
export function deriveStatus(events: readonly Pick<UiEvent, "kind" | "status" | "doneAt">[]): ContactStatus {
  let status: ContactStatus = "to_contact";
  for (const e of events) {
    const s = e.status === "done" && e.doneAt ? STAGE[e.kind] : undefined;
    if (s && RANK.indexOf(s) > RANK.indexOf(status)) status = s;
  }
  return status;
}

// ---- records (R40) ----

export type RecordKind = "invite_sent" | "accepted" | "message_sent" | "reply" | "meeting_booked" | "meeting_done" | "goal_reached" | "closed";
export const RECORD_LABEL: Record<RecordKind, string> = {
  invite_sent: "Invite sent", accepted: "Accepted", message_sent: "Message sent", reply: "Reply received",
  meeting_booked: "Meeting booked", meeting_done: "Meeting done", goal_reached: "Goal reached", closed: "Close",
};
/** The records worth offering at this stage. A new contact gets only "Invite sent". Meeting done is answered on the meeting card. */
export function recordChoices(status: string, o: { hasEvents: boolean; pendingMeeting: boolean }): RecordKind[] {
  if (status === "to_contact" && !o.hasEvents) return ["invite_sent"];
  switch (status) {
    case "to_contact": return ["invite_sent", "accepted", "message_sent", "closed"];
    case "invited": return ["accepted", "message_sent", "closed"];
    case "accepted": return ["message_sent", "meeting_booked", "closed"];
    case "messaged": return ["reply", "meeting_booked", "closed"];
    case "replied": return ["meeting_booked", "goal_reached", "closed"];
    case "meeting": return o.pendingMeeting ? ["goal_reached", "closed"] : ["meeting_booked", "goal_reached", "closed"];
    default: return [];
  }
}

export function timelineAccess(lapsed: boolean): { canRecord: boolean; notice: string } {
  return lapsed ? { canRecord: false, notice: LAPSED_NOTE } : { canRecord: true, notice: "" };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (d: string) => DAY_RE.test(d) && !Number.isNaN(istToUTC(d, "00:00").getTime());
/** A step you have done can be dated today or earlier. */
export function doneDateProblem(day: string, today: string): string | null {
  if (!validDay(day)) return "Pick a date.";
  return day > today ? "A step you have done can be dated today or earlier." : null;
}
/** A suggested step can move to today or later. */
export function moveDateProblem(day: string, today: string): string | null {
  if (!validDay(day)) return "Pick a date.";
  return day < today ? "Pick today or a later date." : null;
}
export const noteCount = (note: string): string => `${note.length} / ${NOTE_MAX}`;
export const noteProblem = (note: string): string | null => (note.length > NOTE_MAX ? `Keep the note to ${NOTE_MAX} characters or fewer.` : null);

export function whyLine(c: { whyText: string | null; whySource: string | null }): { text: string; empty: boolean } {
  const t = (c.whyText ?? "").trim();
  return t ? { text: `Why: ${t}`, empty: false } : { text: "", empty: true };
}
export const whyProblem = (text: string): string | null => (text.length > WHY_MAX ? `Keep it to ${WHY_MAX} characters or fewer.` : null);

// ---- request bodies ----

/** A done record, dated by the day picked. Meeting booked takes a time as well and may be in the future. */
export function recordRequest(contactId: string, kind: RecordKind, day: string, opId: string, time?: string, today = todayIST()): { ok: true; req: TimelineRequest } | { ok: false; message: string } {
  if (kind === "meeting_booked") {
    if (!validDay(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time ?? "")) return { ok: false, message: "Pick the day and time of the meeting." };
    return { ok: true, req: { route: "timeline", contactId, body: { type: "insert", op_id: opId, contactId, kind, status: "done", meetingAt: istToUTC(day, time!).toISOString() } } };
  }
  const problem = doneDateProblem(day, today);
  if (problem) return { ok: false, message: problem };
  return { ok: true, req: { route: "timeline", contactId, body: { type: "insert", op_id: opId, contactId, kind, status: "done", doneAt: day } } };
}
export const completeRequest = (contactId: string, eventId: string, day?: string): TimelineRequest => ({ route: "timeline", contactId, body: { type: "update", eventId, patch: { done: true, ...(day ? { doneAt: day } : {}) } } });
export const dismissRequest = (contactId: string, eventId: string): TimelineRequest => ({ route: "timeline", contactId, body: { type: "supersede", eventId, reason: "dismissed" } });
export const undoRequest = (contactId: string, eventId: string): TimelineRequest => ({ route: "timeline", contactId, body: { type: "supersede", eventId, reason: "undone" } });
export const moveRequest = (contactId: string, eventId: string, day: string, time: string | undefined, opId: string): TimelineRequest => ({ route: "calendar", contactId, body: { op_id: opId, id: eventId, day, ...(time ? { time } : {}) } });
