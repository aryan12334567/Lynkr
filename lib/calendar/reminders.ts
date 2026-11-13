/**
 * Reminders for every owner's items (calendar plan U9, R20). Pure. The week's .ics has one event per open item; a post
 * that publishes itself is labelled so, never as a "reminder"; nothing here adds an attendee or sends anything; an in-tab
 * reminder fires only for an item that is due and has not been shown yet.
 */
import { googleCalendarUrl, type CalEvent } from "../ics";
import { istToUTC } from "../ist";
import type { FeedItem } from "./types";

const OPEN: readonly FeedItem["status"][] = ["draft", "scheduled", "due"];
export const isOpen = (i: FeedItem): boolean => OPEN.includes(i.status);

/** An auto-published post (owner post, scheduled) publishes itself; everything else is a reminder to act yourself. */
export const publishesItself = (i: FeedItem): boolean => i.owner === "post" && i.status === "scheduled";

export function eventFor(i: FeedItem): CalEvent {
  const own = publishesItself(i);
  return {
    uid: i.id.replace(/[^\w.:-]/g, "-"),
    title: own ? `Lynkr: ${i.title} publishes itself at ${i.time}` : `Lynkr reminder: ${i.title}`,
    description: own
      ? "Lynkr publishes this post itself at the time shown. Open Lynkr to change or stop it."
      : "You post or send this yourself. Lynkr never posts or sends for you.",
    day: i.day,
    time: i.time,
  };
}

/** One event per open item of every owner, in time order. Done and replaced items are left out. */
export function weekEvents(items: readonly FeedItem[]): CalEvent[] {
  return items.filter(isOpen).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time) || a.id.localeCompare(b.id)).map(eventFor);
}

/** The Google link for one item. No attendee is ever added: the feed holds none, and a guest would be invited by Google. */
export const googleUrlFor = (i: FeedItem): string => googleCalendarUrl(eventFor(i));

/** An item that came due longer ago than this is not a reminder any more: turning reminders on must not fire last week's. */
export const REMINDER_WINDOW_MS = 24 * 3600_000;

/** In-tab reminders: items that are open, whose time arrived within the last day, and that have not been shown. */
export function dueReminders(items: readonly FeedItem[], nowMs: number, shown: ReadonlySet<string>): FeedItem[] {
  return items.filter((i) => {
    if (!isOpen(i) || i.status === "draft" || shown.has(i.id)) return false;
    const at = istToUTC(i.day, i.time).getTime();
    return at <= nowMs && at > nowMs - REMINDER_WINDOW_MS;
  });
}
