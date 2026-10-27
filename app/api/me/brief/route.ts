import { z } from "zod";
import { accountContext, noCloud } from "@/lib/account";
import { readJson } from "@/lib/http";
import { saveBrief } from "@/lib/db";
import { ProfileInput } from "@/lib/schemas";

const Body = z.object({ profile: ProfileInput });

/** Save the context brief (a new version only when something changed). */
export async function PUT(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 16 * 1024);
  if ("error" in read) return read.error;
  const parsed = Body.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Please check your basics and try again." }, { status: 400 });
  return Response.json({ version: await saveBrief(ctx.db, ctx.userId, parsed.data.profile) });
}
