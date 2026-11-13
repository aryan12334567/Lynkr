import { accountContext, noCloud, unauthorized } from "@/lib/account";
import { sessionUser } from "@/lib/auth";
import { requireLicense } from "@/lib/billing";
import { commenterSwitch } from "@/lib/comment/flags";
import { calendarVersion } from "@/lib/calendar/flags";
import { calendarFeed } from "@/lib/calendar/server";
import { outreachVersion } from "@/lib/outreach/flags";

export const maxDuration = 30;

/**
 * The Calendar feed (calendar plan U3, KTD2). GET ?from=YYYY-MM-DD&to=YYYY-MM-DD returns every item in the window,
 * clamped to one month back and five ahead. A session is enough: the Calendar is free (KD6, R25). Whether the account
 * can move or open post and outreach items is worked out here and carried on each item. A license-key-only request has no
 * session and gets 401, and its browser keeps the local plan (R22).
 */
export async function GET(req: Request) {
  if (calendarVersion() !== "v2") return Response.json({ error: "Not found." }, { status: 404 });
  if (!(await sessionUser(req))) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const q = new URL(req.url).searchParams;
  const paid = (await requireLicense(req)) === null;
  const feed = await calendarFeed(ctx.db, ctx.userId, {
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    paid,
    switches: { outreach: outreachVersion() === "v2", commenter: commenterSwitch() === "on", posts: false },
  });
  return Response.json({ ...feed, paid }, { headers: { "Cache-Control": "no-store" } });
}
