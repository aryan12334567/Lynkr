import { buildIcs, googleCalendarUrl, type CalEvent } from "../ics";

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
