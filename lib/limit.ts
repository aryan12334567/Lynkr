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

export type LimitKind = "interview" | "interview2" | "generate" | "enrich" | "checkout" | "license";

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
  if (kind === "checkout") {
    // Opening a checkout costs nothing but creates a record at Dodo: 5 per visitor per hour, 200 per day in total.
    if (!hit(`ip:checkout:${clientIp(req)}`, 5, HOUR)) return "Too many checkout attempts. Please try again later.";
    if (!hit("global:checkout:day", 200, DAY)) return "Checkout is busy today. Please try again tomorrow.";
    return null;
  }
  if (kind === "license") {
    // Unlocking with a key: enough for typos and a few devices, too few to guess keys.
    if (!hit(`ip:license:${clientIp(req)}`, 30, HOUR)) return "Too many attempts. Please try again in an hour.";
    return null;
  }
  // Interview v2 saves every answer and follow-up: about 25 to 40 calls per interview.
  const perHour = kind === "interview2" ? 120 : kind === "interview" ? 40 : 6;
  const dailyCap = Number(process.env.LYNKR_DAILY_CAP) || 400;
  if (!hit(`ip:${kind}:${clientIp(req)}`, perHour, HOUR)) {
    return "You have used a lot of requests this hour. Please try again later.";
  }
  if (!hit("global:day", dailyCap, DAY)) {
    return "This free demo has reached its daily limit. Please come back tomorrow.";
  }
  return null;
}
