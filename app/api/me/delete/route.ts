import { z } from "zod";
import { accountContext, noCloud } from "@/lib/account";
import { readJson } from "@/lib/http";
import { deleteAll } from "@/lib/db";

const Body = z.object({ confirm: z.literal("delete") });

/** "Delete my data": every Lynkr row for this account. Signing in still works; the vault starts empty. */
export async function POST(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 256);
  if ("error" in read) return read.error;
  if (!Body.safeParse(read.body).success) return Response.json({ error: "Please confirm first." }, { status: 400 });
  const counts = await deleteAll(ctx.db, ctx.userId);
  return Response.json({ deleted: Object.values(counts).reduce((a, b) => a + b, 0) });
}
