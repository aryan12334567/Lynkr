import { wordCount } from "../comment";
import { BANNED_PHRASES } from "../checker";
import { claimProblem, looksHinglish, splitSentences, unsupportedSentences } from "../grounding";
import type { Evidence } from "./types";

/**
 * The guard on a post's text (posts plan U4, KD2, R12). It cannot prove a post is true, it refuses what is plainly
 * invented or against the house style. Everything the person said (confirmed facts, this post's answers, the brief) is
 * the evidence; a number, name, quote, credential, outcome, quantity, title or piece of praise outside it is rejected.
 */

export const POST_MIN_WORDS = 90;
export const POST_MAX_WORDS = 180;
/** LinkedIn shows 3,000 characters of a post. */
export const LINKEDIN_LIMIT = 3000;

export type Problem = { code: string; message: string };
const P = (code: string, message: string): Problem => ({ code, message });

/** Phrases a post never uses: the shared list's plain phrases, plus the LinkedIn clichés the prompt names. */
export const POST_BANNED: readonly string[] = [
  ...BANNED_PHRASES.filter((p) => !p.includes("/")),
  "excited to announce", "excited to share", "delighted to announce", "proud to announce", "humbled", "let that sink in", "here's what i learned",
  "agree?", "thoughts?", "i'm happy to share",
];

const ALLOWED_CAPS = new Set("linkedin monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december ai ml ui ux sql api i".split(" "));
const stem = (w: string) => w.replace(/(ings|ing|ed|es|s)$/, "");
const lowerWords = (texts: readonly string[]) => new Set(texts.join(" ").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
const norm = (s: string) => s.replace(/[‘’]/g, "'").replace(/[-‐-―]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
const numbersIn = (s: string) => (s.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/[,.]+$/, "").replace(/,/g, ""));

/** What the person said, as separate texts. */
export const sourcesOf = (ev: Evidence): string[] => [...ev.facts.map((f) => f.text), ...ev.answers.map((a) => a.text), ev.brief].filter((s) => s.trim());

function inventedName(body: string, sources: readonly string[]): string | null {
  const known = lowerWords(sources);
  const knownStems = new Set([...known].map(stem));
  for (const s of splitSentences(body)) {
    const ws = [...s.matchAll(/[\p{L}][\p{L}'’]*/gu)];
    for (const m of ws.slice(1)) {
      const w = m[0].replace(/['’]s$/i, "");
      if (!/^\p{Lu}/u.test(w) || ALLOWED_CAPS.has(w.toLowerCase()) || /^I['’]/.test(w)) continue;
      const lw = w.toLowerCase();
      if (known.has(lw) || (lw.length > 4 && knownStems.has(stem(lw)))) continue;
      return w;
    }
  }
  return null;
}

export type CheckOptions = {
  /** [min, max] words, or null for no length rule (a hand edit). Default: 90 to 180. */
  length?: [number, number] | null;
};

/** Every problem with `body`, in a fixed order. An empty list means the text is clean. */
export function textProblems(body: string, ev: Evidence, opts: CheckOptions = {}): Problem[] {
  const out: Problem[] = [];
  const text = body.trim();
  const range = opts.length === undefined ? ([POST_MIN_WORDS, POST_MAX_WORDS] as [number, number]) : opts.length;
  if (range) {
    const n = wordCount(text);
    if (n < range[0] || n > range[1]) out.push(P("length", `A post of this kind runs ${range[0]} to ${range[1]} words. This one has ${n}.`));
  }
  if (text.length > LINKEDIN_LIMIT) out.push(P("over_limit", `LinkedIn shows 3,000 characters. This has ${text.length}.`));
  if (/\[\[|\]\]|[{}]|\bTODO\b|\bTBD\b/.test(text)) out.push(P("blanks", "There is a blank or a placeholder in the text. A post goes out complete."));
  if (/(^|[\s(])#\w/.test(text)) out.push(P("hashtag", "Remove the hashtag."));
  if (/\p{Extended_Pictographic}/u.test(text)) out.push(P("emoji", "Remove the emoji."));
  if (/[—–]/.test(text)) out.push(P("dash", "Replace the long dash with a comma or a full stop."));
  const flat = norm(text);
  const banned = POST_BANNED.find((b) => new RegExp(`(^|[^a-z])${norm(b).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(flat));
  if (banned) out.push(P("banned", `"${banned}" reads as a stock phrase. Say the concrete thing instead.`));
  if (/https?:\/\/|www\./i.test(text)) out.push(P("link", "There is a link in the text that you did not give."));

  const sources = sourcesOf(ev);
  if (/\?/.test(text) && !ev.answers.some((a) => /\?/.test(a.text))) out.push(P("bait", "A question to the reader is only kept when your own answer holds a real question."));

  const have = new Set(numbersIn(sources.join(" ")));
  const extra = numbersIn(text).find((n) => !have.has(n));
  if (extra) out.push(P("number", `The number ${extra} is not in anything you told me.`));
  const known = norm(sources.join(" "));
  for (const m of text.matchAll(/["“]([^"”]{3,})["”]/g)) {
    if (!known.includes(norm(m[1]))) { out.push(P("quote", "A quoted line that is not in your answers.")); break; }
  }
  const name = inventedName(text, sources);
  if (name) out.push(P("name", `"${name}" is a name or term that is not in anything you told me.`));
  const claim = claimProblem(text, sources, sources);
  if (claim) {
    const why: Record<string, string> = {
      claim: "A credential or result that you did not say.",
      quantity: "A quantity in words that you did not give.",
      identity: "A job title you did not give yourself.",
      flattery: "Praise that nothing you said supports.",
    };
    out.push(P(claim, why[claim]));
  }
  // Word matching cannot judge an English post against a Hinglish answer, so that case relies on the checks above.
  if (!looksHinglish(ev.answers.map((a) => a.text).join(" "))) {
    const flags = unsupportedSentences(text, sources);
    if (flags.length * 2 > splitSentences(text).length) out.push(P("unsupported", "Most of this does not rest on what you told me."));
  }
  return out;
}

export type VersionLike = { body: string; factRefs: string[]; answerRefs: string[] };

/** The first failed check's code, or null. A version must also cite known facts or answers (and only those). */
export function versionProblem(v: VersionLike, ev: Evidence): string | null {
  const facts = new Set(ev.facts.map((f) => f.id));
  const answers = new Set(ev.answers.map((a) => a.id));
  const refsOk = v.factRefs.every((r) => facts.has(r)) && v.answerRefs.every((r) => answers.has(r)) && v.factRefs.length + v.answerRefs.length > 0;
  return textProblems(v.body, ev)[0]?.code ?? (refsOk ? null : "refs");
}
