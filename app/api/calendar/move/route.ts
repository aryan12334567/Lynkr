import { z } from "zod";
import { accountContext, noCloud, unauthorized } from "@/lib/account";
import { sessionUser } from "@/lib/auth";
import { requireLicense } from "@/lib/billing";
import { calendarVersion } from "@/lib/calendar/flags";
import { moveItem } from "@/lib/calendar/move";
import { readJson } from "@/lib/http";

export const maxDuration = 30;

const Move = z.object({
  op_id: z.string().min(8).max(100),
  id: z.string().min(1).max(120),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
}).strict();

/**
 * POST /api/calendar/move (calendar plan KTD5). A session is required. Moving a plan slot needs nothing more, so free
 * accounts can move theirs (KD6). Moving a post or an outreach step is paid: the route asks the licence check and returns
 * its 402, because the owners' library functions have no request to check. Every move carries one `op_id`; sending it
 * twice moves once.
 */
export async function POST(req: Request) {
  if (calendarVersion() !== "v2") return Response.json({ error: "Not found." }, { status: 404 });
  if (!(await sessionUser(req))) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 2 * 1024);
  if ("error" in read) return read.error;
  const parsed = Move.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Check the item and the new date." }, { status: 400 });
  if (!parsed.data.id.startsWith("plan:")) {
    const denied = await requireLicense(req);
    if (denied) return denied;
  }
  const out = await moveItem(ctx.db, ctx.userId, parsed.data, { paid: !parsed.data.id.startsWith("plan:") });
  return Response.json(out.body, { status: out.status });
}
