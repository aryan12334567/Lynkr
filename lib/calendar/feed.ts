/**
 * The Calendar feed (calendar plan U3, KTD2): one list for any window, made from the owners' rows. Pure, so the route and
 * the tests call the same function. A source that failed is named in `sources` and contributes nothing, so a failed
 * source never looks like an empty week.
 */
import { addDays } from "../ist";
import type { OutreachStepRow } from "./load";
import type { Plan } from "../plan";
import { weekProgress, type WeekCount } from "./progress";
import { fillMessageSlots, markCommentsDone, outreachFeedItems, planItems, type Access } from "./sources";
import type { FeedItem, SourceStatus } from "./types";

export type WeekInput = { plan: Plan; why: string | null; label: string | null };

export type FeedInput = {
  weeks: readonly WeekInput[];
  /** Outreach steps, or null when that source failed or is off. */
  steps: readonly OutreachStepRow[] | null;
  /** Comments marked Posted in the current week, or null when the Commenter is off or failed. */
  posted: number | null;
  /** The Monday of the current week: only that week's comment slots are marked from the posted count. */
  currentWeek: string;
  access: Access;
  /** First and last IST day wanted, inclusive. */
  from: string;
  to: string;
  sources: SourceStatus;
};

export function buildFeed(input: FeedInput): { items: FeedItem[]; sources: SourceStatus } {
  const steps = input.steps ? outreachFeedItems(input.steps, input.access) : [];
  const weekDays = new Set<string>();
  let items: FeedItem[] = [];
  for (const w of input.weeks) {
    const own = planItems(w.plan, w.why, w.label);
    const days = Array.from({ length: 7 }, (_, i) => addDays(w.plan.weekStart, i));
    days.forEach((d) => weekDays.add(d));
    const stepsThisWeek = steps.filter((s) => days.includes(s.day));
    let week = fillMessageSlots(own, stepsThisWeek);
    if (w.plan.weekStart === input.currentWeek && input.posted !== null) week = markCommentsDone(week, input.posted);
    items.push(...week);
  }
  // Outreach steps in a week that has no plan yet still show: they are real, dated work.
  items.push(...steps.filter((s) => !weekDays.has(s.day)));
  items = items.filter((i) => i.day >= input.from && i.day <= input.to).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time) || a.id.localeCompare(b.id));
  return { items, sources: input.sources };
}

/** R18 over the feed: planned is every item that was not replaced; a slot an outreach step filled counts once, as that step. */
export function feedProgress(items: readonly FeedItem[], weekStart: string): WeekCount {
  const last = addDays(weekStart, 6);
  return weekProgress(items.filter((i) => i.day >= weekStart && i.day <= last).map((i) => ({ status: i.status, superseded: i.status === "replaced" })));
}
