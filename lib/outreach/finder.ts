/**
 * Finder and company signals (build plan U6; R5, R7, R9, KD7).
 *
 * Everything here helps the user decide where to look and whom to write to. Lynkr never searches LinkedIn: search
 * links are built for the user to open themselves, and the only server fetches are the reviewed news feeds in
 * lib/sourcePolicy.ts (checked before any request). Signals are about companies, never about people.
 *
 *   buildTargetMap, rankByLamp          the target map and the LAMP order (Alumni, Motivation, Posting)
 *   buildSearchLinks + the link builders  second degree, school, company and title searches (extend lib/connect searchUrl)
 *   directoriesFor(goal)                public directories for the goal
 *   fetchNewsFeed, parseFeed, matchNews, roleSignals, companySignals   company signals
 *   contactQuality, assignTiers, checkMonthlyCap   the "why this person" score, tiers and the monthly cap
 */
import { searchUrl } from "../connect";
import { todayIST } from "../ist";
import { checkNewsFeed, checkSource } from "../sourcePolicy";
import type { OutreachGoal } from "./goals";

/** Search links are opened by the user; Lynkr does not search LinkedIn. */
export function targetLinks(goal: string, field: string, companies: string[]): { label: string; url: string }[] {
  const audience = goal === 'clients' ? 'buyer' : goal === 'hiring' ? 'candidate' : goal === 'mentor' ? 'mentor' : goal === 'funding' ? 'investor' : goal === 'buy_business' ? 'business owner' : 'professional';
  const targets = companies.length ? companies.slice(0, 5) : [''];
  return targets.map((company) => ({ label: [audience, field, company].filter(Boolean).join(' · '), url: searchUrl([audience, field, company].filter(Boolean).join(' ')) }));
}
export function signalIsStale(date: string, now = new Date()): boolean {
  const value = Date.parse(date);
  return !Number.isFinite(value) || now.getTime() - value > 60 * 86400000;
}

// ---- target map ----

/** Titles to look for, one or two levels above a newcomer, or the kind of person the goal is about. Clients never get recruiters. */
const TITLES: Record<OutreachGoal, readonly string[]> = {
  job: ["team lead", "hiring manager", "senior"],
  referral: ["team lead", "senior", "manager"],
  network: ["senior", "lead", "head of"],
  mentor: ["senior", "lead", "head of"],
  clients: ["founder", "head of", "VP", "director"],
  hiring: ["senior", "lead", "head of"],
  funding: ["investor", "partner", "angel"],
  buy_business: ["founder", "owner", "managing director"],
  partner: ["founder", "head of partnerships", "business development"],
  reconnect: ["lead", "manager"],
};

export type TargetMap = { field: string; subNiche: string; companies: string[]; teams: string[]; titles: string[] };

const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
const unique = (list: string[]) => [...new Set(list.filter(Boolean))];

/** Field, then sub-niche, then target companies, then teams, then people one or two levels up (R5). */
export function buildTargetMap(input: { goals: readonly OutreachGoal[]; field: string; subNiche?: string; companies?: readonly string[] }): TargetMap {
  const field = clean(input.field);
  const subNiche = clean(input.subNiche);
  return {
    field,
    subNiche,
    companies: unique((input.companies ?? []).map(clean)).slice(0, 10),
    teams: unique([subNiche, field].filter(Boolean).map((x) => `${x} team`)),
    titles: unique(input.goals.flatMap((g) => [...(TITLES[g] ?? [])])).slice(0, 4),
  };
}

// ---- search links (extend searchUrl) ----

export type SearchLink = { kind: "second_degree" | "school" | "company" | "title"; label: string; url: string };

/** People two steps away from the user. */
export const secondDegreeLink = (keywords: string): string => `${searchUrl(keywords)}&network=${encodeURIComponent('["S"]')}`;
export const schoolLink = (school: string, keywords: string): string => searchUrl([school, keywords].filter(Boolean).join(" "));
export const companyLink = (company: string, title = ""): string => searchUrl([company, title].filter(Boolean).join(" "));
export const titleLink = (title: string, field: string): string => searchUrl([title, field].filter(Boolean).join(" "));

