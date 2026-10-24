import { accountContext, noCloud } from "@/lib/account";
import { exportAll } from "@/lib/db";

/** "Download my data": everything Lynkr holds for this account, as JSON. */
export async function GET(req: Request) {
  const ctx = await accountContext(req);
  if (!ctx) return noCloud();
  const data = { account: { email: ctx.email }, ...(await exportAll(ctx.db, ctx.userId)) };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="lynkr-my-data.json"', "Cache-Control": "no-store" },
  });
}
