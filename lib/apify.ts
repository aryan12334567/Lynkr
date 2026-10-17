/**
 * Server-only Apify adapter for "import a job page" (enrichment plan, U2).
 * One fixed, reviewed Actor configuration: apify/cheerio-scraper fetching exactly one page,
 * no link following, with a page function (below) that refuses pages that redirected off
 * the allowlist and strips scripts. The token is read from the server environment and is
 * never sent to the browser, logged, or stored.
 */
import { ALLOWED_HOSTS } from "./sourcePolicy";

export const ACTOR_ID = "apify~cheerio-scraper";
const ACTOR_TIMEOUT_SECS = 60;
const HTTP_TIMEOUT_MS = 75_000;
const MAX_HTML = 1_500_000;

export function apifyToken(): string {
  return process.env.APIFY_API_KEY || process.env.APIFY_TOKEN || "";
}

/** Kill switch: APIFY_ENABLED=0 turns the feature off without removing the key. */
export function apifyEnabled(): boolean {
  return !!apifyToken() && process.env.APIFY_ENABLED !== "0";
}

export type FetchFailure = "config" | "auth" | "quota" | "timeout" | "provider" | "redirected" | "empty";

export class FetchError extends Error {
  category: FetchFailure;
  constructor(category: FetchFailure) {
    super(category);
    this.category = category;
  }
}

/** Runs inside Apify. Reviewed code: one page, no enqueueing, refuses off-list redirects. */
export function pageFunctionSource(): string {
  return `async function pageFunction(context) {
  const { $, request, response } = context;
  const allowed = ${JSON.stringify(ALLOWED_HOSTS)};
  const loaded = new URL(request.loadedUrl || request.url);
  if (!allowed.includes(loaded.hostname)) return { refused: "redirected" };
  $('script:not([type="application/ld+json"]), style, noscript, svg, iframe, img, link, video, audio').remove();
  return { status: response ? response.statusCode : null, html: $.html().slice(0, ${MAX_HTML}) };
}`;
}

export function actorInput(url: string) {
  return {
    startUrls: [{ url }],
    pageFunction: pageFunctionSource(),
    linkSelector: "",
    maxCrawlingDepth: 0,
    maxRequestsPerCrawl: 1,
    maxConcurrency: 1,
    maxRequestRetries: 1,
    proxyConfiguration: { useApifyProxy: true },
    ignoreSslErrors: false,
  };
}

/** Fetch one allowlisted page through Apify. Returns its HTML for extraction; the caller discards it. */
export async function fetchPageViaApify(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const token = apifyToken();
  if (!token || process.env.APIFY_ENABLED === "0") throw new FetchError("config");
  const endpoint = `https://api.apify.com/v2/acts/${ACTOR_ID}/run-sync-get-dataset-items?timeout=${ACTOR_TIMEOUT_SECS}&memory=512&maxItems=1`;
  let res: Response;
  try {
    res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(actorInput(url)),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
  } catch (e) {
    throw new FetchError((e as Error).name === "TimeoutError" || (e as Error).name === "AbortError" ? "timeout" : "provider");
  }
  if (res.status === 401) throw new FetchError("auth");
  if (res.status === 402 || res.status === 429) throw new FetchError("quota");
  if (res.status === 408) throw new FetchError("timeout");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 403 && /limit|usage|credit|plan/i.test(detail)) throw new FetchError("quota");
    throw new FetchError("provider");
  }
  const items = (await res.json().catch(() => null)) as { refused?: string; html?: string; status?: number }[] | null;
  const item = Array.isArray(items) ? items[0] : null;
  if (!item) throw new FetchError("empty");
  if (item.refused) throw new FetchError("redirected");
  if (typeof item.html !== "string" || item.html.length < 200) throw new FetchError("empty");
  if (item.status && item.status >= 400) throw new FetchError("empty");
  return item.html;
}

/** What the user sees for each failure. Each ends by offering the paste box. */
export const FAILURE_MESSAGE: Record<FetchFailure | "no_requirements" | "malformed" | "limit", string> = {
  config: "Importing from a link isn't switched on right now. Paste the job description below instead.",
  auth: "The import service isn't set up correctly. Paste the job description below instead.",
  quota: "Today's import limit is used up. Paste the job description below instead.",
  timeout: "That page took too long to load. Try again, or paste the job description below.",
  provider: "The import service had a problem. Try again, or paste the job description below.",
  redirected: "That link sends you to a site that isn't on Lynkr's list. Paste the job description below instead.",
  empty: "That page didn't load any posting text. Check the link is still open, or paste the job description below.",
  no_requirements: "Couldn't find the responsibilities or requirements on that page. Paste the job description below instead.",
  malformed: "That page didn't come back in a usable shape. Paste the job description below instead.",
  limit: "You've imported a lot of pages today. Paste the job description below instead.",
};
