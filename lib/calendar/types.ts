/**
 * One item shape for every source (calendar plan KTD1). Each owner keeps its own rules; the Calendar only shows items and
 * sends a move back to the owner (KD4). Pure types: the browser imports this file too.
 */
export type Owner = "plan" | "post" | "outreach";

/** Text is always shown, never colour alone (R5). `failed`, `overdue` and `check` are the Posts plan's statuses; no source returns them yet. */
export type FeedStatus = "draft" | "scheduled" | "due" | "done" | "replaced" | "failed" | "overdue" | "check";

export type FeedKind =
  | "post" | "comment" | "message" | "follow_up"
  | "invite" | "meeting" | "second_person" | "reschedule" | "thank_you" | "check_in" | "referral_ask" | "withdraw" | "close";

export type FeedItem = {
  /** Unique across owners: `plan:<Monday>:<slot>`, `outreach:<event id>`, `post:<id>`. */
  id: string;
  owner: Owner;
  kind: FeedKind;
  /** IST day, YYYY-MM-DD, and time HH:MM. */
  day: string;
  time: string;
  status: FeedStatus;
  /** The status as words: "Draft", "Reminder set", "Due", "Sent", "Replaced by 18 Nov". */
  statusText: string;
  /** What the chip says: "Proof of work", "Follow-up · Priya", "Pick someone to contact". */
  title: string;
  /** The goal this serves (R4). Null when none is known. */
  label: string | null;
  /** The rule or reason, when the owner gave one. */
  why: string | null;
  /** The owner's screen (R16): a hash route inside the app. */
  href: string;
  /** False for done and replaced items, and for post and outreach items the person cannot move (a free or lapsed account). */
  movable: boolean;
  /** Words for why it cannot move, shown instead of "Change date" (R14). */
  lockedReason?: string;
  /** The item that replaced this one, when the owner says. */
  replacedBy?: string;
  /** A paid screen that a free account sees as the paywall card when opened (R25). */
  gated: boolean;
  /** An outreach step that took a message slot's place (R9). */
  fills?: string;
  contactId?: string;
};

export type SourceState = "ok" | "unavailable" | "off";
export type SourceStatus = { plan: SourceState; outreach: SourceState; posts: SourceState; comments: SourceState };

export type Feed = { items: FeedItem[]; sources: SourceStatus; from: string; to: string; clamped: boolean };
