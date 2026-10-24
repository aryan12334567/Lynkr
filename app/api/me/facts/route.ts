import { z } from "zod";
import { accountContext, noCloud, StoryFactInput } from "@/lib/account";
import { readJson } from "@/lib/http";
import { deleteFact, listFacts, saveFacts } from "@/lib/db";

const Put = z.object({ facts: z.array(StoryFactInput).max(60) });
const Del = z.object({ id: z.string().trim().min(1).max(12) });

/** Save Story Vault edits. Newest edit wins; facts where the account had a newer copy come back in `older`. */
export async function PUT(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 64 * 1024);
  if ("error" in read) return read.error;
  const parsed = Put.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Please check your facts and try again." }, { status: 400 });
  const { older } = await saveFacts(ctx.db, ctx.userId, parsed.data.facts);
  return Response.json({ facts: await listFacts(ctx.db, ctx.userId), older });
}

export async function DELETE(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 1024);
  if ("error" in read) return read.error;
  const parsed = Del.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  await deleteFact(ctx.db, ctx.userId, parsed.data.id);
  return Response.json({ facts: await listFacts(ctx.db, ctx.userId) });
}
