import { readJson } from "@/lib/http";
import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";
import { CommentOptionsRequest } from "@/lib/schemas";
import { commenterSwitch } from "@/lib/comment/flags";
import { generateForUser } from "@/lib/comment/serve";

export const maxDuration = 60;
export const OPTIONS = preflight;

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
  const out = await generateForUser(auth.db, auth.userId, body.data, "extension");
  return extJson(req, out.json, out.status);
}
