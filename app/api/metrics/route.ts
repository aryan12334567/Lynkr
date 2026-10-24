import { readJson } from "@/lib/http";
import { clientIp } from "@/lib/limit";
import { MetricInput, recordMetric } from "@/lib/metrics";

/** Count-only events from the browser. Strict schema: anything that isn't a count is refused. */
const hits = new Map<string, { n: number; reset: number }>();

function allowed(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    if (hits.size > 10_000) hits.clear();
    hits.set(ip, { n: 1, reset: now + 60 * 60 * 1000 });
    return true;
  }
  if (h.n >= 60) return false;
  h.n += 1;
  return true;
}

export async function POST(req: Request) {
  if (!allowed(clientIp(req))) return new Response(null, { status: 429 });
  const read = await readJson(req, 1024);
  if ("error" in read) return read.error;
  const parsed = MetricInput.safeParse(read.body);
  if (!parsed.success) return Response.json({ error: "Invalid event." }, { status: 400 });
  await recordMetric(parsed.data);
  return new Response(null, { status: 204 });
}
