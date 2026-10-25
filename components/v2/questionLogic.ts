import type { Bucket, FactConfidence, FactKind, StoryFact } from "../../lib/schemas";
import { FACT_KINDS } from "../../lib/schemas";
import { exampleFor as bankExampleFor, pick, type Chips, type Question, type Tag } from "../../lib/interview/bank";
import { isExampleText } from "../../lib/interview/engine";

/**
 * Pure helpers for the interview v2 question screen (Part 4), kept apart from the JSX so they can
 * be unit tested. They mirror the server's validateAnswer, which stays the final word.
 */

export const MAX_ANSWER = 1500;

/** Ctrl+Enter (Cmd+Enter on a Mac) saves the answer. */
export function isSaveShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
  return e.key === "Enter" && (e.ctrlKey || e.metaKey);
}

/** The example answer and stuck-ladder examples to show, fitted to the person's field when known (see the bank). */
export function exampleFor(q: Question, bucket: Bucket, field?: string | null): { example: string; examples: readonly string[] } {
  return bankExampleFor(q, bucket, field);
}

/** The chips this question shows on its main attempt; follow-ups are free text only. */
export function chipsFor(q: Question, bucket: Bucket, attempt: number): Chips | null {
  return attempt === 0 && q.chips ? pick(q.chips, bucket) : null;
}

/** The answer text the server expects: picked chips (in option order), then any typed text, joined by ", ". */
export function composeAnswer(chips: Chips | null, picked: readonly string[], text: string): string {
  const ordered = chips ? chips.options.filter((o) => picked.includes(o)) : [];
  return [...ordered, text.trim()].filter(Boolean).join(", ");
}

/** Toggle one chip: multi keeps a set, single replaces the pick. */
export function toggleChip(chips: Chips, picked: readonly string[], option: string): string[] {
  if (picked.includes(option)) return picked.filter((p) => p !== option);
  return chips.multi ? [...picked, option] : [option];
}

/** Whether Save is allowed, and if not, a short reason to show next to it (or "" when nothing to say yet). */
export function saveState(q: Question, bucket: Bucket, attempt: number, picked: readonly string[], text: string): { ok: boolean; hint: string } {
  const chips = chipsFor(q, bucket, attempt);
  const typed = text.trim();
  if (typed && isExampleText(q, bucket, typed)) return { ok: false, hint: "That's the example. Edit it so it's about you." };
  const answer = composeAnswer(chips, picked, text);
  if (answer.length > MAX_ANSWER) return { ok: false, hint: `Please keep it under ${MAX_ANSWER.toLocaleString("en-IN")} characters.` };
  if (chips && !chips.withText) return picked.length ? { ok: true, hint: "" } : { ok: false, hint: "" };
  return answer ? { ok: true, hint: "" } : { ok: false, hint: "" };
}

/** Which way-out buttons a question offers, by tag. Skip is for sensitive questions only. */
export function actionsFor(tag: Tag): { skip: boolean; notSure: boolean; later: boolean } {
  return { skip: tag === "sensitive", notSure: tag !== "enrichment", later: tag === "enrichment" };
}

/**
 * The stuck ladder, one press at a time: 1 shows the rephrase, 2 adds more examples,
 * 3 parks the question (or, for an enrichment question, moves it to Later).
 */
export type StuckLevel = 0 | 1 | 2;
export function stuckPress(level: StuckLevel): { level: StuckLevel; park: boolean } {
  return level < 2 ? { level: (level + 1) as StuckLevel, park: false } : { level, park: true };
}
export const STUCK_LABEL: Record<StuckLevel, string> = { 0: "I'm stuck", 1: "Still stuck? Show more examples", 2: "Still stuck? Come back to it later" };

/** Short labels for how solid a fact is. */
export function confidenceHints(c: FactConfidence | undefined): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (c.example) out.push("specific example");
  if (c.number === "measured") out.push("has a number");
  if (c.number === "estimate") out.push("estimate");
  if (c.iDid) out.push("your own work");
  return out;
}

/** Facts to show, grouped by kind in the standard order. Excluded facts are left out. */
export function groupFacts(facts: readonly StoryFact[]): { kind: FactKind; facts: StoryFact[] }[] {
  const shown = facts.filter((f) => f.reviewStatus !== "excluded");
  return FACT_KINDS.map((kind) => ({ kind, facts: shown.filter((f) => f.kind === kind) })).filter((g) => g.facts.length);
}
