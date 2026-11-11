import { bumpMetric, confirmedFacts, getBrief, takeDaily, type Db } from "@/lib/db";
import { readJson } from "@/lib/http";
import { LlmError } from "@/lib/llm";
import { factsFor } from "@/lib/facts";
import { targetCompanies } from "@/lib/outreach/ui-goals";
import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";
import { COMMENT_GOALS, CommentOptionsRequest, ProfileInput } from "@/lib/schemas";
import { commenterSwitch } from "@/lib/comment/flags";
import { parseSelection, PROBLEM_TEXT } from "@/lib/comment/parse";
import { DAILY_COMMENTS, defaultGoal } from "@/lib/comment/goal";
import { writeComments } from "@/lib/comment/write";

export const maxDuration = 60;
export const OPTIONS = preflight;

async function count(db: Db, event: string, label: string) {
  try { await bumpMetric(db, event, label.slice(0, 40)); } catch { /* a count is never worth failing a request */ }
}

/**
 * Up to three comment options for the text the person selected on LinkedIn. The selection, the reaction and the
 * author are used for this request only: nothing is stored and nothing is logged (KD5, KTD1).
 */
export async function POST(req: Request) {
  const auth = await extensionAuth(req);
  if ("error" in auth) return auth.error;
  if (commenterSwitch() !== "on") return extJson(req, { error: "Comments aren't switched on yet." }, 404);
  const read = await readJson(req, 16384);
  if ("error" in read) return extJson(req, { error: "Invalid request." }, read.error.status);
  const body = CommentOptionsRequest.safeParse(read.body);
  if (!body.success) return extJson(req, { error: "Invalid request." }, 400);

  // A selection that can't be answered costs nothing: no cap spent, no model call (R4).
  const parsed = parseSelection(body.data.selection);
  if (parsed.problem) return extJson(req, { status: "refused", problem: parsed.problem, error: PROBLEM_TEXT[parsed.problem] }, 400);

  const { db, userId } = auth;
  try {
    const [vault, brief] = await Promise.all([confirmedFacts(db, userId), getBrief(db, userId)]);
    const profile = ProfileInput.safeParse(brief?.data);
    const targetRole = profile.success ? profile.data.targetRole : "";
    const avoid = [...targetCompanies(vault), ...(profile.success && profile.data.privateSearch && targetRole ? [targetRole] : [])];
    const facts = factsFor("comment", vault, { avoid });
    const goal = COMMENT_GOALS.find((g) => g === body.data.goal) ?? defaultGoal(profile.success ? profile.data.bucket : undefined);
    const reaction = body.data.reaction;

    // Nothing to say it with: answer without spending a generation (AE2a).
    if (!reaction.trim() && facts.length === 0) {
      const out = await writeComments({ selection: body.data.selection, goal, reaction, author: body.data.author, targetRole, facts });
      return extJson(req, out.kind === "skip" ? { status: "skip", reason: out.reason, why: out.why, author: out.author, goal } : { error: "Invalid request." }, out.kind === "skip" ? 200 : 400);
    }

    if (!(await takeDaily(db, userId, "comment", DAILY_COMMENTS))) {
      return extJson(req, { error: "That's today's comments. A few thoughtful ones beat many.", code: "daily_cap" }, 429);
    }
    const out = await writeComments({ selection: body.data.selection, goal, reaction, author: body.data.author, targetRole, facts });
    if (out.kind === "refused") return extJson(req, { status: "refused", problem: out.problem, error: out.message }, 400);
    if (out.kind === "skip") {
      await count(db, "comment_skipped", `${goal}:skip_${out.reason}`);
      return extJson(req, { status: "skip", reason: out.reason, why: out.why, author: out.author, goal });
    }
    for (const o of out.options) await count(db, "comment_generated", `${goal}:${o.angle}`);
    return extJson(req, { status: "options", goal, author: out.author, selectionKind: out.selectionKind, options: out.options, dropped: out.dropped });
  } catch (err) {
    // Code and status only: never the selection, the reaction or the author (KTD1).
    if (err instanceof LlmError) return extJson(req, { error: "Writing comments is unavailable right now." }, err.status === 429 ? 429 : 503);
    return extJson(req, { error: "Writing comments is unavailable right now." }, 503);
  }
}
