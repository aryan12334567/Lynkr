import { todayIST, weekdayIndex } from "../ist";
import type { CalendarItem, CalendarKind, TodoItem } from "./calendar";
import { TODO_EMPTY } from "./calendar";

/** Pure logic for Today and the Monday to-do (U20). The components only fetch and draw; every decision is here so it can be tested. */

export const ALL_CAUGHT_UP = TODO_EMPTY;

/** The Monday to-do sits at the top of Today on Mondays (R45). IST, like the rest of the plan. */
export function isMonday(now: Date = new Date()): boolean {
  return weekdayIndex(todayIST(now)) === 0;
}

/**
 * Under outreach v2 the timeline's rules are the only follow-up rule (CO-2), so the weekly plan must not offer
 * `addFollowUp` for a sent outreach message. With v2 off it offers it exactly as before.
 */
export function offerPlanFollowUp(outreachV2: boolean | undefined, due: boolean, alreadyAdded: boolean): boolean {
  return !outreachV2 && due && !alreadyAdded;
}

/**
 * What Today lists from the calendar feed: items still due, whose day is today or earlier. A booked meeting counts
 * once it is an hour past (the same moment its card is owed, R41), so one later today or tomorrow stays out.
 * Oldest first, as the feed returns them.
 */
export function dueNow(items: readonly CalendarItem[], now: Date = new Date()): CalendarItem[] {
  const today = todayIST(now);
  const cutoff = now.getTime() - 60 * 60_000;
  return items
    .filter((i) => i.status === "due" && (i.kind === "meeting" ? new Date(i.at).getTime() < cutoff : todayIST(new Date(i.at)) <= today))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

/** Items without the ones answered in this session, so an answered item leaves the list without a reload. */
export function withoutAnswered<T extends { id: string }>(items: readonly T[], answered: ReadonlySet<string>): T[] {
  return items.filter((i) => !answered.has(i.id));
}

export const KIND_LABEL: Record<CalendarKind, string> = {
  invite: "Invite", message: "Message", follow_up: "Follow-up", second_person: "Second person", meeting: "Meeting",
  reschedule: "Reschedule", thank_you: "Thank-you", check_in: "Check-in", referral_ask: "Referral ask", withdraw: "Withdraw invite", close: "Close",
};

/** The kind of timeline event that records this step as done. */
const DONE_KIND: Record<Exclude<CalendarKind, "meeting">, string> = {
  invite: "invite_sent", message: "message_sent", follow_up: "follow_up", second_person: "second_person", reschedule: "reschedule",
  thank_you: "thank_you", check_in: "check_in", referral_ask: "referral_ask", withdraw: "withdraw", close: "closed",
};

/** "Did she reply?" and "Accepted?" steps (R42): their rule opens with the question, and a Yes is a record that ends the waiting. */
export function isQuestion(item: Pick<CalendarItem, "kind">): boolean {
  return item.kind === "second_person" || item.kind === "follow_up" || item.kind === "withdraw" || item.kind === "close";
}

/** The question to show for a step. The stored rule is the reason; the question is its first sentence. */
export function questionFor(item: Pick<CalendarItem, "kind" | "person" | "rule">): string {
  if (item.kind === "withdraw") return `Did ${item.person} accept?`;
  if (isQuestion(item)) return `Did ${item.person} reply?`;
  return "";
}

export type Answer = { id: string; label: string; tone?: "primary" | "quiet" };

/** The buttons for an item. "No" on a question reveals the step itself; it records nothing. */
export function answersFor(item: Pick<CalendarItem, "kind">, revealed = false): Answer[] {
  if (item.kind === "meeting") {
    return [
      { id: "met_good", label: "Yes, useful", tone: "primary" }, { id: "met_ok", label: "Yes, it was okay" }, { id: "met_bad", label: "Yes, not useful" },
      { id: "no_show", label: "No-show" }, { id: "moved", label: "It moved" },
    ];
  }
  if (isQuestion(item) && !revealed) {
    return [{ id: "yes", label: "Yes", tone: "primary" }, { id: "no", label: "Not yet" }];
  }
  return [{ id: "done", label: "Done", tone: "primary" }, { id: "not_now", label: "Not now", tone: "quiet" }];
}

/** The body for POST /api/outreach/timeline, or null for an answer that only changes what is shown ("Not yet"). */
export type TimelineBody =
  | { type: "insert"; op_id: string; contactId: string; kind: string; happened?: "yes" | "no_show" | "moved"; rating?: "good" | "neutral" | "bad"; triggerId?: string }
  | { type: "supersede"; eventId: string; reason: "dismissed" };

/**
 * The same item and answer always give the same `op_id`, so tapping again, or retrying after a failure, replays the
 * first record and never adds a second.
 */
export function opId(itemId: string, answer: string): string {
  return `today:${itemId}:${answer}`.slice(0, 100);
}

export function bodyFor(item: Pick<CalendarItem, "id" | "kind" | "contactId">, answer: string): TimelineBody | null {
  if (answer === "no") return null;
  if (answer === "not_now") return { type: "supersede", eventId: item.id, reason: "dismissed" };
  const base = { type: "insert" as const, op_id: opId(item.id, answer), contactId: item.contactId };
  if (item.kind === "meeting") {
    const by: Record<string, Partial<TimelineBody>> = {
      met_good: { happened: "yes", rating: "good" }, met_ok: { happened: "yes", rating: "neutral" }, met_bad: { happened: "yes", rating: "bad" },
      no_show: { happened: "no_show" }, moved: { happened: "moved" },
    };
    if (!by[answer]) return null;
    return { ...base, kind: "meeting_done", triggerId: item.id, ...by[answer] } as TimelineBody;
  }
  if (answer === "yes") return { ...base, kind: item.kind === "withdraw" ? "accepted" : "reply" };
  if (answer === "done") return { ...base, kind: DONE_KIND[item.kind] };
  return null;
}

export type Groupable = Pick<TodoItem, "group" | "overdue">;
export const GROUP_HEADING: Record<TodoItem["group"], string> = {
  meeting: "Meetings to answer", question: "Did they reply or accept?", step: "Steps due",
};

/** The error to show for a failed record, in plain words. */
export function recordError(status: number): string {
  if (status === 402) return "Recording needs an active subscription.";
  if (status === 401) return "Please sign in again.";
  return "Could not save that. Tap again to retry.";
}
