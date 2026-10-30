import { z } from "zod";
import { requireLicense } from "@/lib/billing";
import { accountContext } from "@/lib/account";
import { getBrief, saveBrief } from "@/lib/db";
import { readJson } from "@/lib/http";
import { GOAL_IDS } from "@/lib/outreach/goals";

export async function GET(req: Request) {
  const gate = await requireLicense(req); if (gate) return gate;
  const ctx = await accountContext(req); if (!ctx) return Response.json({ error: "Sign in to use outreach." }, { status: 401 });
  const brief = await getBrief(ctx.db, ctx.userId);
  const outreach = (brief?.data as { outreach?: { goals?: unknown } } | undefined)?.outreach;
  const goals = z.array(z.enum(GOAL_IDS)).safeParse(outreach?.goals);
  return Response.json({ goals: goals.success ? goals.data : [] });
}
export async function PUT(req: Request) {
  const gate = await requireLicense(req); if (gate) return gate;
  const ctx = await accountContext(req); if (!ctx) return Response.json({ error: "Sign in to use outreach." }, { status: 401 });
  const read = await readJson(req, 2048); if ("error" in read) return read.error;
  const parsed = z.object({ goals: z.array(z.enum(GOAL_IDS)).max(10) }).strict().safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Choose valid goals." }, { status: 400 });
  const brief = await getBrief(ctx.db, ctx.userId);
  const data = (brief?.data ?? {}) as Record<string, unknown>;
  const old = data.outreach && typeof data.outreach === "object" ? data.outreach : {};
  await saveBrief(ctx.db, ctx.userId, { ...data, outreach: { ...old, goals: [...new Set(parsed.data.goals)] } });
  return Response.json({ goals: [...new Set(parsed.data.goals)] });
}
