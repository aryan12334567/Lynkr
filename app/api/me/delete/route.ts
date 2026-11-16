import { z } from "zod";
import { accountContext, noCloud } from "@/lib/account";
import { readJson } from "@/lib/http";
import { deleteAll } from "@/lib/db";
import { deactivateLicense } from "@/lib/billing";
import { removeLink } from "@/lib/license-link";

const Body = z.object({ confirm: z.literal("delete") });

/** "Delete my data": every Lynkr row for this account. Signing in still works; the vault starts empty. */
export async function POST(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 256);
  if ("error" in read) return read.error;
  if (!Body.safeParse(read.body).success) return Response.json({ error: "Please confirm first." }, { status: 400 });
  // A linked license key holds a device slot at the payment provider. Give it back before the row that names it is
  // deleted; a failure here never stops the deletion.
  try {
    const link = await removeLink(ctx.db, ctx.userId);
    if (link) await deactivateLicense(link.key, link.instanceId);
  } catch { /* the table may not exist yet, or the provider is down: the data is still deleted below */ }
  const counts = await deleteAll(ctx.db, ctx.userId);
  return Response.json({ deleted: Object.values(counts).reduce((a, b) => a + b, 0) });
}
