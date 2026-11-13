/**
 * The feed for one signed-in person (calendar plan U3, KTD2, KTD3). Server only. Reads each owner through its own library
 * function; one source that throws is reported in `sources` and the others still come back.
 */
import { getBrief, type Db } from "../db";
import { countPostedSince } from "../comment/log";
import { addDays, istToUTC, mondayOf, todayIST } from "../ist";
import { clampWindow } from "../outreach/calendar";
import { FAMILY_LABEL, goalFamily, planForPerson, whyThisWeek, type MixInput, type Plan } from "../plan";
import type { ProfileInput } from "../schemas";
import { buildFeed, type WeekInput } from "./feed";
import { loadOutreachSteps, type OutreachStepRow } from "./load";
import { getWeek, importWeekOnce } from "./plan-store";
import type { Feed, SourceState } from "./types";

export type Switches = { outreach: boolean; commenter: boolean; posts: boolean };
export type FeedOptions = { now?: Date; from?: string; to?: string; paid: boolean; switches: Switches; /** Make a missing current or next week from the mix rules. Off by default: the browser's own plan is moved up first (AE5). */ createWeeks?: boolean };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** What the mix rules read, from the saved brief. No brief means the standard week (R10). */
export async function mixInputFor(db: Db, userId: string): Promise<MixInput> {
  const brief = await getBrief<Partial<ProfileInput> & { outreach?: { goals?: unknown } }>(db, userId);
  const d = brief?.data;
  const goals = Array.isArray(d?.outreach?.goals) ? (d!.outreach!.goals as unknown[]).filter((g): g is string => typeof g === "string") : [];
  return { bucket: d?.bucket ?? null, wants: d?.goals ?? [], outreachGoals: goals, weeklyTime: d?.weeklyTime ?? null };
}

/** The Mondays whose weeks touch the days `from` to `to`. */
function mondaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = mondayOf(from); m <= to; m = addDays(m, 7)) out.push(m);
  return out;
}

export async function calendarFeed(db: Db, userId: string, opt: FeedOptions): Promise<Feed> {
  const now = opt.now ?? new Date();
  const today = todayIST(now);
  const wantFrom = opt.from && DAY.test(opt.from) ? istToUTC(opt.from, "00:00") : undefined;
  const wantTo = opt.to && DAY.test(opt.to) ? istToUTC(addDays(opt.to, 1), "00:00") : undefined;
  const win = clampWindow(now, wantFrom, wantTo);
  const from = todayIST(win.from);
  const to = addDays(todayIST(win.to), -1);
  const sources: Feed["sources"] = { plan: "ok", outreach: opt.switches.outreach ? "ok" : "off", posts: opt.switches.posts ? "unavailable" : "off", comments: opt.switches.commenter ? "ok" : "off" };

  const mix = await mixInputFor(db, userId).catch(() => ({}) as MixInput);
  const family = goalFamily(mix);
  const label = family ? FAMILY_LABEL[family] : null;
  const thisWeek = mondayOf(today);

  // Plan weeks. A missing current or next week is made from the mix rules and stored once (KTD3); other weeks are only read.
  const weeks: WeekInput[] = [];
  try {
    for (const monday of mondaysBetween(from, to)) {
      let plan: Plan | null = await getWeek(db, userId, monday);
      if (!plan && opt.createWeeks && (monday === thisWeek || monday === addDays(thisWeek, 7))) {
        plan = (await importWeekOnce(db, userId, monday, planForPerson(monday, mix))).plan;
      }
      if (plan) weeks.push({ plan, label, why: whyThisWeek(plan.counts, mix, plan.changedByUser === true) });
    }
  } catch {
    sources.plan = "unavailable";
  }

  let steps: OutreachStepRow[] | null = null;
  if (opt.switches.outreach) {
    try { steps = await loadOutreachSteps(db, userId, win.from, win.to); } catch { sources.outreach = "unavailable"; }
  }

  let posted: number | null = null;
  if (opt.switches.commenter) {
    try { posted = await countPostedSince(db, userId, istToUTC(thisWeek, "00:00")); } catch { sources.comments = "unavailable" as SourceState; }
  }

  const feed = buildFeed({ weeks, steps, posted, currentWeek: thisWeek, access: { paid: opt.paid }, from, to, sources });
  return { ...feed, from, to, clamped: win.clamped };
}
