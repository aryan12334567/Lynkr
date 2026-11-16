import { cronAuthorized } from "@/lib/cleanup";
import { cloudReady, getDb } from "@/lib/db";
import { runDue } from "@/lib/posts/run";

export const maxDuration = 60;

/**
 * Any pinger calls this every few minutes with "Authorization: Bearer $CRON_SECRET". It claims the due auto posts and
 * publishes each once (lib/posts/run.ts). With LYNKR_AUTOPUBLISH off it does nothing. Returns counts only.
 */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "Not allowed." }, { status: 401 });
  const zero = { claimed: 0, published: 0, failed: 0, unknown: 0, late: 0 };
  if (!(await cloudReady())) return Response.json(zero);
  try {
    const counts = await runDue({ db: getDb() });
    console.info(JSON.stringify({ lynkr_posts_run: counts }));
    return Response.json(counts);
  } catch {
    return Response.json({ error: "The run failed." }, { status: 500 });
  }
}
