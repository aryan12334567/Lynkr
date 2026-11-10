/**
 * Which pages Lynkr may fetch for "import a job page"
 * (docs/plans/2026-10-17-1516-feat-apify-allowed-source-enrichment-plan.md, U1).
 *
 * Code-reviewed policy, not user input: one public job posting at a time, from a short
 * list of job-board hosts. Anything else (LinkedIn, social sites, arbitrary company
 * domains, private networks, logins) is rejected before any external call. Fail closed.
 */

export type SourceKind = "job_board_posting" | "news_feed";

export type SourceEntry = {
  host: string;
  label: string;
  kind: SourceKind;
  purpose: string;
  /** A posting URL must match this path shape. */
  path: RegExp;
  /** Paths the host's robots.txt disallows, rejected even if the shape matches. */
  disallow: RegExp[];
  reviewedAt: string;
  owner: string;
  review: string;
};

const REVIEW = "Public job posting published for applicants. robots.txt checked on the review date; posting paths are not disallowed.";

export const SOURCES: SourceEntry[] = [
  {
    host: "job-boards.greenhouse.io",
    label: "Greenhouse",
    kind: "job_board_posting",
    purpose: "Role requirements from one public posting",
    path: /^\/[a-z0-9_-]+\/jobs\/\d{4,}\/?$/i,
    disallow: [/^\/embed\//i],
    reviewedAt: "2026-10-17",
    owner: "Aryan",
    review: REVIEW,
  },
  {
    host: "boards.greenhouse.io",
    label: "Greenhouse",
    kind: "job_board_posting",
    purpose: "Role requirements from one public posting",
    path: /^\/[a-z0-9_-]+\/jobs\/\d{4,}\/?$/i,
    disallow: [/^\/embed\//i],
    reviewedAt: "2026-10-17",
    owner: "Aryan",
    review: REVIEW,
  },
  {
    host: "jobs.lever.co",
    label: "Lever",
    kind: "job_board_posting",
    purpose: "Role requirements from one public posting",
    path: /^\/[a-z0-9_.-]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i,
    disallow: [/\/apply\/?$/i],
    reviewedAt: "2026-10-17",
    owner: "Aryan",
    review: REVIEW,
  },
  {
    host: "jobs.ashbyhq.com",
    label: "Ashby",
    kind: "job_board_posting",
    purpose: "Role requirements from one public posting",
    path: /^\/[a-z0-9_.%-]+\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i,
    disallow: [/^\/meeting\//i, /^\/b\//i, /^\/api\//i, /\/application\/?$/i],
    reviewedAt: "2026-10-17",
    owner: "Aryan",
    review: REVIEW,
  },
  // apply.workable.com was reviewed (robots.txt allows postings) but left out: its pages are
  // built by JavaScript, so a single-page fetch returns no posting text. Paste works instead.
];

export const ALLOWED_HOSTS = SOURCES.map((s) => s.host);

const FEED_REVIEW = "Public RSS feed published for readers. robots.txt checked on the review date; the feed path is not disallowed. Only headlines and links are read, and only to match company names.";

/**
 * News feeds for company signals (build plan U6). A separate list from SOURCES: a feed is never a job posting,
 * and ALLOWED_HOSTS (used by the job importer) must not grow. Exact feed URLs only, fetched without query strings.
 */
export const NEWS_FEEDS: SourceEntry[] = [
  { host: "inc42.com", label: "Inc42", kind: "news_feed", purpose: "Funding and company news headlines", path: /^\/feed\/?$/i, disallow: [], reviewedAt: "2026-10-31", owner: "Aryan", review: FEED_REVIEW },
  { host: "entrackr.com", label: "Entrackr", kind: "news_feed", purpose: "Funding and company news headlines", path: /^\/rss\/?$/i, disallow: [], reviewedAt: "2026-10-31", owner: "Aryan", review: FEED_REVIEW },
  { host: "yourstory.com", label: "YourStory", kind: "news_feed", purpose: "Funding and company news headlines", path: /^\/feed\/?$/i, disallow: [], reviewedAt: "2026-10-31", owner: "Aryan", review: FEED_REVIEW },
];

/** Hosts that are always refused, with a reason a user can understand. */
const BLOCKED: { re: RegExp; reason: string }[] = [
  { re: /(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/i, reason: "Lynkr never reads LinkedIn pages. Copy the job description and paste it instead." },
  { re: /(^|\.)(facebook|instagram|twitter|x|threads|github|medium)\.(com|net)$/i, reason: "Lynkr doesn't read social or profile pages." },
  { re: /(^|\.)(naukri|indeed|glassdoor|monster|foundit|shine|instahyre|wellfound|angel)\./i, reason: "That job site isn't on Lynkr's list. Paste the job description instead." },
];

export type PolicyResult =
  | { ok: true; url: string; host: string; source: SourceEntry }
  | { ok: false; reason: string };

const MAX_URL = 500;

/** Validate one URL against the policy. Returns the canonical URL to fetch (no query, no fragment). */
export function checkSource(input: string): PolicyResult {
  const raw = input.trim();
  const no = (reason: string): PolicyResult => ({ ok: false, reason });
  if (!raw) return no("Paste the link to one job posting.");
  if (raw.length > MAX_URL) return no("That link is too long.");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return no("That doesn't look like a web link. It should start with https://");
  }
  if (u.protocol !== "https:") return no("Only secure https:// links can be imported.");
  if (u.username || u.password) return no("Links with a login in them can't be imported.");
  if (u.port) return no("Links with a port number can't be imported.");
  const host = u.hostname.toLowerCase();
  // IP addresses, localhost and private names are never fetched.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) {
    return no("That address can't be imported.");
  }
  const blocked = BLOCKED.find((b) => b.re.test(host));
  if (blocked) return no(blocked.reason);
  const source = SOURCES.find((s) => s.host === host);
  if (!source) {
    return no(`Lynkr can import job postings from ${[...new Set(SOURCES.map((s) => s.label))].join(", ")} only. For anything else, paste the job description.`);
  }
  const path = decodeURIComponent(u.pathname);
  if (source.disallow.some((d) => d.test(path))) return no("That page isn't a public job posting. Use the posting's own link.");
  if (!source.path.test(path)) return no(`That ${source.label} link isn't a single job posting. Open the job itself and copy its link.`);
  return { ok: true, url: `https://${host}${u.pathname.replace(/\/$/, "")}`, host, source };
}

/** The reviewed feed addresses, as users and the signals route see them. */
export const NEWS_FEED_URLS = ["https://inc42.com/feed/", "https://entrackr.com/rss", "https://yourstory.com/feed"] as const;

/** Validate one news feed URL against the policy. Same fail-closed rules as checkSource; run before any fetch. */
export function checkNewsFeed(input: string): PolicyResult {
  const raw = String(input ?? "").trim();
  const no = (reason: string): PolicyResult => ({ ok: false, reason });
  if (!raw) return no("Choose a news feed.");
  if (raw.length > MAX_URL) return no("That link is too long.");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return no("That doesn't look like a web link. It should start with https://");
  }
  if (u.protocol !== "https:") return no("Only secure https:// feeds can be read.");
  if (u.username || u.password) return no("Links with a login in them can't be read.");
  if (u.port) return no("Links with a port number can't be read.");
  if (u.search || u.hash) return no("Use the feed address without anything after it.");
  const host = u.hostname.toLowerCase();
  const blocked = BLOCKED.find((b) => b.re.test(host));
  if (blocked) return no("Lynkr never reads LinkedIn or social pages.");
  const source = NEWS_FEEDS.find((s) => s.host === host);
  if (!source) return no(`Lynkr reads news from ${NEWS_FEEDS.map((s) => s.label).join(", ")} only.`);
  const path = decodeURIComponent(u.pathname);
  if (source.disallow.some((d) => d.test(path)) || !source.path.test(path)) return no(`That isn't the ${source.label} news feed address.`);
  return { ok: true, url: `https://${host}${u.pathname}`, host, source };
}
