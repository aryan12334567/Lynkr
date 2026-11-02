import { z } from "zod";
import { readJson } from "@/lib/http";
import { DraftRequest } from "@/lib/schemas";
import { runDraft } from "@/lib/outreach/draft";
import { extensionAuth, extJson, preflight } from "@/lib/outreach/ext-auth";

export const maxDuration = 60;
export const OPTIONS = preflight;

/** The extension may leave the channel out; it then drafts a LinkedIn message. */
const Body = DraftRequest.extend({ channel: DraftRequest.shape.channel.default("linkedin_message") }).strict();

/**
 * The same engine as the web app (`runDraft`): the evidence, the playbook, the checks, the notes left and the
 * daily cap (one spend per model call, a plain 429) all live there.
 */
export async function POST(req: Request) {
  const auth = await extensionAuth(req);
  if ("error" in auth) return auth.error;
  const read = await readJson(req, 16384);
  if ("error" in read) return extJson(req, { error: "Invalid request." }, read.error.status);
  const body = Body.safeParse(read.body);
  if (!body.success) return extJson(req, { error: "Invalid request." }, 400);
  try {
    const out = await runDraft(auth.db, auth.userId, body.data as z.infer<typeof DraftRequest>);
    return extJson(req, out.body, out.status);
  } catch {
    return extJson(req, { error: "Drafting is unavailable right now." }, 503);
  }
}
