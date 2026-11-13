/**
 * The adapters (calendar plan U3, KTD1, KTD2): each owner's rows become FeedItems. Pure, so the browser tests and the
 * route share them. Nothing here reads a database or sends anything.
 */
import { todayIST } from "../ist";
import type { CalendarItem as OutreachStep } from "../outreach/calendar";
import { TAG_LABEL, type Plan, type PlanItem } from "../plan";
import type { FeedItem, FeedKind, FeedStatus } from "./types";

export const PICK_SOMEONE = "Pick someone to contact";

const istTime = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(11, 16);
const SHORT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
export const shortDay = (day: string) => SHORT.format(new Date(`${day}T00:00:00Z`));

// ---- plan slots (owner: plan) ----

const DONE_TEXT: Record<PlanItem["kind"], string> = { post: "Posted", comment: "Posted", message: "Sent", follow_up: "Sent" };
const SLOT_HREF: Record<PlanItem["kind"], string> = { post: "#app/posts", comment: "#app/posts", message: "#app/outreach", follow_up: "#app/outreach" };

/** The id a plan slot has in the feed. The Monday keeps slot ids (`post-0`) unique across weeks. */
export const planFeedId = (weekStart: string, slotId: string) => `plan:${weekStart}:${slotId}`;
export function parsePlanFeedId(id: string): { week: string; slot: string } | null {
  const m = /^plan:(\d{4}-\d{2}-\d{2}):([\w-]{1,80})$/.exec(id);
  return m ? { week: m[1], slot: m[2] } : null;
}

/** One week's plan slots. Posts and comment slots are paid screens when opened; message slots open Outreach, also paid (R25). */
export function planItems(plan: Plan, why: string | null, label: string | null): FeedItem[] {
  return plan.items.map((it) => {
    const done = it.status === "done";
    const status: FeedStatus = done ? "done" : it.status === "scheduled" ? "scheduled" : "draft";
    const statusText = done ? DONE_TEXT[it.kind] : it.status === "scheduled" ? "Reminder set" : "Draft";
    return {
      id: planFeedId(plan.weekStart, it.id),
      owner: "plan",
      kind: it.kind as FeedKind,
      day: it.day,
      time: it.time,
      status,
      statusText,
      title: it.kind === "message" ? PICK_SOMEONE : TAG_LABEL[it.tag],
      label,
      why,
      href: SLOT_HREF[it.kind],
      movable: !done,
      ...(done ? { lockedReason: "Already done" } : {}),
      gated: true,
    };
  });
}

// ---- outreach steps (owner: outreach) ----

const STEP_TITLE: Record<string, string> = {
  invite: "Invite", message: "Message", follow_up: "Follow-up", second_person: "Second person", meeting: "Meeting",
  reschedule: "Reschedule", thank_you: "Thank-you", check_in: "Check-in", referral_ask: "Referral ask", withdraw: "Withdraw", close: "Close",
};
const STEP_DONE: Record<string, string> = { meeting: "Happened", close: "Closed", withdraw: "Withdrawn" };

/** The paid-gate decision for outreach and post items (R25, KTD1): only an active subscription can move or open them. */
export type Access = { paid: boolean };

export function outreachFeedItems(steps: readonly OutreachStep[], access: Access): FeedItem[] {
  return steps.map((s) => {
    const replaced = s.status === "superseded";
    const done = s.status === "done";
    const status: FeedStatus = replaced ? "replaced" : done ? "done" : "due";
    const day = todayIST(new Date(s.at));
    const movable = access.paid && !done && !replaced;
    return {
      id: `outreach:${s.id}`,
      owner: "outreach" as const,
      kind: s.kind as FeedKind,
      day,
      time: istTime(s.at),
      status,
      statusText: replaced ? "Replaced" : done ? STEP_DONE[s.kind] ?? "Sent" : "Due",
      title: `${STEP_TITLE[s.kind] ?? "Step"} · ${s.person}`,
      label: s.goal || null,
      why: s.rule,
      href: "#app/outreach",
      movable,
      ...(!movable ? { lockedReason: replaced ? "Replaced" : done ? "Already done" : "Needs a subscription" } : {}),
      gated: true,
      contactId: s.contactId,
    };
  });
}

/**
 * R9: message slots are filled from Outreach first. On a day, the due or done outreach steps (a meeting never fills a
 * slot) take that day's message slots in time order. A slot with no step reads "Pick someone to contact". Steps beyond the
 * slots stay as extra items beside them. A step that fills a slot replaces the slot, so it counts once (R18).
 */
export function fillMessageSlots(plan: readonly FeedItem[], steps: readonly FeedItem[]): FeedItem[] {
  const byTime = (a: FeedItem, b: FeedItem) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id);
  const fillers = steps.filter((s) => s.kind !== "meeting" && s.status !== "replaced").sort(byTime);
  const used = new Set<string>();
  const out: FeedItem[] = [];
  const slots = plan.filter((p) => p.kind === "message");
  for (const slot of [...slots].sort(byTime)) {
    const step = fillers.find((s) => s.day === slot.day && !used.has(s.id));
    if (!step) { out.push(slot); continue; }
    used.add(step.id);
    out.push({ ...step, fills: slot.id });
  }
  for (const p of plan) if (p.kind !== "message") out.push(p);
  for (const s of steps) if (!used.has(s.id)) out.push(s);
  return out.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time) || a.id.localeCompare(b.id));
}

// ---- comments (R8) ----

/** The week's comment slots are marked done, in date order, by the number of comments the person marked Posted that week. */
export function markCommentsDone(items: readonly FeedItem[], posted: number): FeedItem[] {
  const slots = items.filter((i) => i.owner === "plan" && i.kind === "comment").sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
  const have = slots.filter((s) => s.status === "done").length;
  const need = Math.min(Math.max(0, Math.floor(posted)), slots.length) - have;
  if (need <= 0) return [...items];
  const mark = new Set(slots.filter((s) => s.status !== "done").slice(0, need).map((s) => s.id));
  return items.map((i) => (mark.has(i.id) ? { ...i, status: "done" as const, statusText: "Posted", movable: false, lockedReason: "Already done" } : i));
}
