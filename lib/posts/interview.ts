import { callStructured, isMock } from "../llm";
import { wordCount } from "../comment";
import type { PostMode, PostType } from "./db";
import { POST_QUESTION_SYSTEM, postQuestionUser } from "./prompt";
import { PostQuestionModel } from "./types";

/**
 * The per-post interview (posts plan U3, KD1, R4 to R8). The server chooses every question from a fixed bank by post type,
 * so nothing a person pastes can change what is asked. The model only phrases the one thin-answer follow-up, and a
 * phrasing that is not a single short question is thrown away. Answers are the person's own words: data, never instructions.
 */

export type Question = { key: string; text: string; example: string };

/** Quick asks at most 3 questions, Thorough at most 7. The one thin-answer question (R8) is allowed beyond the cap. */
export const CAPS: Record<PostMode, number> = { quick: 3, thorough: 7 };
/** An answer with fewer words than this adds little. Two that do are enough to write from. */
export const SUBSTANTIVE_WORDS = 5;
/** In Quick, two answers that together run this long are enough to write from, and the interview stops early. */
const QUICK_ENOUGH_WORDS = 40;

export const TOPIC: Question = { key: "topic", text: "What is this post about?", example: "For example: how I cleaned the fest survey data before the committee meeting. Rough notes are fine." };
export const THIN: Question = { key: "thin", text: "Tell me one specific moment from this, even in rough words.", example: "For example: who asked, what you did first, what changed. Rough notes are fine." };

const q = (key: string, text: string, example: string): Question => ({ key, text, example: `For example: ${example} Rough notes are fine.` });

export const BANK: Record<PostType, Question[]> = {
  proof: [
    q("did", "What did you do? Start with the work itself.", "I cleaned two years of survey data in Excel before the committee meeting."),
    q("why", "Who needed it, and what was the situation?", "The committee wanted a summary before the next meeting."),
    q("decision", "What was one choice you made along the way, and why?", "I chose to remove duplicate sign-ups before building any charts."),
    q("result", "What happened because of it?", "The charts matched the registration sheet."),
    q("change", "What would you do differently next time?", "I would check for duplicates on day one."),
    q("tools", "Which tools or methods did you use?", "Excel, pivot tables, and a checklist for duplicates."),
    q("reader", "What would you want a reader in your shoes to take from it?", "Check the data before you trust the chart."),
  ],
  setback: [
    q("happened", "What went wrong? Say it plainly.", "My first pivot table counted some students twice."),
    q("noticed", "How did you notice, and when?", "The totals did not match the registration sheet."),
    q("cost", "What did it cost you, or the people involved?", "I had to redo the charts the night before the meeting."),
    q("fix", "What did you do about it?", "I removed duplicate sign-ups and rebuilt the table."),
    q("cause", "Looking back, what was the real cause?", "I trusted the raw export without checking it."),
    q("change", "What do you do differently now?", "I check the data before I build anything on it."),
    q("reader", "What would you tell someone about to make the same mistake?", "Spend ten minutes checking the input first."),
  ],
  observation: [
    q("saw", "What did you notice? Say what you saw first-hand.", "Most teams I worked with skipped checking the data."),
    q("where", "Where and when did you see it?", "During the fest committee work last term."),
    q("example", "Give one concrete example of it.", "A summary chart that looked fine but counted people twice."),
    q("why", "Why do you think it happens?", "Everyone assumes the export is already clean."),
    q("matters", "Why does it matter to someone starting out?", "A wrong chart costs trust, and trust is hard to win back."),
    q("action", "What is one thing a reader could try this week?", "Open the raw data and look at ten rows before charting."),
    q("view", "What is your own view, in a sentence?", "Checking the input is part of the work, not extra."),
  ],
};

export type AnswerLike = { key: string; answer: string };

export type Step =
  | { kind: "question"; question: Question & { index: number; cap: number } }
  | { kind: "done"; reason: "enough" | "cap" | "thin" | "write_now"; note: string };

const NOTES: Record<"enough" | "cap" | "thin" | "write_now", string> = {
  enough: "That is enough to write from.",
  cap: "That is all I need. Time to write.",
  thin: "I can't write this without inventing details. Add a line or two to an answer, or add a fact to your Story Vault, and I'll write it.",
  write_now: "Writing it now from what you've told me.",
};

const substantive = (a: AnswerLike) => wordCount(a.answer) >= SUBSTANTIVE_WORDS;

/**
 * What to ask next, from the answers already given. Pure: the same answers always give the same step, so a person
 * who closes the tab and returns on another device (R9) gets the question they were on, and nothing is asked twice.
 */
export function nextStep(opts: { type: PostType; brief: string; mode: PostMode; answers: readonly AnswerLike[]; writeNow?: boolean }): Step {
  if (opts.writeNow) return { kind: "done", reason: "write_now", note: NOTES.write_now };
  const cap = CAPS[opts.mode];
  const asked = opts.answers.filter((a) => a.key !== THIN.key);
  const good = opts.answers.filter(substantive);
  const early = opts.mode === "quick" && asked.length >= 2 && good.length >= 2 && good.reduce((n, a) => n + wordCount(a.answer), 0) >= QUICK_ENOUGH_WORDS;

  if (asked.length < cap && !early) {
    const sequence = opts.brief.trim() ? BANK[opts.type] : [TOPIC, ...BANK[opts.type]];
    const done = new Set(asked.map((a) => a.key));
    const next = sequence.find((s) => !done.has(s.key));
    if (next) return { kind: "question", question: { ...next, index: asked.length + 1, cap } };
  }
  if (good.length < 2) {
    if (!opts.answers.some((a) => a.key === THIN.key)) return { kind: "question", question: { ...THIN, index: asked.length + 1, cap } };
    return { kind: "done", reason: "thin", note: NOTES.thin };
  }
  return { kind: "done", reason: early ? "enough" : "cap", note: early ? NOTES.enough : NOTES.cap };
}

export type PhraseDeps = { call: typeof callStructured; mock: () => boolean };
const defaultDeps: PhraseDeps = { call: callStructured, mock: isMock };

/** One short question and nothing else: no second question, no link, no digits that could smuggle in a claim, no line breaks. */
const singleQuestion = (s: string) => s.length >= 12 && s.length <= 220 && (s.match(/\?/g) ?? []).length === 1 && s.endsWith("?") && !/https?:|www\.|[\n\r]/.test(s) && wordCount(s) <= 30;

/**
 * The thin-answer follow-up, phrased by the model from the last answer. Anything that is not a single short question
 * is thrown away and the fixed question is used. In demo mode there is no model, so the fixed question is used.
 */
export async function phraseFollowUp(ctx: { type: PostType; brief: string; last: string }, deps: PhraseDeps = defaultDeps, fixed: string = THIN.text): Promise<string> {
  if (deps.mock()) return fixed;
  try {
    const r = await deps.call({ system: POST_QUESTION_SYSTEM, user: postQuestionUser(ctx), schema: PostQuestionModel, effort: "low", maxTokens: 200, timeoutMs: 15_000 });
    const text = r.question.trim();
    return singleQuestion(text) ? text : fixed;
  } catch {
    return fixed;
  }
}
