import { requireLicense } from "@/lib/billing";
import { accountContext } from "@/lib/account";
import { readJson } from "@/lib/http";
import { DraftRequest } from "@/lib/schemas";
import { composeDrafts, runDraft } from "@/lib/outreach/draft";
import { DEMO_CONTACT_ID } from "@/lib/outreach/ui-demo";

export const maxDuration = 60;

/**
 * Two or three complete versions for one contact and channel, with the note-or-blank advice and the optional
 * "make it stronger" question. Paid (KTD12), scoped to the signed-in user, and capped per day (KTD13): the cap
 * is a 429 with a plain message. The work is in `runDraft`, which the unit tests drive directly.
 */
/**
 * The made-up example person (R37) has no account behind it, so her drafts come from the offline composer: no model,
 * no database, no one's data. Only her fixed details are used; every other contact goes through the checks below.
 */
async function exampleDrafts(req: Request): Promise<Response | null> {
  const text = await req.clone().text().catch(() => "");
  if (text.length > 4096) return null;
  let body: unknown;
  try { body = JSON.parse(text); } catch { return null; }
  if (!body || typeof body !== "object" || (body as { contactId?: unknown }).contactId !== DEMO_CONTACT_ID) return null;
  const parsed = DraftRequest.safeParse({ ...body, contactId: "00000000-0000-4000-8000-000000000000" });
  if (!parsed.success) return Response.json({ error: "Check the contact and channel." }, { status: 400 });
  const d = parsed.data;
  return Response.json(composeDrafts({ goal: "job", relationship: "stranger", channel: d.channel, name: "Priya Nair", role: "Analytics lead", company: "Northwind Analytics", facts: [], noteLimit: d.noteLimit, notesLeft: d.monthlyNotes, tier: "tier_1" }));
}

export async function POST(req: Request) {
  const example = await exampleDrafts(req);
  if (example) return example;
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
