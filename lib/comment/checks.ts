import { COMMENT_MAX_WORDS, COMMENT_MIN_WORDS, wordCount } from "../comment";

/**
 * The quality checks on one comment option (Commenter plan KTD3, checks 1 to 9). An option that fails one is dropped.
 * These can't prove a comment is true; the person reads it before posting. Check 10 (one option per angle) is in
 * `write.ts`, because it needs the whole list.
 */

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const words = (s: string) => norm(s).replace(/[^\p{L}\p{N}\s']/gu, " ").split(/\s+/).filter(Boolean);

/** Openers that read as praise, from the Reddit rows on AI comments (reddit-pain-points.md rows 1 to 4). */
export const BANNED_OPENERS = [
  "great post", "great insights", "great insight", "thanks for sharing", "thank you for sharing", "this really resonates",
  "so true", "love this", "well said", "couldn't agree more", "could not agree more", "spot on", "great read", "nice post",
];
const ASK = /\b(dm me|message me|reach out to me|hire me|looking for (a )?(job|role|opportunit)|open to (work|opportunit)|any (openings?|vacanc)|refer me|referral|my services|book a call|let'?s connect|check out my)\b/i;
export const MAX_FACT_REFS = 2;
export const LEAK_RUN = 6;

/** True when `body` has `n` or more consecutive words that also appear, in the same order, in `source`. */
export function sharesRun(body: string, source: string, n: number): boolean {
  const b = words(body);
  const s = ` ${words(source).join(" ")} `;
  for (let i = 0; i + n <= b.length; i++) if (s.includes(` ${b.slice(i, i + n).join(" ")} `)) return true;
  return false;
}

export type OptionLike = { body: string; postAnchor: string; factRefs: string[] };

/** The failed check's name, or null. `facts` is every fact that was sent to the model. */
export function validOption(o: OptionLike, post: string, facts: { id: string; text: string }[]): string | null {
  if (!o.postAnchor.trim() || !norm(post).includes(norm(o.postAnchor))) return "anchor";
  const ids = new Set(facts.map((f) => f.id));
  if (o.factRefs.some((id) => !ids.has(id)) || new Set(o.factRefs).size > MAX_FACT_REFS) return "refs";
  const n = wordCount(o.body);
  if (n < COMMENT_MIN_WORDS || n > COMMENT_MAX_WORDS) return "length";
  if (/\[\[/.test(o.body)) return "blanks";
  const open = words(o.body).slice(0, 6).join(" ");
  if (BANNED_OPENERS.some((b) => open.startsWith(words(b).join(" ")))) return "opener";
  if (/[—–]|\s-\s/.test(o.body)) return "dash";
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|in|io|co|ai)\b|[#@]\w/i.test(o.body)) return "link";
  if (ASK.test(o.body)) return "ask";
  for (const f of facts) if (!o.factRefs.includes(f.id) && sharesRun(o.body, f.text, LEAK_RUN)) return "leak";
  return null;
}
