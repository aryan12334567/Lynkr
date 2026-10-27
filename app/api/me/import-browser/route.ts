import { z } from "zod";
import { accountContext, noCloud, StoryFactInput } from "@/lib/account";
import { readJson } from "@/lib/http";
import { getBrief, listFacts, saveBrief, saveFacts } from "@/lib/db";
import { ProfileInput } from "@/lib/schemas";

const Body = z.object({ profile: ProfileInput.nullable().default(null), facts: z.array(StoryFactInput).max(60).default([]) });

/**
 * First sign-in: move what's in this browser into the account. Newest edit wins for each fact;
 * the reply lists the facts where the account's copy was newer, so the person can review them.
 * The brief is copied only if the account has none yet.
 */
export async function POST(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 96 * 1024);
  if ("error" in read) return read.error;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Couldn't read this browser's data." }, { status: 400 });
  const { profile, facts } = parsed.data;
  if (profile && !(await getBrief(ctx.db, ctx.userId))) await saveBrief(ctx.db, ctx.userId, profile);
  const before = new Map((await listFacts(ctx.db, ctx.userId)).map((f) => [f.id, f]));
  const { saved, older } = await saveFacts(ctx.db, ctx.userId, facts);
  const conflicts = older
    .map((id) => ({ id, account: before.get(id)?.text ?? "", browser: facts.find((f) => f.id === id)?.text ?? "" }))
    .filter((c) => c.account !== c.browser);
  return Response.json({ saved, conflicts, facts: await listFacts(ctx.db, ctx.userId) });
}
