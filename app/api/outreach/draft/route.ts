import { requireLicense } from "@/lib/billing";
import { accountContext } from "@/lib/account";
import { readJson } from "@/lib/http";
import { DraftRequest } from "@/lib/schemas";
import { runDraft } from "@/lib/outreach/draft";

export const maxDuration = 60;

/**
 * Two or three complete versions for one contact and channel, with the note-or-blank advice and the optional
 * "make it stronger" question. Paid (KTD12), scoped to the signed-in user, and capped per day (KTD13): the cap
 * is a 429 with a plain message. The work is in `runDraft`, which the unit tests drive directly.
 */
export async function POST(req: Request) {
  const locked = await requireLicense(req);
  if (locked) return locked;
  const ctx = await accountContext(req);
  if (!ctx) return Response.json({ error: "Sign in to use outreach." }, { status: 401 });
  const read = await readJson(req, 4096);
  if ("error" in read) return read.error;
  const parsed = DraftRequest.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Check the contact and channel." }, { status: 400 });
  const out = await runDraft(ctx.db, ctx.userId, parsed.data);
  return Response.json(out.body, { status: out.status });
}
