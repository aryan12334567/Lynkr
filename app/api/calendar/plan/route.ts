import { accountContext, noCloud, unauthorized } from "@/lib/account";
import { sessionUser } from "@/lib/auth";
import { calendarSummary } from "@/lib/calendar/summary";
import { getWeek, importWeekOnce, isMonday, putWeek } from "@/lib/calendar/plan-store";
import { readJson } from "@/lib/http";

export const maxDuration = 30;

/**
 * The signed-in person's week plan (calendar plan U2). A session is required; there is no paywall, because the free
 * plan lives here too. A license-key-only request has no session and gets 401, and its browser keeps the local plan (R22).
 *   GET  ?week=<Monday>             -> { plan | null, progress, streak }
 *   PUT  { week, plan }             -> replace that week
 *   POST { week, plan }             -> the one-time move from the browser: saved only if the account has no such week
 */
export async function GET(req: Request) {
  if (!(await sessionUser(req))) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const week = new URL(req.url).searchParams.get("week") ?? "";
  if (!isMonday(week)) return Response.json({ error: "Ask for a week by its Monday, like 2026-11-09." }, { status: 400 });
  const plan = await getWeek(ctx.db, ctx.userId, week);
  return Response.json({ plan, ...(await calendarSummary(ctx.db, ctx.userId, week, plan)) });
}

async function write(req: Request, once: boolean): Promise<Response> {
  if (!(await sessionUser(req))) return unauthorized();
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const read = await readJson(req, 64 * 1024);
  if ("error" in read) return read.error;
  const b = (read.body ?? {}) as { week?: unknown; plan?: unknown };
  const week = typeof b.week === "string" ? b.week : "";
  if (!isMonday(week)) return Response.json({ error: "Ask for a week by its Monday, like 2026-11-09." }, { status: 400 });
  if (once) {
    const r = await importWeekOnce(ctx.db, ctx.userId, week, b.plan);
    return Response.json({ plan: r.plan, imported: r.imported });
  }
  if (!(await putWeek(ctx.db, ctx.userId, week, b.plan))) return Response.json({ error: "That plan isn't valid." }, { status: 400 });
  return Response.json({ ok: true });
}

export const PUT = (req: Request) => write(req, false);
export const POST = (req: Request) => write(req, true);
