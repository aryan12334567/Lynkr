import type { Brief } from "../../lib/interview/engine";
import { DOMAIN_LABEL } from "../../lib/roles";
import { OUTREACH_ONLY_KINDS, WANT_LABEL, WEEKLY_TIME_LABEL, type FactKind, type FactRef, type ProfileInput, type StoryFact } from "../../lib/schemas";

/**
 * Pure helpers for the read-back (Part 5): which section each line of the summary goes in,
 * fixing or removing a fact, and the request the first-win draft sends.
 */
export const READBACK_SECTIONS = ["who", "want", "wins", "people", "constraints", "out"] as const;
export type ReadBackSection = (typeof READBACK_SECTIONS)[number];

export const SECTION_TITLE: Record<ReadBackSection, string> = {
  who: "Who you are",
  want: "What you want",
  wins: "Your wins",
  people: "Who to meet",
  constraints: "Constraints",
  out: "Out of scope",
};

/** What to say when a section has nothing in it yet. */
export const SECTION_EMPTY: Record<ReadBackSection, string> = {
  who: "Nothing yet about your current role. Drafts will leave a blank for it.",
  want: "No goal yet. Drafts will be general until you add one.",
  wins: "No example of your work yet. Drafts will leave blanks where proof would go.",
  people: "No one to meet yet. Connect can suggest kinds of people later.",
  constraints: "No must-haves or limits. Add any if they matter.",
  out: "Nothing left out. Remove any line above to keep it out of every draft.",
};

/** Kinds that only go into private outreach, never a headline, About or post (the schema's list, so the label and the prompts agree). */
export const PRIVATE_KINDS: readonly FactKind[] = OUTREACH_ONLY_KINDS;

export const isPrivateKind = (k: FactKind): boolean => PRIVATE_KINDS.includes(k);

const KIND_SECTION: Record<FactKind, ReadBackSection> = {
  project: "wins",
  contribution: "wins",
  challenge: "wins",
  evidence: "wins",
  learning: "wins",
  opinion: "wins",
  goal: "want",
  target: "people",
  target_company: "people",
  warm_path: "people",
  offer: "people",
  must_have: "constraints",
  constraint: "constraints",
};

/** The section a fact belongs in. Removed facts are out of scope; answers about now describe who you are. */
export function sectionOf(f: StoryFact): ReadBackSection {
  if (f.reviewStatus === "excluded") return "out";
  if (f.sourceQid?.startsWith("A")) return "who";
  return KIND_SECTION[f.kind];
}

export type BriefLine = { section: ReadBackSection; label: string; text: string };

/** Context lines from the structured answers, shown alongside the facts. Skips anything a fact already says. */
export function briefLines(brief: Brief, facts: StoryFact[]): BriefLine[] {
  const live = facts.filter((f) => f.reviewStatus !== "excluded");
  const has = (k: FactKind) => live.some((f) => f.kind === k);
  const out: BriefLine[] = [];
  const add = (section: ReadBackSection, label: string, text: string) => {
    const t = text.trim();
    if (t) out.push({ section, label, text: t });
  };
  add("who", "Now", brief.currentRole);
  if (brief.field !== "not_sure" && brief.field !== "other") add("who", "Field", DOMAIN_LABEL[brief.field]);
  add("want", "Goals", brief.goals.map((g) => WANT_LABEL[g]).join(", "));
  if (!has("goal")) add("want", "Roles", brief.targetRoles);
  if (!has("target_company")) add("people", "Companies", brief.targetCompanies);
  if (!has("must_have")) add("constraints", "Must-haves", brief.mustHaves);
  if (brief.privateSearch) add("constraints", "Search", "Private: nothing public says you're looking");
  add("constraints", "Time each week", WEEKLY_TIME_LABEL[brief.weeklyTime]);
  return out;
}

/** Facts grouped by section, in the order they were collected. */
export function factsBySection(facts: StoryFact[]): Record<ReadBackSection, StoryFact[]> {
  const g = Object.fromEntries(READBACK_SECTIONS.map((s) => [s, [] as StoryFact[]])) as Record<ReadBackSection, StoryFact[]>;
  for (const f of facts) g[sectionOf(f)].push(f);
  return g;
}

/** Replace a fact's wording. Empty text is refused (returns the list unchanged); use remove instead. */
export function fixFact(facts: StoryFact[], id: string, text: string, now = new Date().toISOString()): StoryFact[] {
  const t = text.replace(/\s+/g, " ").trim().slice(0, 400);
  if (!t) return facts;
  return facts.map((f) => (f.id === id ? { ...f, text: t, updatedAt: now } : f));
}

/** Keep a fact out of every draft. */
export function removeFact(facts: StoryFact[], id: string, now = new Date().toISOString()): StoryFact[] {
  return facts.map((f) => (f.id === id ? { ...f, reviewStatus: "excluded", useInDrafts: false, updatedAt: now } : f));
}

/** Undo a removal: back to a candidate, which "Looks right" confirms. */
export function restoreFact(facts: StoryFact[], id: string, now = new Date().toISOString()): StoryFact[] {
  return facts.map((f) => (f.id === id ? { ...f, reviewStatus: "candidate", useInDrafts: false, updatedAt: now } : f));
}

/** The facts a draft may use: confirmed and switched on, at most 20, in the request's shape. */
export function draftFacts(facts: StoryFact[]): FactRef[] {
  return facts
    .filter((f) => f.reviewStatus === "confirmed" && f.useInDrafts && f.text.trim())
    .slice(0, 20)
    .map((f) => ({ id: f.id, kind: f.kind, text: f.text.trim().slice(0, 400) }));
}

export function firstWinBody(profile: ProfileInput, facts: StoryFact[]): { profile: ProfileInput; facts: FactRef[] } {
  return { profile, facts: draftFacts(facts) };
}

/** The facts a draft points to, in order, ignoring ids that aren't in the vault. */
export function usedFacts(refs: string[], facts: StoryFact[]): StoryFact[] {
  return refs.map((id) => facts.find((f) => f.id === id)).filter((f): f is StoryFact => !!f);
}
