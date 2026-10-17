/**
 * Which pages Lynkr may fetch for "import a job page"
 * (docs/plans/2026-10-17-1516-feat-apify-allowed-source-enrichment-plan.md, U1).
 *
 * Code-reviewed policy, not user input: one public job posting at a time, from a short
 * list of job-board hosts. Anything else (LinkedIn, social sites, arbitrary company
 * domains, private networks, logins) is rejected before any external call. Fail closed.
 */

export type SourceKind = "job_board_posting";

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
