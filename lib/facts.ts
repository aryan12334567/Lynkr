import { OUTREACH_ONLY_KINDS, type FactConfidence, type FactKind, type FactRef, type ReviewStatus } from "./schemas";

/**
 * One filter for "which of the person's Story Vault facts may go where" (build-plan-combined.md X1).
 * Posts, comments, outreach drafts and the free first win all call `factsFor(use, facts, opts?)` instead of
 * filtering on their own, so a private fact cannot reach a public place by one part forgetting a rule.
 *
 *   post       no outreach-only kind (Posts R12). Everything else that is confirmed and switched on.
 *   comment    public-safe only (Commenter KTD4): no outreach-only kind, nothing that mentions a term in
 *              `opts.avoid` (target companies or role of a private search). Newest first, at most 12.
 *   outreach   a private message to one person, so any kind may go. At most 2 (KTD4): the best proof first
 *              (`opts.proof`, the playbook's kinds); the answered detail for `opts.goal` takes the second slot.
 *              Answers to other goals' questions never go.
 *   first_win  the free first draft (Interview U9). Proof kinds first, strongest first; other public kinds only
 *              when fewer than two proof facts exist. Never an outreach-only kind. At most 2.
 *
 * Every use drops facts that are not confirmed or are switched off for drafts. Facts that carry no review status
 * (the browser sends only confirmed ones, as FactRef) count as confirmed. The result is always id, kind and text.
 */
export type FactUse = "post" | "comment" | "outreach" | "first_win";

/** A Story Vault fact, or the id/kind/text a browser sends. Review fields are optional on purpose. */
export type FactLike = {
  id: string;
  kind: FactKind;
  text: string;
  reviewStatus?: ReviewStatus;
  useInDrafts?: boolean;
  updatedAt?: string;
  confidence?: FactConfidence;
  sourceQid?: string;
};

export type FactsOptions = {
  /** Outreach: the goal id. Its answered detail is kept; other goals' details are dropped. */
  goal?: string;
  /** Outreach: the goal question (its key) whose answer is preferred when the person has answered several. */
  detail?: string;
  /** Outreach: fact kinds that make good proof for this goal, best first (the playbook's `proof`). */
  proof?: readonly FactKind[];
  /** Comment: words or names that must not appear (a private search's target companies or role). */
  avoid?: readonly string[];
  /** Fewer than the use's default. */
  limit?: number;
};

export const FACT_LIMITS: Record<FactUse, number> = { post: 20, comment: 12, outreach: 2, first_win: 2 };

/** Kinds that make a good first win when nothing more specific is known. */
export const FIRST_WIN_PROOF: readonly FactKind[] = ["project", "contribution", "evidence", "offer"];

const isPrivate = (k: FactKind) => OUTREACH_ONLY_KINDS.includes(k);
const ref = ({ id, kind, text }: FactLike): FactRef => ({ id, kind, text });
const time = (f: FactLike) => (f.updatedAt ? Date.parse(f.updatedAt) || 0 : 0);

/** Stable sort: equal items keep their order. */
const sorted = <T>(items: T[], by: (x: T) => number) => items.map((x, i) => ({ x, i, k: by(x) })).sort((a, b) => b.k - a.k || a.i - b.i).map(e => e.x);

/** How solid a fact is: a measured number counts most, then a concrete example and a clear "I did". */
const strength = (f: FactLike) => (f.confidence ? (f.confidence.number === "measured" ? 2 : f.confidence.number === "estimate" ? 1 : 0) + (f.confidence.example ? 1 : 0) + (f.confidence.iDid ? 1 : 0) : 0);

/** The goal a goal_detail fact answers: "goal_detail:<goal>:<key>" in sourceQid. Empty when the fact has none. */
const detailGoal = (f: FactLike) => (f.kind === "goal_detail" && f.sourceQid?.startsWith("goal_detail:") ? f.sourceQid.split(":")[1] : "");

export function factsFor(use: FactUse, facts: readonly FactLike[], opts: FactsOptions = {}): FactRef[] {
  const usable = facts.filter(f => (f.reviewStatus ?? "confirmed") === "confirmed" && f.useInDrafts !== false && f.text.trim());
  const limit = Math.max(0, Math.min(opts.limit ?? FACT_LIMITS[use], FACT_LIMITS[use]));

  if (use === "post") return usable.filter(f => !isPrivate(f.kind)).slice(0, limit).map(ref);

  if (use === "comment") {
    const avoid = (opts.avoid ?? []).map(a => a.trim().toLowerCase()).filter(Boolean);
    const safe = usable.filter(f => !isPrivate(f.kind) && !avoid.some(a => f.text.toLowerCase().includes(a)));
    return sorted(safe, time).slice(0, limit).map(ref);
  }

  if (use === "first_win") {
    const open = usable.filter(f => !isPrivate(f.kind));
    const proof = sorted(open.filter(f => FIRST_WIN_PROOF.includes(f.kind)), strength);
    const rest = proof.length >= 2 ? [] : open.filter(f => !FIRST_WIN_PROOF.includes(f.kind));
    return [...proof, ...rest].slice(0, limit).map(ref);
  }

  // outreach
  const goal = opts.goal ?? "";
  const answered = usable.filter(f => detailGoal(f) === goal && goal);
  const others = usable.filter(f => f.kind !== "goal_detail" || (!detailGoal(f) && !goal));
  const rank = (f: FactLike) => {
    const i = (opts.proof ?? []).indexOf(f.kind);
    return i >= 0 ? 100 - i : 0;
  };
  const best = sorted(others, f => rank(f) * 10 + strength(f));
  if (!answered.length) return best.slice(0, limit).map(ref);
  const wanted = opts.detail ? answered.filter(f => f.sourceQid?.endsWith(`:${opts.detail}`)) : [];
  const detail = (wanted.length ? wanted : answered).sort((a, b) => time(b) - time(a))[0];
  return [...best.slice(0, Math.max(0, limit - 1)), detail].slice(0, limit).map(ref);
}
