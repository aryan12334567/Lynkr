import { z } from "zod";
import { readJson } from "@/lib/http";
import { postsGate } from "@/lib/posts/gate";
import { markPosted, setSchedule } from "@/lib/posts/schedule";

export const maxDuration = 30;

const Body = z.union([
  z.object({ id: z.string().min(1).max(60), at: z.string().max(40).nullable() }).strict(),
  z.object({ id: z.string().min(1).max(60), markPosted: z.literal(true) }).strict(),
]);

/**
 * POST { id, at: ISO string | null }  schedule (or move) an approved post; null cancels the schedule. -> { post }
 * POST { id, markPosted: true }       the person posted it on LinkedIn themselves. -> { post }
 * Scheduling only sets a time and a mode ('manual' reminder or 'auto'); nothing is sent from here.
 */
export async function POST(req: Request) {
  const gate = await postsGate(req, { paid: true });
  if ("error" in gate) return gate.error;
  const read = await readJson(req, 2 * 1024);
  if ("error" in read) return read.error;
  const body = Body.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Say which post and when." }, { status: 400 });
  const { db, userId } = gate.ctx;
  let out;
  if ("markPosted" in body.data) out = await markPosted(db, userId, body.data.id);
  else {
    const at = body.data.at === null ? null : new Date(body.data.at);
    if (at && Number.isNaN(at.getTime())) return Response.json({ error: "Use a real date and time." }, { status: 400 });
    out = await setSchedule(db, userId, body.data.id, at);
  }
  if (!out.ok) return Response.json({ error: out.error, ...(out.problems ? { problems: out.problems } : {}) }, { status: out.status });
  return Response.json({ post: out.post });
}
