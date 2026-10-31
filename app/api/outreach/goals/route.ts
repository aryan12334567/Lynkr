import { z } from "zod";
import { requireLicense } from "@/lib/billing";
import { accountContext } from "@/lib/account";
import { getBrief, confirmedFacts } from "@/lib/db";
import { readJson } from "@/lib/http";
import { GOAL_IDS, readOutreachGoals, saveOutreachGoals, unansweredGoalDetails, type OutreachGoal } from "@/lib/outreach/goals";

/** Saved goals, plus for each the questions not answered yet (a detail already confirmed as a fact is not asked again). */
export async function GET(req: Request) {
  const gate = await requireLicense(req); if (gate) return gate;
  const ctx = await accountContext(req); if (!ctx) return Response.json({ error: "Sign in to use outreach." }, { status: 401 });
  const goals = await readOutreachGoals(ctx.db, ctx.userId);
  const facts = goals.length ? await confirmedFacts(ctx.db, ctx.userId) : [];
  const unanswered = Object.fromEntries(goals.map((g) => [g, unansweredGoalDetails(g, facts)])) as Record<OutreachGoal, ReturnType<typeof unansweredGoalDetails>>;
  const brief = await getBrief(ctx.db, ctx.userId);
  return Response.json({ goals, unanswered, version: brief?.version ?? 0 });
}

const Body = z.object({
  goals: z.array(z.enum(GOAL_IDS)).max(10),
  details: z.array(z.object({ goal: z.enum(GOAL_IDS), key: z.string().min(1).max(40), answer: z.string().trim().min(1).max(300) }).strict()).max(30).optional(),
}).strict();

export async function PUT(req: Request) {
  const gate = await requireLicense(req); if (gate) return gate;
  const ctx = await accountContext(req); if (!ctx) return Response.json({ error: "Sign in to use outreach." }, { status: 401 });
  const read = await readJson(req, 8192); if ("error" in read) return read.error;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Choose valid goals." }, { status: 400 });
  try {
    const saved = await saveOutreachGoals(ctx.db, ctx.userId, parsed.data.goals, parsed.data.details ?? []);
    return Response.json(saved);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Choose valid goals." }, { status: 400 });
  }
}
