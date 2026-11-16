import { z } from "zod";
import { readJson } from "@/lib/http";
import { addAnswer, getPost, listAnswers, updatePost } from "@/lib/posts/db";
import { notFound, postsGate } from "@/lib/posts/gate";
import { nextStep, THIN } from "@/lib/posts/interview";

export const maxDuration = 30;

const Body = z.object({
  id: z.string().min(1).max(60),
  /** The question being answered. Without it, or with `answer: null`, the call only resumes. */
  key: z.string().min(1).max(40).optional(),
  answer: z.string().max(1500).nullable().optional(),
  mode: z.enum(["quick", "thorough"]).optional(),
  /** "Write it now": ends the interview with the answers so far. */
  writeNow: z.boolean().optional(),
}).strict();

/**
 * POST /api/posts/interview (posts plan U3, KD1). Resume with `answer: null`, or answer the current question with its
 * `key`. The server picks every question; an answer to any other question is not stored (the reply says `stale`). Answers
 * are the person's own words: stored as data and never run as instructions. Paid: it writes.
 */
export async function POST(req: Request) {
  const gate = await postsGate(req, { paid: true });
  if ("error" in gate) return gate.error;
  const read = await readJson(req, 16 * 1024);
  if ("error" in read) return read.error;
  const body = Body.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Check your answer and try again." }, { status: 400 });
  const { db, userId } = gate.ctx;
  let post = await getPost(db, userId, body.data.id);
  if (!post) return notFound();
  if (body.data.mode && body.data.mode !== post.mode) post = (await updatePost(db, userId, post.id, { mode: body.data.mode })) ?? post;
  const current = post;

  const view = async (writeNow: boolean | undefined) => {
    const answers = await listAnswers(db, userId, current.id);
    return { answers, step: nextStep({ type: current.type, brief: current.brief, mode: current.mode, answers: answers.map((a) => ({ key: a.key, answer: a.answer })), writeNow }) };
  };

  let stale = false;
  const text = body.data.answer?.trim();
  if (text) {
    const now = await view(false);
    // The thin-answer question may be asked by the writer when the interview ended early (Write it now), so it is answerable once.
    const isCurrent = now.step.kind === "question" && now.step.question.key === body.data.key;
    const isThin = body.data.key === THIN.key && !now.answers.some((a) => a.key === THIN.key);
    if (isCurrent || isThin) {
      const q = isCurrent && now.step.kind === "question" ? now.step.question : THIN;
      await addAnswer(db, userId, current.id, { key: q.key, question: q.text, answer: text });
    } else stale = true;
  }
  const out = await view(body.data.writeNow);
  return Response.json({ post: current, answers: out.answers, step: out.step, ...(stale ? { stale: true } : {}) });
}
