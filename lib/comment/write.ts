import { callStructured, isMock } from "../llm";
import { unsupportedSentences } from "../grounding";
import { COMMENT_ANGLES, CommentOptionsModel, type CommentAngle, type CommentGoal, type CommentOption, type FactRef } from "../schemas";
import { validOption } from "./checks";
import { commentOptionsUser, COMMENT_OPTIONS_SYSTEM } from "./prompt";
import { mockCommentOptions } from "./mock";
import { parseSelection, PROBLEM_TEXT, type Author, type SelectionKind, type SelectionProblem } from "./parse";

/**
 * Up to three checked comment options for one selected post, or a typed skip (Commenter plan U3, KTD1).
 * Nothing here stores anything: the selection, the reaction and the author live for this call only (KD5).
 */

export type CommentWriterOption = CommentOption & {
  /** Sentences of the comment that rest on little the person gave. The card shows "Check this line" on them. */
  flags: string[];
};

export type WriteInput = {
  selection: string;
  goal: CommentGoal;
  reaction: string;
  /** The person's own edit of the author line. Wins over what the parser found. */
  author?: Author | null;
  targetRole: string;
  /** Facts already filtered for public use (`factsFor("comment", ...)`). */
  facts: FactRef[];
};

export type WriteResult =
  | { kind: "refused"; problem: SelectionProblem; message: string }
  | { kind: "skip"; reason: "no_input" | "off_topic" | "failed"; why: string; author: Author | null; selectionKind: SelectionKind }
  | { kind: "options"; author: Author | null; selectionKind: SelectionKind; options: CommentWriterOption[]; dropped: number };

export type WriteDeps = {
  call: typeof callStructured;
  mock: () => boolean;
};
const defaultDeps: WriteDeps = { call: callStructured, mock: isMock };

const WHY_MAX_WORDS = 25;
const trimWhy = (s: string) => {
  const w = s.trim().split(/\s+/).filter(Boolean);
  return w.length <= WHY_MAX_WORDS ? w.join(" ") : `${w.slice(0, WHY_MAX_WORDS).join(" ")}…`;
};

/** Checks 1 to 10 on the model's list: failed options are dropped, and a second option of an angle is dropped. */
function keep(model: CommentOptionsModel, post: string, facts: FactRef[], reaction: string): { kept: CommentWriterOption[]; dropped: number } {
  const seen = new Set<CommentAngle>();
  const kept: CommentWriterOption[] = [];
  let dropped = 0;
  const sources = [reaction, post, ...facts.map((f) => f.text)];
  for (const o of model.options.slice(0, 6)) {
    if (!COMMENT_ANGLES.includes(o.angle) || seen.has(o.angle) || validOption(o, post, facts)) { dropped++; continue; }
    seen.add(o.angle);
    kept.push({ ...o, body: o.body.trim(), why: trimWhy(o.why), flags: unsupportedSentences(o.body, sources) });
  }
  return { kept: kept.slice(0, 3), dropped };
}

export async function writeComments(input: WriteInput, deps: WriteDeps = defaultDeps): Promise<WriteResult> {
  const parsed = parseSelection(input.selection);
  if (parsed.problem) return { kind: "refused", problem: parsed.problem, message: PROBLEM_TEXT[parsed.problem] };
  const author = input.author?.name.trim() ? { name: input.author.name.trim(), headline: input.author.headline.trim() } : parsed.author;
  const base = { author, selectionKind: parsed.kind };
  const reaction = input.reaction.trim();

  // Nothing to say it with: no model call (AE2a).
  if (!reaction && input.facts.length === 0) {
    return { kind: "skip", reason: "no_input", why: "Tell me one thing you think about this and I'll write it.", ...base };
  }

  if (deps.mock()) {
    const m = keep(mockCommentOptions(parsed.post, reaction, input.facts), parsed.post, input.facts, reaction);
    return m.kept.length
      ? { kind: "options", ...base, options: m.kept, dropped: m.dropped }
      : { kind: "skip", reason: "off_topic", why: "Add your reaction in a few words and try again.", ...base };
  }

  let dropped = 0;
  let skipWhy = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const model = await deps.call({
      system: COMMENT_OPTIONS_SYSTEM,
      user: commentOptionsUser({ goal: input.goal, targetRole: input.targetRole, author, post: parsed.post, facts: input.facts, reaction, retry: attempt > 0 }),
      schema: CommentOptionsModel,
      effort: "medium",
      maxTokens: 2500,
    });
    if (model.status === "skip" || model.options.length === 0) {
      // A skip is the model's honest answer, not a failed check: no retry.
      return { kind: "skip", reason: "off_topic", why: model.skipWhy.trim() || "Neither your facts nor your reaction connect to this post.", ...base };
    }
    const k = keep(model, parsed.post, input.facts, reaction);
    dropped += k.dropped;
    if (k.kept.length) return { kind: "options", ...base, options: k.kept, dropped };
    skipWhy = "Couldn't write a comment that answers a specific line and uses only what you told me.";
  }
  return { kind: "skip", reason: "failed", why: skipWhy, ...base };
}
