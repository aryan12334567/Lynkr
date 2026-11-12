import { accountContext, noCloud, unauthorized } from "@/lib/account";
import { requireLicense } from "@/lib/billing";
import { sessionUser } from "@/lib/auth";
import { readJson } from "@/lib/http";
import { CommentOptionsRequest } from "@/lib/schemas";
import { commenterSwitch } from "@/lib/comment/flags";
import { generateForUser } from "@/lib/comment/serve";

export const maxDuration = 60;

/**
 * The web helper's version of the extension route (Commenter plan R15): the same options, goal, reaction and checks,
 * for a signed-in person who pastes the post. License-key-only and browser-only people keep `/api/comment`.
 */
export async function POST(req: Request) {
  if (commenterSwitch() !== "on") return Response.json({ error: "Comments aren't switched on yet." }, { status: 404 });
  if (!(await sessionUser(req))) return unauthorized();
  const locked = await requireLicense(req);
  if (locked) return locked;
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 16384);
  if ("error" in read) return read.error;
  const body = CommentOptionsRequest.safeParse(read.body);
  if (!body.success) return Response.json({ error: "Paste at least a sentence of the post, and keep your reaction under 500 characters." }, { status: 400 });
  const out = await generateForUser(ctx.db, ctx.userId, body.data, "web");
  return Response.json(out.json, { status: out.status });
}
