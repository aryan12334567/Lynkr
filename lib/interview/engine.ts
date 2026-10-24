import { suggestDomain, type Domain } from "../roles";
import { WANTS, type Bucket, type FactConfidence, type FactKind, type Want, type WeeklyTime } from "../schemas";
import { BANK, FIELD_CHIPS, pick, questionsFor, TIME_CHIPS, WANT_CHIPS, type Question, type Trigger } from "./bank";

/**
 * Interview v2 engine (build plan Part 3). Pure functions over the list of saved answers:
 * the server decides the next question from the bank; a model, when configured, only
 * reflects, judges vagueness and phrases follow-ups. Saving the same answer twice changes nothing.
 */

export type AnswerStatus = "answered" | "skipped" | "parked" | "later";

export type Answer = {
  qid: string;
  /** 0 is the main question; 1 and 2 are follow-ups. */
  attempt: number;
  text: string;
  status: AnswerStatus;
  /** Which trigger asked this follow-up. */
  trigger?: Trigger;
  /** 1 for the first "Not sure yet", 2 when it's parked again on the revisit. */
  round?: number;
  /** The model's judgement on this answer, when one is configured. */
  vague?: boolean;
  should?: boolean;
  /** A follow-up the model phrased for a vague answer. */
  followUpText?: string;
  at?: string;
};

export type AskStep = {
  type: "ask";
  qid: string;
  attempt: number;
  trigger?: Trigger;
  prompt: string;
  /** A parked question coming back once at the end. */
  revisit: boolean;
};
export type DoneStep = { type: "done"; later: string[]; unresolved: string[] };
export type NextStep = AskStep | DoneStep;

export const MAX_FOLLOW_UPS = 2;
/** After this much answering time, unasked enrichment questions go to the "Later" list. */
export const ENRICHMENT_BUDGET_SECS = 11 * 60;

// ---- answer heuristics (deterministic; the model can override "vague" and "should") ----

