// Goal chips (R1, R36). This is the one place the screens read the goal catalog from.
import type { Relationship } from "../checker";
import { GOALS, defaultIntent, preselectGoals, recordMeetsGoal, type OutreachGoal } from "./goals";

export const GOAL_CHIPS: readonly { id: OutreachGoal; label: string; description: string }[] = GOALS.map((g) => ({ id: g.id, label: g.label, description: g.description }));
export const goalLabel = (id: string): string => GOALS.find((g) => g.id === id)?.label ?? (id === "internship" ? "Find a job" : id);
export const goalSuccess = (id: string): string => GOALS.find((g) => g.id === id)?.success ?? "";

/** Saved goals win. Otherwise the interview's "what do you want" answers are pre-selected, so one tap confirms. */
export function initialGoals(saved: readonly OutreachGoal[], interviewWants: readonly string[]): { selected: OutreachGoal[]; source: "saved" | "interview" | "none" } {
  if (saved.length) return { selected: [...saved], source: "saved" };
  const picked = preselectGoals(interviewWants);
  return { selected: picked, source: picked.length ? "interview" : "none" };
}
export const toggleGoal = (selected: readonly OutreachGoal[], id: OutreachGoal): OutreachGoal[] => (selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id]);
export const canSave = (selected: readonly OutreachGoal[]): boolean => selected.length > 0;
/** The goal a new person starts with: the first one chosen. */
export const contactGoal = (selected: readonly OutreachGoal[]): OutreachGoal => selected[0] ?? "network";

/** Target companies the user confirmed in the Story Vault, for the Finder. */
export function targetCompanies(facts: readonly { kind: string; text: string; reviewStatus: string }[]): string[] {
  return [...new Set(facts.filter((f) => f.kind === "target_company" && f.reviewStatus === "confirmed").map((f) => f.text.trim().slice(0, 80)).filter(Boolean))].slice(0, 20);
}

/** Whether a recorded reply meets this goal, so "Goal reached" starts ticked (R40). */
export const replyMeetsGoal = (goal: string): boolean => recordMeetsGoal(goal, { kind: "reply" });

/** The intent a new person starts with, from the goal and how well they know you (R4). */
export const startIntent = (goal: OutreachGoal, relationship: Relationship) => defaultIntent(goal, relationship);
export const bridgeFor = (relationship: Relationship): "knows_me" | "alumni" | "none" => (relationship === "knows_me" ? "knows_me" : relationship === "alumni" ? "alumni" : "none");
