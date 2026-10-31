import { accountContext } from "@/lib/account";
import { requireLicense } from "@/lib/billing";
import { readJson } from "@/lib/http";
import { BriefBody, runBrief } from "@/lib/outreach/brief";

/** User-scoped search, confirmation and extraction on one route. Raw source text is never stored. */
export async function POST(req: Request) {
  const denied = await requireLicense(req); if (denied) return denied;
  const ctx = await accountContext(req); if (!ctx) return Response.json({ error: "Please sign in first." }, { status: 401 });
  const read = await readJson(req, 32 * 1024); if ("error" in read) return read.error;
  const parsed = BriefBody.safeParse(read.body); if (!parsed.success) return Response.json({ error: "Please check your request." }, { status: 400 });
  const out = await runBrief(ctx.db, ctx.userId, parsed.data);
  return Response.json(out.body, { status: out.status });
}
