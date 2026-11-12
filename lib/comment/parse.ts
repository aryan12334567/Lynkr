/**
 * Split a LinkedIn selection into the author and the post text (Commenter plan U2, KTD2).
 *
 * The extension reads `getSelection().toString()`, so line breaks are kept. A post's header looks like:
 *
 *   Priya Shah            <- name (may end in "• 1st", "Verified")
 *   Data Lead at Swiggy   <- headline
 *   2d • Edited           <- time marker
 *   <the post>
 *
 * These are line rules, not a model: they run in the extension's request path for free and cannot invent an
 * author. They are checked against synthetic fixtures; real captures (plan A6) decide whether they are enough.
 * A selection with no header gives no author, and the person adds one by hand.
 */

export type Author = { name: string; headline: string };
export type SelectionKind = "post" | "repost" | "company" | "promoted";
export type SelectionProblem = "short" | "long" | "see_more";

export type ParsedSelection = {
  author: Author | null;
  /** The post body: the header lines removed. With no header found, the whole selection. */
  post: string;
  kind: SelectionKind;
  /** Why this selection can't be answered yet (R4). Null when it can. */
  problem: SelectionProblem | null;
};

export const SELECTION_MIN = 20;
/** Header plus body, and the body on its own: a LinkedIn post is at most 3,000 characters. */
export const SELECTION_MAX = 3600;
export const POST_MAX = 3000;
export const AUTHOR_NAME_MAX = 120;
export const AUTHOR_HEADLINE_MAX = 220;

/** "2d •", "3 w •", "1mo •", "5h", "Edited", "Edited •". */
const TIME = /^(\d+\s*(s|m|min|h|hr|d|w|wk|mo|y|yr)s?\b\s*([•·].*)?|edited\b.*|promoted\b.*)$/i;
/** Lines that are interface chrome, never an author or a headline. */
const CHROME = /^(promoted|suggested|follow|\+\s*follow|connect|\+\s*connect|following|verified|feed post|visible to anyone.*|•\s*(1st|2nd|3rd\+?)|\(?(he|she|they)\/(him|her|them)\)?)$/i;
const DEGREE = /\s*[•·]\s*(1st|2nd|3rd\+?)\s*$/i;
const REPOST = /^(.{2,100}?)\s+(reposted|shared|celebrates|likes|commented on|loves|supports|finds this (insightful|funny|interesting))\b.*$/i;
const SEE_MORE = /(…|\.\.\.)\s*(see\s+)?more\s*$/i;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function nameLike(line: string): boolean {
  const t = line.replace(DEGREE, "").trim();
  if (!t || t.length > 80) return false;
  if (/[.!?:;]$/.test(t)) return false;
  const words = t.split(/\s+/);
  return words.length >= 1 && words.length <= 7 && /^\p{L}/u.test(t);
}

export function parseSelection(raw: string): ParsedSelection {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  const problem = (post: string): SelectionProblem | null => {
    if (text.length < SELECTION_MIN) return "short";
    if (text.length > SELECTION_MAX || post.length > POST_MAX) return "long";
    if (SEE_MORE.test(text)) return "see_more";
    return null;
  };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let kind: SelectionKind = "post";
  let i = 0;
  // "X reposted this", "Promoted" and "Suggested" come first and are not the author.
  for (; i < Math.min(lines.length, 3); i++) {
    const l = lines[i];
    if (/^promoted$/i.test(l) || /^suggested$/i.test(l)) { kind = "promoted"; continue; }
    if (REPOST.test(l) && /(reposted|shared)\b/i.test(l) && l.length < 120) { kind = kind === "promoted" ? kind : "repost"; continue; }
    break;
  }

  // The header: a name line, a headline line, then a time marker, all within the first few lines.
  const head = lines.slice(i, i + 7);
  const timeAt = head.findIndex((l, idx) => idx >= 2 && TIME.test(l) && l.length < 60);
  if (timeAt >= 2 && nameLike(head[0])) {
    const nameLines = head.slice(0, timeAt).filter((l) => !CHROME.test(l));
    const name = clean(nameLines[0]?.replace(DEGREE, "") ?? "").slice(0, AUTHOR_NAME_MAX);
    const headline = clean(nameLines.slice(1).find((l) => !TIME.test(l)) ?? "").slice(0, AUTHOR_HEADLINE_MAX);
    if (name && headline && nameLines.length >= 2) {
      const after = lines.slice(i + timeAt + 1).filter((l, idx) => !(idx < 2 && CHROME.test(l)));
      const post = after.join("\n").trim();
      return {
        author: { name, headline },
        post,
        kind: /\bfollowers?$/i.test(headline) && kind === "post" ? "company" : kind,
        problem: problem(post),
      };
    }
  }

  // No header in the selection: the whole selection is the post, and the author is added by hand.
  return { author: null, post: text, kind, problem: problem(text) };
}

/** The plain-words message for each problem (R4), shown by the panel and returned by the route. */
export const PROBLEM_TEXT: Record<SelectionProblem, string> = {
  short: "Select the part of the post you want to answer (at least a sentence).",
  long: "That's longer than a LinkedIn post. Select just the part you're answering.",
  see_more: "Expand the post (click 'see more') and select again, so Lynkr reads all of it.",
};
