import { accountContext, requireAccountForFree } from "@/lib/account";
import { deleteAnswers, listAnswers, listFacts, saveBrief, takeDaily, upsertAnswer, upsertAnswerFacts } from "@/lib/db";
import { BODY_LIMIT, readJson } from "@/lib/http";
import { judgeAnswer } from "@/lib/interview/judge";
import { applyAnswer, briefFrom, nextStep, progress, validateAnswer, type Answer } from "@/lib/interview/engine";
import { profileFrom } from "@/lib/interview/profile";
import { checkLimits } from "@/lib/limit";
import { Interview2Request } from "@/lib/schemas";

export const maxDuration = 60;

/** Free with a signed-in account (decision 1): answers and follow-ups per person per day. */
const DAILY_ANSWERS = 150;

/**
 * Interview v2 (build plan Part 3). Saves one answer (or nothing, to get the current step), then
 * returns the next step from the question bank. The server picks every question; the model only
 * reflects, judges vagueness and phrases a follow-up. Signed in with account storage, answers and
 * facts are saved to the account after every answer (re-saving updates, never duplicates) and the
 * browser's copy is ignored. Answer text is never logged.
 */
export async function POST(req: Request) {
  const gate = await requireAccountForFree(req);
  if ("error" in gate) return gate.error;
  const read = await readJson(req, BODY_LIMIT.interview2);
  if ("error" in read) return read.error;
  const parsed = Interview2Request.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Please check your answer and try again." }, { status: 400 });
  const { bucket, answer, history, elapsedSecs, imported } = parsed.data;

  const ctx = gate.user ? await accountContext(req) : null;
  const fromAccount = ctx && ctx.settings.saveAnswers;
  let answers: Answer[] = fromAccount ? await listAnswers(ctx.db, ctx.userId) : history;
  let reflection = "";
  let facts: Awaited<ReturnType<typeof judgeAnswer>>["facts"] = [];

  if (answer) {
    const invalid = validateAnswer(bucket, answers, answer);
    if (invalid) return Response.json({ error: invalid }, { status: 400 });
    const limited = checkLimits(req, "interview2");
    if (limited) return Response.json({ error: limited }, { status: 429 });
    if (ctx && !(await takeDaily(ctx.db, ctx.userId, "interview_answer", DAILY_ANSWERS))) {
      return Response.json({ error: "That's a lot of answers for one day. Your progress is saved; carry on tomorrow." }, { status: 429 });
    }
    const draft: Answer = { ...answer, text: answer.status === "answered" ? answer.text.trim() : "" };
    const judged = await judgeAnswer(bucket, answers, draft);
    answers = applyAnswer(answers, answer, {
      at: new Date().toISOString(),
      ...(judged.vague !== undefined ? { vague: judged.vague } : {}),
      ...(judged.should !== undefined ? { should: judged.should } : {}),
      ...(judged.followUpText ? { followUpText: judged.followUpText } : {}),
    });
    reflection = answer.status === "answered" ? judged.reflection : "";
    facts = judged.facts;
    if (ctx) {
      const saved = answers.find((a) => a.qid === answer.qid && a.attempt === answer.attempt)!;
      if (ctx.settings.saveAnswers) {
        await upsertAnswer(ctx.db, ctx.userId, saved);
        if (answer.attempt === 0) await deleteAnswers(ctx.db, ctx.userId, answers, answer.qid);
      }
      await upsertAnswerFacts(ctx.db, ctx.userId, answer.qid, answer.attempt, facts);
      const profile = profileFrom(bucket, answers);
      if (profile) await saveBrief(ctx.db, ctx.userId, profile);
    }
  }

  return Response.json({
    next: nextStep(bucket, answers, { elapsedSecs }),
    reflection,
    facts,
    answers,
    progress: progress(bucket, answers, imported),
    brief: briefFrom(bucket, answers),
    ...(ctx ? { vault: await listFacts(ctx.db, ctx.userId) } : {}),
  });
}