export function buildSearchLinks(goal: OutreachGoal, map: TargetMap, school = ""): SearchLink[] {
  const topic = map.subNiche || map.field;
  const titles = map.titles.length ? map.titles : [...TITLES[goal]];
  const links: SearchLink[] = [];
  const first = titles[0] ?? "";
  links.push({ kind: "second_degree", label: `Second-degree: ${[first, topic].filter(Boolean).join(" ")}`, url: secondDegreeLink([first, topic].filter(Boolean).join(" ")) });
  if (clean(school)) links.push({ kind: "school", label: `From ${clean(school)}: ${[first, topic].filter(Boolean).join(" ")}`, url: schoolLink(clean(school), [first, topic].filter(Boolean).join(" ")) });
  for (const title of titles.slice(0, 3)) links.push({ kind: "title", label: `${title}: ${topic}`, url: titleLink(title, topic) });
  for (const company of map.companies.slice(0, 5)) links.push({ kind: "company", label: `${company}: ${first}`, url: companyLink(company, first) });
  return links;
}

// ---- directories ----

export type Directory = { label: string; url: string; note: string };
const ADPLIST: Directory = { label: "ADPList", url: "https://adplist.org/mentors", note: "Mentors who offer free sessions." };
const TOPMATE: Directory = { label: "Topmate", url: "https://topmate.io/explore", note: "Experts who take bookings." };
const HN: Directory = { label: "Hacker News: Who is hiring", url: "https://news.ycombinator.com/submitted?id=whoishiring", note: "Monthly threads where companies post roles and often name who to write to." };
const YC: Directory = { label: "YC Work at a Startup", url: "https://www.workatastartup.com/jobs", note: "Roles at early-stage companies." };
const HASGEEK: Directory = { label: "Hasgeek", url: "https://hasgeek.com/", note: "Talks and communities in Indian tech." };
const SESSIONIZE: Directory = { label: "Sessionize", url: "https://sessionize.com/", note: "Speakers and events across fields." };

const DIRECTORIES: Partial<Record<OutreachGoal, readonly Directory[]>> = {
  mentor: [ADPLIST, TOPMATE],
  job: [HN, YC],
  hiring: [HN, YC],
  network: [HASGEEK, SESSIONIZE],
};
/** Public directories for a goal. The user opens them; Lynkr never fetches them. Goals like clients have none. */
export const directoriesFor = (goal: OutreachGoal): Directory[] => [...(DIRECTORIES[goal] ?? [])];

// ---- signals ----

export type Signal = { kind: "open_role" | "news"; company: string; text: string; url: string; date: string; stale: boolean; source: string };
export type FeedItem = { title: string; link: string; date: string };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word, case-insensitive match, so "Acme" does not match "Acmeville". */
export function mentions(text: string, name: string): boolean {
  const n = name.replace(/\s+/g, " ").trim();
  if (n.length < 2) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n).replace(/ /g, "\\s+")}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

export class FeedRejected extends Error {
  constructor(message: string) { super(message); this.name = "FeedRejected"; }
}

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1];

