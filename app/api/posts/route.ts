import { z } from "zod";
import { isMonday } from "@/lib/calendar/plan-store";
import { readJson } from "@/lib/http";
import { createPost, deletePost, getPost, getVersion, listAnswers, listPosts, listVersions, setCurrentVersion, updatePost, POST_TYPES, type PostStatus } from "@/lib/posts/db";
import { notFound, postsGate } from "@/lib/posts/gate";
import { nextStep } from "@/lib/posts/interview";
import { postForSlot, slotsForWeek } from "@/lib/posts/slots";
import { saveText } from "@/lib/posts/serve";

export const maxDuration = 30;

const BODY_MAX = 16 * 1024;
const Type = z.enum(POST_TYPES);
const Mode = z.enum(["quick", "thorough"]);
const Brief = z.string().trim().max(400);
const Create = z.union([
  z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), slot: z.number().int().min(0).max(9), type: Type.optional(), brief: Brief.optional(), mode: Mode.optional() }).strict(),
  z.object({ type: Type, brief: Brief, mode: Mode.optional() }).strict(),
]);
const Patch = z.object({
  id: z.string().min(1).max(60),
  brief: Brief.optional(),
  type: Type.optional(),
  mode: Mode.optional(),
  /** Only draft and approved can be set from here: scheduling and publishing belong to later steps. */
  status: z.enum(["draft", "approved"]).optional(),
  /** A hand edit: saved as a new version. */
  text: z.string().trim().min(1).max(6000).optional(),
  /** Go back to an earlier version: it becomes current and every version stays. */
  versionId: z.string().min(1).max(60).optional(),
}).strict();
/** Statuses where the person's text and brief may still change. */
const EDITABLE: PostStatus[] = ["draft", "approved", "scheduled"];

/**
 * GET /api/posts                  the person's latest posts (any week and free-writes)
 * GET /api/posts?week=YYYY-MM-DD  that week's slots from the plan, each with its post once opened, and `others`
 * GET /api/posts?id=<id>          one post with its answers, versions and the interview's next step
 * Needs only a session: reading your own posts is free.
 */
export async function GET(req: Request) {
  const gate = await postsGate(req, { paid: false });
  if ("error" in gate) return gate.error;
  const { db, userId } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const id = q.get("id");
  if (id) {
    const post = await getPost(db, userId, id.slice(0, 60));
    if (!post) return notFound();
    const [answers, versions] = await Promise.all([listAnswers(db, userId, post.id), listVersions(db, userId, post.id)]);
    return Response.json({ post, answers, versions, interview: nextStep({ type: post.type, brief: post.brief, mode: post.mode, answers: answers.map((a) => ({ key: a.key, answer: a.answer })) }) });
  }
  const week = q.get("week");
  if (week) {
    if (!isMonday(week)) return Response.json({ error: "That is not a Monday." }, { status: 400 });
    return Response.json(await slotsForWeek(db, userId, week));
  }
  return Response.json({ posts: await listPosts(db, userId) });
}

/** Open a plan slot ({ weekStart, slot }) or start a free-write post ({ type, brief }). Opening a slot twice returns the same post. */
export async function POST(req: Request) {
  const gate = await postsGate(req, { paid: true });
  if ("error" in gate) return gate.error;
  const read = await readJson(req, BODY_MAX);
  if ("error" in read) return read.error;
  const body = Create.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Pick a type and a short brief, or a slot of this week." }, { status: 400 });
  const { db, userId } = gate.ctx;
  if ("slot" in body.data) {
    if (!isMonday(body.data.weekStart)) return Response.json({ error: "That is not a Monday." }, { status: 400 });
    const post = await postForSlot(db, userId, body.data.weekStart, body.data.slot, { type: body.data.type, brief: body.data.brief });
    if (!post) return Response.json({ error: "There is no post in that slot of the plan." }, { status: 404 });
    return Response.json({ post }, { status: 201 });
  }
  const post = await createPost(db, userId, { type: body.data.type, brief: body.data.brief, mode: body.data.mode ?? "quick" });
  return Response.json({ post }, { status: 201 });
}

/** Edit the brief, type or mode; set draft or approved; save a hand edit as a new version (with its rules check); or go back to a version. */
export async function PATCH(req: Request) {
  const gate = await postsGate(req, { paid: true });
  if ("error" in gate) return gate.error;
  const read = await readJson(req, BODY_MAX);
  if ("error" in read) return read.error;
  const body = Patch.safeParse(read.body);
  if (!body.success || (body.data.text !== undefined && body.data.versionId !== undefined)) return Response.json({ error: "Check what you are changing." }, { status: 400 });
  const { db, userId } = gate.ctx;
  const p = body.data;
  const post = await getPost(db, userId, p.id);
  if (!post) return notFound();
  if (!EDITABLE.includes(post.status)) return Response.json({ error: "This post can't be changed now." }, { status: 409 });
  if (p.status === "approved" && !post.currentVersionId && p.text === undefined && p.versionId === undefined) return Response.json({ error: "Choose a version before you approve." }, { status: 409 });
  // What is scheduled is what was approved: no new text, version or status until the schedule is cancelled.
  if (post.status === "scheduled" && (p.status || p.text !== undefined || p.versionId !== undefined)) return Response.json({ error: "Cancel the schedule to edit this post." }, { status: 409 });

  if (p.versionId !== undefined && !(await getVersion(db, userId, post.id, p.versionId.slice(0, 60)))) return notFound();
  let updated = (p.brief !== undefined || p.type || p.mode || p.status ? await updatePost(db, userId, post.id, { brief: p.brief, type: p.type, mode: p.mode, status: p.status }) : post) ?? post;
  if (p.versionId !== undefined) updated = (await setCurrentVersion(db, userId, post.id, p.versionId)) ?? updated;
  if (p.text !== undefined) {
    const saved = await saveText(db, userId, post.id, p.text);
    if (saved.kind !== "saved") return saved.kind === "locked" ? Response.json({ error: "Cancel the schedule to edit this post." }, { status: 409 }) : notFound();
    return Response.json({ post: await getPost(db, userId, post.id), version: saved.version, problems: saved.problems });
  }
  return Response.json({ post: updated });
}

/** DELETE /api/posts?id=<id>: the post, its answers and every version. */
export async function DELETE(req: Request) {
  const gate = await postsGate(req, { paid: true });
  if ("error" in gate) return gate.error;
  const id = new URL(req.url).searchParams.get("id")?.slice(0, 60);
  if (!id) return Response.json({ error: "Say which post." }, { status: 400 });
  const { db, userId } = gate.ctx;
  const post = await getPost(db, userId, id);
  if (!post) return notFound();
  if (post.status === "publishing") return Response.json({ error: "This post is publishing right now." }, { status: 409 });
  await deletePost(db, userId, id);
  return Response.json({ ok: true });
}
