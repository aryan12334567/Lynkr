/**
 * What the calendar shows beside the plan: this week's progress and the streak. Finished weeks are frozen on the way
 * (plan-store `freezeWeek`), so the streak does not move when old items are edited or deleted later (KTD3, KTD8).
 */
import type { Db } from "../db";
import { todayIST } from "../ist";
import type { Plan } from "../plan";
import { listWeeks, freezeWeek, getProgress } from "./plan-store";
import { STREAK_WEEKS, streak, weekProgress, type Streak, type WeekCount } from "./progress";

export async function calendarSummary(db: Db, userId: string, week: string, plan: Plan | null, today: string = todayIST()): Promise<{ progress: WeekCount; streak: Streak }> {
  // Freeze finished weeks that have a plan and no frozen counts yet. Only the weeks the streak can show are looked at.
  const weeks = (await listWeeks(db, userId)).slice(0, STREAK_WEEKS + 2);
  for (const w of weeks) await freezeWeek(db, userId, w, today);
  const frozen = await getProgress(db, userId);
  const progress = plan ? weekProgress(plan.items) : { planned: 0, done: 0 };
  return { progress, streak: streak({ [week]: progress, ...frozen }, today) };
}
