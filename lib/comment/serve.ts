import { bumpMetric, confirmedFacts, getBrief, takeDaily, type Db } from "../db";
import { LlmError } from "../llm";
import { factsFor } from "../facts";
import { targetCompanies } from "../outreach/ui-goals";
import { COMMENT_GOALS, ProfileInput, type CommentOptionsRequest } from "../schemas";
import { DAILY_COMMENTS, defaultGoal } from "./goal";
import { parseSelection, PROBLEM_TEXT } from "./parse";
import { signReceipt } from "./receipt";
import { writeComments } from "./write";

/**
 * One generation for a signed-in person: the extension route and the web route both call this, so the facts rule,
 * the daily cap, the receipts and the metrics cannot drift apart (Commenter plan KTD1). The selection, reaction and
 * author are used for this call only: nothing is stored and nothing is logged.
 */
async function count(db: Db, event: string, label: string) {
  try { await bumpMetric(db, event, label.slice(0, 40)); } catch { /* a count is never worth failing a request */ }
}

export async function generateForUser(db: Db, userId: string, input: CommentOptionsRequest, source: "extension" | "web"): Promise<{ status: number; json: unknown }> {
  // A selection that can't be answered costs nothing: no cap spent, no model call (R4).
  const parsed = parseSelection(input.selection);
  if (parsed.problem) return { status: 400, json: { status: "refused", problem: parsed.problem, error: PROBLEM_TEXT[parsed.problem] } };
  try {
    const [vault, brief] = await Promise.all([confirmedFacts(db, userId), getBrief(db, userId)]);
    const profile = ProfileInput.safeParse(brief?.data);
    const targetRole = profile.success ? profile.data.targetRole : "";
    const avoid = [...targetCompanies(vault), ...(profile.success && profile.data.privateSearch && targetRole ? [targetRole] : [])];
    const facts = factsFor("comment", vault, { avoid });
    const goal = COMMENT_GOALS.find((g) => g === input.goal) ?? defaultGoal(profile.success ? profile.data.bucket : undefined);
    const run = { selection: input.selection, goal, reaction: input.reaction, author: input.author, targetRole, facts };

    // Nothing to say it with: answer without spending a generation (AE2a).
    if (!input.reaction.trim() && facts.length === 0) {
      const out = await writeComments(run);
      return out.kind === "skip"
        ? { status: 200, json: { status: "skip", reason: out.reason, why: out.why, author: out.author, goal } }
        : { status: 400, json: { error: "Invalid request." } };
    }
    if (!(await takeDaily(db, userId, "comment", DAILY_COMMENTS))) {
      return { status: 429, json: { error: "That's today's comments. A few thoughtful ones beat many.", code: "daily_cap" } };
    }
    const out = await writeComments(run);
    if (out.kind === "refused") return { status: 400, json: { status: "refused", problem: out.problem, error: out.message } };
    if (out.kind === "skip") {
      await count(db, "comment_skipped", `${goal}:skip_${out.reason}`);
      return { status: 200, json: { status: "skip", reason: out.reason, why: out.why, author: out.author, goal } };
    }
    for (const o of out.options) await count(db, "comment_generated", `${goal}:${o.angle}`);
    // Each option carries a signed receipt: the log accepts only that, so nothing the client invents is stored (KTD9).
    // Without a signing secret the options still work; they just cannot be logged.
    const options = out.options.map((o) => {
      try {
        return { ...o, receipt: signReceipt({ userId, authorName: out.author?.name ?? "", authorHeadline: out.author?.headline ?? "", body: o.body, goal, angle: o.angle, source }) };
      } catch { return o; }
    });
    return { status: 200, json: { status: "options", goal, author: out.author, selectionKind: out.selectionKind, options, dropped: out.dropped } };
  } catch (err) {
    // Code and status only: never the selection, the reaction or the author (KTD1).
    return { status: err instanceof LlmError && err.status === 429 ? 429 : 503, json: { error: "Writing comments is unavailable right now." } };
  }
}

export { DAILY_COMMENTS };
