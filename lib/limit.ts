/**
 * Best-effort in-memory limits. They protect the API budget on a single
 * server instance; the real caps are the spend limits set with each provider.
 */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function hit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || "unknown";
}

export type LimitKind = "interview" | "generate" | "enrich";

/** Returns an error message if the request should be refused, else null. */
export function checkLimits(req: Request, kind: LimitKind): string | null {
  if (kind === "enrich") {
    // Job-page imports cost money per run: 5 per visitor per day, and a daily total (APIFY_DAILY_CAP, default 100).
    if (!hit(`ip:enrich:${clientIp(req)}`, Number(process.env.APIFY_PER_VISITOR_DAILY) || 5, DAY)) {
      return "You've imported a lot of pages today. Paste the job description instead.";
    }
    if (!hit("global:enrich:day", Number(process.env.APIFY_DAILY_CAP) || 100, DAY)) {
      return "Today's import limit is used up. Paste the job description instead.";
    }
    return null;
  }
  const perHour = kind === "interview" ? 40 : 6;
  const dailyCap = Number(process.env.LYNKR_DAILY_CAP) || 400;
  if (!hit(`ip:${kind}:${clientIp(req)}`, perHour, HOUR)) {
    return "You have used a lot of requests this hour. Please try again later.";
  }
  if (!hit("global:day", dailyCap, DAY)) {
    return "This free demo has reached its daily limit. Please come back tomorrow.";
  }
  return null;
}
