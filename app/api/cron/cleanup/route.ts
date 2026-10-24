import { cleanup, cronAuthorized } from "@/lib/cleanup";
import { cloudReady, getDb } from "@/lib/db";

/**
 * Daily (vercel.json): removes Lynkr data for accounts inactive for 12 months.
 * Needs "Authorization: Bearer $CRON_SECRET". Add ?dryRun=1 to count without deleting.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Not allowed." }, { status: 401 });
  if (!(await cloudReady())) return Response.json({ users: 0, rows: 0, dryRun: true, note: "account storage not set up" });
  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const result = await cleanup(getDb(), { dryRun });
  console.info(JSON.stringify({ lynkr_cleanup: result }));
  return Response.json(result);
}
