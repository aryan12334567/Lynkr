/**
 * Database side of the Outreach goals (build plan U2). Kept apart from ./goals so that file has no database import
 * and can be used in client components.
 */
import { getBrief, saveBrief, saveFacts, type Db } from "../db";
import { goalDetailFact, isGoal, type GoalDetailAnswer, type OutreachGoal } from "./goals";

/** Saved goals; an empty list when none or when the stored value is not valid. */
export async function readOutreachGoals(db: Db, userId: string): Promise<OutreachGoal[]> {
 const brief = await getBrief<{ outreach?: { goals?: unknown } }>(db, userId);
 const goals = brief?.data?.outreach?.goals;
 return Array.isArray(goals) ? goals.filter(isGoal) : [];
}

/**
 * Saves goals in context_brief.data.outreach (a new brief version only when the goals change; every other brief
 * field is kept as it was) and each answer as a confirmed goal_detail fact. Validates everything before writing.
 */
export async function saveOutreachGoals(db: Db, userId: string, goals: readonly OutreachGoal[], details: readonly GoalDetailAnswer[] = []): Promise<{ goals: OutreachGoal[]; version: number; detailsSaved: number }> {
 if (!goals.every(isGoal)) throw new Error("Choose valid goals.");
 const unique = [...new Set(goals)];
 const facts = details.map(d => {
  if (!isGoal(d.goal) || !unique.includes(d.goal)) throw new Error("Answer questions only for goals you chose.");
  return goalDetailFact(d.goal, d.key, d.answer);
 });
 const brief = await getBrief(db, userId);
 const data = (brief?.data ?? {}) as Record<string, unknown>;
 const old = data.outreach && typeof data.outreach === "object" ? data.outreach : {};
 const version = await saveBrief(db, userId, { ...data, outreach: { ...old, goals: unique } });
 const saved = facts.length ? (await saveFacts(db, userId, facts)).saved : 0;
 return { goals: unique, version, detailsSaved: saved };
}