/** Reads RSS items and Atom entries: headline, https link and IST date. Anything without all three is dropped. */
export function parseFeed(xml: string): FeedItem[] {
  const out: FeedItem[] = [];
  for (const m of xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)) {
    const block = m[0];
    const title = decode(tag(block, "title") ?? "").slice(0, 200);
    const atomLink = block.match(/<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    const link = decode(atomLink ?? tag(block, "link") ?? "").trim();
    const rawDate = decode(tag(block, "pubDate") ?? tag(block, "published") ?? tag(block, "updated") ?? tag(block, "dc:date") ?? "");
    const parsed = Date.parse(rawDate);
    if (!title || !Number.isFinite(parsed) || link.length > 500 || !/^https:\/\//i.test(link)) continue;
    out.push({ title, link, date: todayIST(new Date(parsed)) });
    if (out.length >= 100) break;
  }
  return out;
}

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const FEED_DOWN = "That news source isn't available right now. Try again later.";

/**
 * Reads one reviewed news feed. The URL is checked against the allowlist first and a URL outside it throws
 * before any request is made. Redirects are refused so a feed cannot lead somewhere unchecked.
 */
export async function fetchNewsFeed(url: string, fetcher: typeof fetch = fetch): Promise<FeedItem[]> {
  const policy = checkNewsFeed(url);
  if (!policy.ok) throw new FeedRejected(policy.reason);
  let res: Response;
  try {
    res = await fetcher(policy.url, {
      redirect: "error",
      signal: AbortSignal.timeout(8000),
      headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml", "user-agent": "Lynkr company signals" },
    });
  } catch {
    throw new Error(FEED_DOWN);
  }
  if (!res.ok) throw new Error(FEED_DOWN);
  const text = await res.text().catch(() => "");
  if (!text || text.length > MAX_FEED_BYTES) throw new Error(FEED_DOWN);
  return parseFeed(text);
}

/** Headlines that name a target company. Company level only: a signal carries no person. */
export function matchNews(items: readonly FeedItem[], companies: readonly string[], source: string, now = new Date()): Signal[] {
  const out: Signal[] = [];
  for (const item of items) {
    for (const company of companies) {
      if (mentions(item.title, company)) out.push({ kind: "news", company, text: item.title, url: item.link, date: item.date, stale: signalIsStale(item.date, now), source });
    }
  }
  return out;
}

/** The parts of a job import (an ExternalContextPacket) that signals need. */
export type RolePacket = { company: string; title: string; sourceUrl: string; fetchedAt: string };

/** Open roles at target companies from job pages the user imported. Only reviewed job-board links count. */
export function roleSignals(packets: readonly RolePacket[], companies: readonly string[], now = new Date()): Signal[] {
  const out: Signal[] = [];
  for (const p of packets) {
    const policy = checkSource(p.sourceUrl);
    if (!policy.ok) continue;
    const company = companies.find((c) => mentions(p.company, c));
    if (!company) continue;
    const date = Number.isFinite(Date.parse(p.fetchedAt)) ? todayIST(new Date(p.fetchedAt)) : "";
    out.push({ kind: "open_role", company, text: `Open role: ${p.title}`, url: policy.url, date, stale: signalIsStale(date, now), source: policy.source.label });
  }
  return out;
}

/** Roles and news together, fresh ones first, then newest. */
export function companySignals(input: { companies: readonly string[]; roles: readonly RolePacket[]; news: readonly { source: string; items: readonly FeedItem[] }[]; now?: Date }): Signal[] {
  const now = input.now ?? new Date();
  const all = [...roleSignals(input.roles, input.companies, now), ...input.news.flatMap((n) => matchNews(n.items, input.companies, n.source, now))];
  return all.sort((a, b) => Number(a.stale) - Number(b.stale) || b.date.localeCompare(a.date));
}

// ---- LAMP ----

export type LampRow = { company: string; alumni: number; motivation: number; posting: number; score: number; reason: string };
export type LampInput = {
  /** 0 to 3, set by the user. */
  motivation?: Record<string, number>;
  connections?: readonly { company: string }[];
  signals?: readonly Signal[];
};

const cap3 = (n: number) => Math.max(0, Math.min(3, Math.floor(n)));

/**
 * Alumni: people in the user's connections file who work there. Motivation: how much the user wants it (0 to 3).
 * Posting: fresh signals (open roles, news). Motivation counts most because it is the user's own choice.
 * Ties keep the order the user gave.
 */
export function rankByLamp(companies: readonly string[], input: LampInput = {}): LampRow[] {
  const rows = companies.map((company) => {
    const alumni = (input.connections ?? []).filter((c) => mentions(c.company, company)).length;
    const motivation = cap3(Number(input.motivation?.[company] ?? 0) || 0);
    const posting = (input.signals ?? []).filter((s) => !s.stale && s.company === company).length;
    const score = motivation * 3 + Math.min(alumni, 3) * 2 + Math.min(posting, 3) * 2;
    const parts = [
      motivation ? `You rated it ${motivation} of 3.` : "",
      alumni ? `${alumni} of your connections work there.` : "",
      posting ? `${posting} recent ${posting === 1 ? "signal" : "signals"}.` : "",
    ].filter(Boolean);
    return { company, alumni, motivation, posting, score, reason: parts.join(" ") || "Nothing found yet. Set how much you want this one." };
  });
  return rows.map((r, i) => ({ r, i })).sort((a, b) => b.r.score - a.r.score || a.i - b.i).map((x) => x.r);
}

// ---- why this person, tiers, monthly cap ----

export type QualityInput = {
  /** The person's work matches the target map. */
  fit: boolean;
  /** The confirmed bridge with the user, or an empty string. */
  bridge: string;
  signal: { date: string; text: string; stale: boolean } | null;
  reachable: boolean;
  /** What the user can give, or an empty string. */
  give: string;
};
export type Quality = { score: number; reasons: { fit: string; bridge: string; signal: string; reachable: string; give: string } };

/** 0 to 100. A stale signal counts a quarter of a fresh one, because it is no longer a reason to write now. */
export function contactQuality(i: QualityInput): Quality {
  const bridge = i.bridge.trim();
  const give = i.give.trim();
  const fresh = !!i.signal && !i.signal.stale;
  const score = (i.fit ? 30 : 0) + (bridge ? 25 : 0) + (i.signal ? (fresh ? 20 : 5) : 0) + (i.reachable ? 15 : 0) + (give ? 10 : 0);
  return {
    score,
    reasons: {
      fit: i.fit ? "Their work matches who you are looking for." : "Their work does not clearly match yet.",
      bridge: bridge ? `What you share: ${bridge}` : "No shared ground confirmed yet.",
      signal: !i.signal ? "No recent news to write about." : fresh ? `${i.signal.date}: ${i.signal.text}` : `Old news (${i.signal.date}): ${i.signal.text}`,
      reachable: i.reachable ? "You can reach them: you have their profile link or a connection." : "No profile link yet. Find them on LinkedIn first.",
      give: give ? `What you can give: ${give}` : "Think of one thing you could offer them.",
    },
  };
}

export type Tier = "tier_1" | "tier_2";
export const TIER_1_MIN_SCORE = 60;

/** Best scores first. Tier 1 holds at most the notes left this month, and only people who score well. */
export function assignTiers(people: readonly { id: string; score: number }[], notesLeft: number, minScore = TIER_1_MIN_SCORE): Map<string, Tier> {
  const room = Math.max(0, Math.floor(Number.isFinite(notesLeft) ? notesLeft : 0));
  const out = new Map<string, Tier>();
  let used = 0;
  for (const p of people.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score || a.i - b.i).map((x) => x.p)) {
    if (used < room && p.score >= minScore) { out.set(p.id, "tier_1"); used++; } else out.set(p.id, "tier_2");
  }
  return out;
}

export const MONTHLY_CAP_DEFAULT = 15;
export const MONTHLY_CAP_MIN = 5;
export const MONTHLY_CAP_MAX = 30;
export const clampCap = (n: number): number => (Number.isFinite(n) ? Math.max(MONTHLY_CAP_MIN, Math.min(MONTHLY_CAP_MAX, Math.round(n))) : MONTHLY_CAP_DEFAULT);

/** Asks before the (cap + 1)th new person this month. Never a silent failure: the message says what to do. */
export function checkMonthlyCap(addedThisMonth: number, cap: number): { ok: true; remaining: number } | { ok: false; message: string } {
  const limit = clampCap(cap);
  const added = Math.max(0, Math.floor(addedThisMonth));
  if (added < limit) return { ok: true, remaining: limit - added };
  const raise = limit < MONTHLY_CAP_MAX ? `Raise the limit in Settings (up to ${MONTHLY_CAP_MAX}), or wait until next month.` : "That is the highest limit, so wait until next month.";
  return { ok: false, message: `You have added ${added} new ${added === 1 ? "person" : "people"} this month, which is your limit of ${limit}. ${raise}` };
}
