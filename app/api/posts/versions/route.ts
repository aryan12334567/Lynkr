import { z } from "zod";
import { giveBackDaily, takeDaily } from "@/lib/db";
import { readJson } from "@/lib/http";
import { LlmError } from "@/lib/llm";
import { getPost } from "@/lib/posts/db";
import { notFound, postsGate } from "@/lib/posts/gate";
import { generateForPost, refineForPost } from "@/lib/posts/serve";

export const maxDuration = 60;

/** Drafting and refining share one daily cap per person. */
const DAILY_POST_DRAFTS = 20;
const KIND = "post_draft";

const Body = z.discriminatedUnion("mode", [
  z.object({ id: z.string().min(1).max(60), mode: z.literal("generate") }).strict(),
  z.object({ id: z.string().min(1).max(60), mode: z.literal("refine"), versionId: z.string().min(1).max(60).optional(), instruction: z.string().max(300) }).strict(),
]);

/**
 * POST /api/posts/versions (posts plan U4, U5). `mode: "generate"` writes two or three complete versions from the
 * interview's answers; `mode: "refine"` changes one version by an instruction. Both store every result as a new version.
 * Answers: `result` is "versions", "need_more" (one targeted question, or a stop), "refined", or "rejected".
 */
export async function POST(req: Request) {
  const gate = await postsGate(req, { paid: true });
  if ("error" in gate) return gate.error;
  const read = await readJson(req, 16 * 1024);
  if ("error" in read) return read.error;
  const body = Body.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Say which post, and what to change (up to 300 characters)." }, { status: 400 });
  const { db, userId } = gate.ctx;
  const post = await getPost(db, userId, body.data.id);
  if (!post) return notFound();
  if (!["draft", "approved", "scheduled"].includes(post.status)) return Response.json({ error: "This post can't be changed now." }, { status: 409 });
  if (body.data.mode === "refine" && !body.data.instruction.trim()) return Response.json({ error: "Tell me what to change, for example: shorter." }, { status: 400 });

  if (!(await takeDaily(db, userId, KIND, DAILY_POST_DRAFTS))) {
    return Response.json({ error: "You've used today's drafts. Come back tomorrow." }, { status: 429 });
  }
  try {
    if (body.data.mode === "generate") {
      const out = await generateForPost(db, userId, post.id);
      if (out.kind === "not_found") return notFound();
      if (out.kind === "need_more") return Response.json({ result: "need_more", message: out.message, question: out.question, stop: out.stop });
      return Response.json({ result: "versions", versions: out.versions, dropped: out.dropped, note: out.note, post: await getPost(db, userId, post.id) });
    }
    const out = await refineForPost(db, userId, post.id, { versionId: body.data.versionId, instruction: body.data.instruction });
    if (out.kind === "not_found") return notFound();
    if (out.kind === "locked") return Response.json({ error: "Cancel the schedule to edit this post." }, { status: 409 });
    if (out.kind === "invalid") return Response.json({ error: out.message }, { status: 400 });
    if (out.kind === "rejected") return Response.json({ result: "rejected", message: out.message, problems: out.problems });
    return Response.json({ result: "refined", version: out.version, post: await getPost(db, userId, post.id) });
  } catch (err) {
    // The provider failed, so the person got nothing: today's try is returned. A refusal of their own text (4xx) is not.
    if (!(err instanceof LlmError) || err.status >= 429) await giveBackDaily(db, userId, KIND).catch(() => {});
    if (err instanceof LlmError) return Response.json({ error: err.message }, { status: err.status });
    return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
