import { accountContext } from "@/lib/account";
import { getBrief, listAnswers, listFacts } from "@/lib/db";

/**
 * The signed-in person's saved context: brief, Story Vault and interview answers.
 * { cloud: false } means it isn't stored in the account yet, so the browser copy is used.
 */
export async function GET(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return Response.json({ cloud: false });
  const [brief, facts, answers] = await Promise.all([
    getBrief(ctx.db, ctx.userId),
    listFacts(ctx.db, ctx.userId),
    ctx.settings.saveAnswers ? listAnswers(ctx.db, ctx.userId) : Promise.resolve([]),
  ]);
  return Response.json({ cloud: true, settings: ctx.settings, brief: brief?.data ?? null, briefVersion: brief?.version ?? 0, facts, answers });
}
