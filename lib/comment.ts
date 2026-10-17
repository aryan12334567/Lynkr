import type { CommentReply } from "./schemas";

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
export const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

export const COMMENT_MIN_WORDS = 30;
export const COMMENT_MAX_WORDS = 70;

/**
 * Shape and reference checks for an AI comment: the anchor is really in the excerpt, every
 * fact id was submitted, the length is in range and nothing is left blank. Returns the
 * failed check, or null. These can't prove the comment is true; the user reviews it.
 */
export function validComment(r: CommentReply, excerpt: string, ids: Set<string>): string | null {
  if (r.status === "skip") return null;
  if (!r.postAnchor.trim() || !norm(excerpt).includes(norm(r.postAnchor))) return "anchor";
  if (r.factRefs.some((id) => !ids.has(id))) return "refs";
  const n = wordCount(r.body);
  if (n < COMMENT_MIN_WORDS || n > COMMENT_MAX_WORDS) return "length";
  if (/\[\[/.test(r.body)) return "blanks";
  return null;
}
