import { z } from "zod";
import { accountContext, noCloud } from "@/lib/account";
import { readJson } from "@/lib/http";
import { touchUser, updateSettings } from "@/lib/db";

const Body = z.object({ consent: z.literal(true).optional(), saveAnswers: z.boolean().optional() });

/** Consent to saving context in the account, and the "save my interview answers" switch. */
export async function PUT(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 1024);
  if ("error" in read) return read.error;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  await updateSettings(ctx.db, ctx.userId, parsed.data);
  return Response.json({ settings: await touchUser(ctx.db, ctx.userId) });
}