const GENERIC =
  /\b(team player|hard ?working|hard worker|passionate|go-getter|quick learner|good communicat\w*|detail[- ]oriented|self[- ]motivated|something better|better (job|role|company|opportunit\w*)|good (company|package|opportunit\w*)|any (role|job|company)|anything|not sure|don'?t know|whatever)\b/i;

/** Too short, or only stock phrases, to write anything specific from. */
export function looksVague(text: string): boolean {
  const t = text.trim();
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;
  return GENERIC.test(t) && words.length < 14;
}

/** "We did it" with no "I" anywhere: ask which part was theirs. */
export function saysWeNotI(text: string): boolean {
  return /\b(we|our|team)\b/i.test(text) && !/\b(I|my|myself|me)\b/.test(text);
}

const NUMBER_WORDS = /\b(one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|lakh|crore|half|double|twice|triple)\b/i;

export function hasNumber(text: string): boolean {
  return /\d/.test(text) || NUMBER_WORDS.test(text);
}

export function notMeasured(text: string): boolean {
  return /\b(not measured|didn'?t measure|no (number|data|metric)s?|can'?t (say|measure)|don'?t know)\b/i.test(text);
}

/** A goal that sounds like what's expected rather than what's wanted (B4 trigger). */
export function soundsLikeShould(text: string): boolean {
  return /\b(should|supposed to|expected|my (parents|family)|everyone says|people say|good package|stable|safe (job|option)|prestig\w*|government job|i guess|probably)\b/i.test(text);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** True when the answer is only chip picks, which are choices, not typed text. */
function onlyChips(q: Question, bucket: Bucket, text: string): boolean {
  const chips = q.chips ? pick(q.chips, bucket) : null;
  if (!chips) return false;
  // Options can contain commas ("Yes, it's public"), so a whole-answer match comes first.
  return chips.options.includes(text.trim()) || text.split(/\s*,\s*/).every((p) => chips.options.includes(p.trim()));
}

/** True when the text is one of the question's example answers, unedited. Chip picks never count. */
export function isExampleText(q: Question, bucket: Bucket, text: string): boolean {
  const t = norm(text);
  if (!t || onlyChips(q, bucket, text)) return false;
  return [pick(q.example, bucket), ...pick(q.examples, bucket)].some((e) => norm(e) === t);
}

// ---- order, follow-ups and the stop rule ----

function chainOf(answers: Answer[], qid: string): Answer[] {
  return answers.filter((a) => a.qid === qid).sort((a, b) => a.attempt - b.attempt);
}

const GOAL_QIDS = ["B1", "B2", "B3"];

/** B4 is asked only when a goal answer sounds like a "should". */
export function shouldProbeTriggered(answers: Answer[]): boolean {
  return answers.some((a) => GOAL_QIDS.includes(a.qid) && a.status === "answered" && (a.should ?? soundsLikeShould(a.text)));
}

/** The questions that apply: the bucket's bank, with B4 only when triggered. */
export function activeQuestions(bucket: Bucket, answers: Answer[]): Question[] {
  const probe = shouldProbeTriggered(answers);
  return questionsFor(bucket).filter((q) => !q.triggeredBy || probe);
}

/** The follow-up still owed on a question, if any (core questions only, at most two). */
export function followUpFor(q: Question, chain: Answer[]): { trigger: Trigger; text: string } | null {
  if (q.tag !== "core" || !q.followUps.length) return null;
  const main = chain.find((a) => a.attempt === 0);
  if (!main || main.status !== "answered") return null;
  const asked = chain.filter((a) => a.attempt > 0);
  if (asked.length >= MAX_FOLLOW_UPS) return null;
  const last = chain[chain.length - 1];
  // A follow-up that was parked or skipped ends the ladder for this question.
  if (last.status !== "answered") return null;
  const all = chain.filter((a) => a.status === "answered").map((a) => a.text).join(" ");
  const used = new Set(asked.map((a) => a.trigger));
  for (const f of q.followUps) {
    if (used.has(f.when)) continue;
    if (f.when === "we" && saysWeNotI(main.text)) return { trigger: "we", text: f.text };
    if (f.when === "no_number" && !hasNumber(all) && !notMeasured(all)) return { trigger: "no_number", text: f.text };
    if (f.when === "vague" && (last.vague ?? looksVague(last.text))) return { trigger: "vague", text: last.followUpText?.trim() || f.text };
  }
  return null;
}

/**
 * The next step. Core and sensitive questions in bank order, with their follow-ups;
 * enrichment questions while there's time; then each parked core or sensitive question once more.
 * Done when every core question is answered (or parked twice).
 */
export function nextStep(bucket: Bucket, answers: Answer[], opts: { elapsedSecs?: number } = {}): NextStep {
  const qs = activeQuestions(bucket, answers);
  const main = (qid: string) => answers.find((a) => a.qid === qid && a.attempt === 0);
  const overBudget = (opts.elapsedSecs ?? 0) > ENRICHMENT_BUDGET_SECS;
  for (const q of qs) {
    const a = main(q.id);
    if (!a) {
      if (q.tag === "enrichment" && overBudget) continue;
      return { type: "ask", qid: q.id, attempt: 0, prompt: pick(q.text, bucket), revisit: false };
    }
    if (a.status === "answered") {
      const f = followUpFor(q, chainOf(answers, q.id));
      if (f) return { type: "ask", qid: q.id, attempt: chainOf(answers, q.id).length, trigger: f.trigger, prompt: f.text, revisit: false };
    }
  }
  for (const q of qs) {
    const a = main(q.id);
    if (a?.status === "parked" && q.tag !== "enrichment" && (a.round ?? 1) < 2) {
      return { type: "ask", qid: q.id, attempt: 0, prompt: pick(q.text, bucket), revisit: true };
    }
  }
  const later = qs.filter((q) => q.tag === "enrichment" && main(q.id)?.status !== "answered").map((q) => q.id);
  const unresolved = qs.filter((q) => q.tag === "core" && main(q.id)?.status === "parked").map((q) => q.id);
  return { type: "done", later, unresolved };
}

// ---- saving an answer ----

export type AnswerInput = { qid: string; attempt: number; status: AnswerStatus; text: string; trigger?: Trigger; round?: number };

/** Why this answer can't be saved, or null. Checks it against the bank and what's already saved. */
export function validateAnswer(bucket: Bucket, answers: Answer[], input: AnswerInput): string | null {
  const q = BANK.find((x) => x.id === input.qid && x.buckets.includes(bucket));
  if (!q) return "That question isn't part of this interview.";
  if (!Number.isInteger(input.attempt) || input.attempt < 0 || input.attempt > MAX_FOLLOW_UPS) return "That question isn't part of this interview.";
  if (input.status === "skipped" && q.tag !== "sensitive") return "This one can't be skipped. Try \"Not sure yet\" instead.";
  if (input.status === "later" && q.tag !== "enrichment") return "This one is needed for your drafts. Try \"Not sure yet\" instead.";
  const chain = chainOf(answers, input.qid);
  // A new attempt must follow the last one; re-saving an existing attempt is an edit.
  const exists = chain.some((a) => a.attempt === input.attempt);
  if (!exists && input.attempt !== chain.length) return "Please answer the current question first.";
  if (input.attempt > 0 && !chain.some((a) => a.attempt === 0 && a.status === "answered")) return "Please answer the main question first.";
  if (input.status === "answered") {
    const t = input.text.trim();
    if (!t) return "Add an answer, or choose \"Not sure yet\".";
    if (t.length > 1500) return "Please keep the answer under 1,500 characters.";
    if (isExampleText(q, bucket, t)) return "That's the example. Edit it so it's about you.";
    const chips = q.chips ? pick(q.chips, bucket) : null;
    if (chips && !chips.withText && input.attempt === 0) {
      // Options can contain commas ("Yes, it's public"), so a whole-answer match comes first.
      const ok = chips.options.includes(t) || (!!chips.multi && t.split(/\s*,\s*/).every((p) => chips.options.includes(p)));
      if (!ok) return "Pick one of the options.";
    }
  }
  return null;
}

/** Insert or replace by (question, attempt): saving the same answer twice never duplicates it. */
export function applyAnswer(answers: Answer[], input: AnswerInput, extra: Partial<Answer> = {}): Answer[] {
  const next: Answer = {
    qid: input.qid,
    attempt: input.attempt,
    text: input.status === "answered" ? input.text.trim() : "",
    status: input.status,
    ...(input.trigger ? { trigger: input.trigger } : {}),
    ...(input.status === "parked" ? { round: input.round === 2 ? 2 : 1 } : {}),
    ...extra,
  };
  const rest = answers.filter((a) => !(a.qid === input.qid && a.attempt === input.attempt));
  // Editing a main answer drops follow-ups that were asked about the old wording.
  const pruned = input.attempt === 0 ? rest.filter((a) => !(a.qid === input.qid && a.attempt > 0 && answers.find((o) => o.qid === input.qid && o.attempt === 0)?.text !== next.text)) : rest;
  return [...pruned, next];
}

// ---- progress and time ----

/** Share of core questions done. The import counts as a step, so progress starts above zero after it. */
export function progress(bucket: Bucket, answers: Answer[], imported: boolean): { done: number; total: number; pct: number } {
  const core = activeQuestions(bucket, answers).filter((q) => q.tag === "core");
  const done = core.filter((q) => answers.some((a) => a.qid === q.id && a.attempt === 0 && a.status === "answered")).length + (imported ? 1 : 0);
  const total = core.length + 1;
  return { done, total, pct: Math.round((done / total) * 100) };
}

/** Rough minutes left: unanswered core questions plus enrichment while there's budget. */
export function minutesLeft(bucket: Bucket, answers: Answer[]): number {
  const qs = activeQuestions(bucket, answers).filter((q) => q.tag !== "enrichment" && !answers.some((a) => a.qid === q.id && a.attempt === 0));
  return Math.max(1, Math.round(qs.reduce((s, q) => s + q.secs, 0) / 60));
}

// ---- the context brief, from structured answers ----

export type Brief = {
  bucket: Bucket;
  currentRole: string;
  field: Domain;
  goals: Want[];
  targetRoles: string;
  targetCompanies: string;
  mustHaves: string;
  privateSearch: boolean;
  whyNow: string;
  comfort: string;
  tone: string;
  weeklyTime: WeeklyTime;
  voiceSamples: string;
};

const FIELD_DOMAIN: Record<(typeof FIELD_CHIPS)[number], Domain> = {
  Sales: "business",
  Marketing: "business",
  Software: "software",
  "Data and analytics": "data_ai",
  Finance: "finance",
  Design: "product_design",
  Operations: "finance",
  "HR and recruiting": "business",
  Education: "education_policy",
  Healthcare: "healthcare",
  Other: "other",
};

const WANT_OF: Record<(typeof WANT_CHIPS)[number], Want> = {
  "A new job": "job",
  "An internship": "internship",
  Referrals: "referral",
  "Meeting people in my field": "network",
  "A mentor": "mentor",
  Clients: "clients",
};

const TIME_OF: Record<(typeof TIME_CHIPS)[number], WeeklyTime> = { "15 minutes": "15m", "30 minutes": "30m", "1 hour": "1h", "2 hours or more": "2h" };

export function emptyBrief(bucket: Bucket): Brief {
  return { bucket, currentRole: "", field: "not_sure", goals: [], targetRoles: "", targetCompanies: "", mustHaves: "", privateSearch: true, whyNow: "", comfort: "", tone: "", weeklyTime: "30m", voiceSamples: "" };
}

/** Structured fields from the latest answers. A skipped "does your employer know?" stays private. */
export function briefFrom(bucket: Bucket, answers: Answer[]): Brief {
  const b = emptyBrief(bucket);
  const text = (qid: string) => {
    const a = answers.find((x) => x.qid === qid && x.attempt === 0 && x.status === "answered");
    return a ? a.text : "";
  };
  b.currentRole = text("A1").slice(0, 200);
  const field = text("A3") as (typeof FIELD_CHIPS)[number];
  b.field = FIELD_DOMAIN[field] ?? (text("B2") ? suggestDomain(text("B2")) : "not_sure");
  const goals = text("B1");
  b.goals = WANTS.filter((w) => Object.entries(WANT_OF).some(([label, v]) => v === w && goals.includes(label)));
  b.targetRoles = text("B2").slice(0, 200);
  b.targetCompanies = text("B3").slice(0, 300);
  b.mustHaves = text("B6").slice(0, 300);
  b.privateSearch = text("B7") !== "Yes, it's public";
  b.whyNow = text("B5").slice(0, 80);
  b.comfort = text("D4").slice(0, 200);
  b.tone = text("E3").slice(0, 40);
  b.weeklyTime = TIME_OF[text("E4") as (typeof TIME_CHIPS)[number]] ?? "30m";
  b.voiceSamples = text("E2").slice(0, 3000);
  return b;
}

// ---- Story Vault facts from one answer ----

export type CandidateFact = { kind: FactKind; text: string; sourceQid: string; confidence: FactConfidence };

/** How solid a fact is, from its own words. */
export function confidenceOf(text: string, estimate = false): FactConfidence {
  const est = estimate || /\b(about|around|roughly|approx\w*|estimate\w*|~|nearly|almost)\b/i.test(text);
  return {
    example: text.trim().split(/\s+/).length >= 6 && !looksVague(text),
    number: hasNumber(text) ? (est ? "estimate" : "measured") : "none",
    iDid: /\b(I|my|myself)\b/.test(text),
  };
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > n * 0.5 ? cut.slice(0, sp) : cut).replace(/[,;:\s]+$/, "") + "…";
}

/** Deterministic candidate facts: the person's own words, one fact per answer. Examples never become facts. */
export function factsFromAnswer(bucket: Bucket, answer: Answer): CandidateFact[] {
  const q = BANK.find((x) => x.id === answer.qid);
  if (!q || answer.status !== "answered" || !answer.text.trim() || isExampleText(q, bucket, answer.text)) return [];
  if (answer.attempt === 0 && !q.factKind) return [];
  let kind: FactKind = q.factKind ?? "project";
  let text = answer.text;
  let estimate = false;
  if (answer.attempt > 0) {
    if (answer.trigger === "we") kind = "contribution";
    else if (answer.trigger === "no_number") {
      kind = "evidence";
      if (notMeasured(text)) return [];
      estimate = true;
      if (hasNumber(text) && !/estimate/i.test(text)) text = `${text.replace(/[.\s]+$/, "")} (estimate)`;
    }
  }
  return [{ kind, text: clip(text, 300), sourceQid: answer.qid, confidence: confidenceOf(text, estimate) }];
}

// ---- reflection (demo mode, and the fallback when the model's line is unusable) ----

const PRAISE = /\b(great|awesome|amazing|fantastic|impressive|wonderful|excellent|love (that|this|it)|nice|brilliant|well done|good job|kudos)\b/i;

/** A one-line reflection is usable if it's short, specific to the answer, and has no stock praise. */
export function reflectionOk(line: string, answer: string): boolean {
  const t = line.trim();
  if (!t || t.length > 200 || PRAISE.test(t)) return false;
  const a = new Set(norm(answer).split(" ").filter((w) => w.length > 3));
  return norm(t).split(" ").some((w) => w.length > 3 && a.has(w));
}

/** Echo the answer back in one plain line. Specific because it quotes them; never praise. */
export function demoReflection(qid: string, text: string): string {
  // Chip picks ("A new job") come first in chip-plus-text answers; reflect the person's own words instead.
  const q = BANK.find((x) => x.id === qid);
  const raw = q?.chips;
  const chipSets = !raw ? [] : "default" in raw ? (Object.values(raw) as { options: readonly string[] }[]) : [raw];
  const chips = new Set(chipSets.flatMap((c) => c?.options ?? []).map(norm));
  const parts = text.split(/(?<=[.!?])\s+|,\s+/).map((s) => s.trim()).filter(Boolean);
  const own = parts.filter((s) => !chips.has(norm(s)));
  const chosen = own.length && own.length < parts.length ? own.join(", ") : text;
  const first = clip(chosen.split(/(?<=[.!?])\s/)[0] ?? chosen, 110).replace(/[.\s]+$/, "");
  const lead: Record<string, string> = {
    A1: "So right now:",
    A2: "So people rely on you for",
    B1: "Over the next 3 months you want:",
    B2: "You're aiming for",
    B3: "Your targets:",
    B4: "What you actually want:",
    B6: "Your must-haves:",
    C1: "Your example:",
    C1b: "Your second example:",
    D1: "You want to talk to",
    D2: "Your ways in:",
    D3: "What you can offer:",
  };
  const l = lead[qid] ?? "Noted:";
  const body = l.endsWith(":") ? first : first.charAt(0).toLowerCase() + first.slice(1);
  return `${l} ${body}.`;
}
