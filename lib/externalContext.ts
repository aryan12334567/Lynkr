/**
 * Turn one fetched job-posting page into a small, reviewable packet of role fields
 * (Apify enrichment plan, U1 and the "Normalize" boundary). Runs on the server only.
 * The page itself is used for this request and thrown away: it is never stored,
 * logged, returned to the browser or sent to the AI. Only the packet leaves this file.
 *
 * Deliberately conservative: unknown fields stay empty, contact details and links are
 * removed, and list items that mention people or ways to contact them are dropped.
 */
import { parse, type HTMLElement } from "node-html-parser";
import { ExternalContextPacket } from "./schemas";
import type { SourceEntry } from "./sourcePolicy";

type Section = { heading: string; items: string[] };

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const URLISH = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const HANDLE = /(^|\s)@[A-Za-z0-9_]{2,}/g;
/** Items about people, applying or contacting someone carry no role information. */
const PERSONAL = /\b(contact|reach out|email (us|your|me)|mail (us|your)|send (us )?your (cv|resume|résumé|portfolio)|(cv|resume) to|e-mail|write to|recruiter|hiring manager is|apply (?:now|here|via|through)|referral bonus|linkedin|whatsapp|call us|our team member|meet the team)\b/i;
const INJECTION = /\b(ignore (all |any |the )?(previous|prior|above|earlier) (instructions|prompts?)|disregard (the|all|previous)|system prompt|you are (chatgpt|an ai|a language model)|as an ai|assistant:|new instructions)\b/i;
/** Sections that are boilerplate, not requirements. */
const SKIP_SECTION = /\b(eeo|equal opportunit|privacy|benefits?|perks|about (us|the company)|who we are|our culture|why (join|work)|compensation|salary|apply for this job|disclaimer|accommodation)\b/i;

const RESP = /\b(responsibilit|what you('|’)?ll (do|own|work on)|what you will (do|be doing|own)|role overview|your role|day[- ]to[- ]day|duties|key result|in this role you|job summary|the work)\b/i;
const REQ = /\b(requirement|qualification|what you('|’)?ll (bring|need|have)|what you (bring|need|have|should have)|you('|’)?ll need|what we('|’)?re looking for|who we('|’)?re looking for|ideal candidate|must[- ]haves?|skills|about you|you have|experience|who you are|eligibility|competenc)/i;
const PREF = /\b(nice[- ]to[- ]haves?|preferred|bonus|good to have|desirable|added advantage|extra credit)\b/i;

type Category = "resp" | "req" | "pref" | "skip";
function classify(heading: string): Category | null {
  if (!heading) return null;
  if (SKIP_SECTION.test(heading)) return "skip";
  if (PREF.test(heading)) return "pref";
  if (REQ.test(heading)) return "req";
  if (RESP.test(heading)) return "resp";
  return null;
}

const clean = (s: string) =>
  s
    .replace(/\s+/g, " ")
    .replace(/[​﻿]/g, "")
    .trim();

/** Remove contact details and links; drop the item entirely if it is about people or contacting. */
export function scrubItem(s: string): string | null {
  const t = clean(s);
  if (!t || t.length < 3) return null;
  if (PERSONAL.test(t)) return null;
  // Text addressed to an AI is never a job requirement; drop it rather than pass it on.
  if (INJECTION.test(t)) return null;
  const out = clean(t.replace(EMAIL, "").replace(URLISH, "").replace(PHONE, (m) => (/\d{4}/.test(m) && m.replace(/\D/g, "").length >= 9 ? "" : m)).replace(HANDLE, "$1"));
  if (out.length < 3 || out.length > 240) return null;
  // Leftover fragments of a removed contact line.
  if (/^[\s,.:;()-]*$/.test(out)) return null;
  return out;
}

const textOf = (el: HTMLElement) => clean(el.textContent);

/** Headings followed by lists, in page order. */
function sectionsFrom(root: HTMLElement): Section[] {
  const out: Section[] = [];
  for (const ul of root.querySelectorAll("ul, ol")) {
    if (ul.parentNode && (ul.parentNode as HTMLElement).closest?.("li")) continue; // nested list: counted with its parent
    const items = ul.childNodes
      .filter((n): n is HTMLElement => (n as HTMLElement).tagName === "LI")
      .map(textOf)
      .filter(Boolean);
    if (!items.length) continue;
    // Nearest short text block before the list, or before its container.
    let heading = "";
    let cur: HTMLElement | null = ul;
    for (let hops = 0; cur && hops < 4 && !heading; hops++) {
      let prev = cur.previousElementSibling;
      while (prev && !heading) {
        const t = textOf(prev);
        if (t && t.length <= 90) heading = t.replace(/[:：]\s*$/, "");
        else if (t) break;
        prev = prev.previousElementSibling;
      }
      cur = cur.parentNode as HTMLElement | null;
    }
    out.push({ heading, items: items.slice(0, 25) });
  }
  return out.slice(0, 20);
}

type JobPosting = {
  title?: string;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: unknown;
  jobLocationType?: string;
  employmentType?: string | string[];
  experienceRequirements?: unknown;
  educationRequirements?: unknown;
  description?: string;
};

function jobPostingFrom(root: HTMLElement): JobPosting | null {
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent);
      const list = ([] as unknown[]).concat(j, (j as { "@graph"?: unknown[] })?.["@graph"] ?? []);
      const jp = list.find((x) => x && typeof x === "object" && (x as { "@type"?: unknown })["@type"] === "JobPosting");
      if (jp) return jp as JobPosting;
    } catch {
      // Malformed structured data is ignored, not trusted.
    }
  }
  return null;
}

function locationFrom(jp: JobPosting | null, root: HTMLElement): string {
  const places = jp?.jobLocation ? ([] as unknown[]).concat(jp.jobLocation) : [];
  const parts = places
    .map((p) => (p as { address?: Record<string, unknown> })?.address)
    .filter(Boolean)
    .map((a) => [a!.addressLocality, a!.addressRegion, a!.addressCountry].filter((x) => typeof x === "string" && x).join(", "))
    .filter(Boolean);
  if (parts.length) return clean([...new Set(parts)].join("; ")).slice(0, 160);
  const el = root.querySelector('.location, [class*="location"], .posting-categories .sort-by-location');
  const t = el ? textOf(el) : "";
  return t.length <= 160 ? t : "";
}

function workModeFrom(jp: JobPosting | null, text: string): ExternalContextPacket["workMode"] {
  if (jp?.jobLocationType && /telecommute/i.test(jp.jobLocationType)) return "remote";
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\b(fully )?remote\b/i.test(text)) return "remote";
  if (/\b(on[- ]?site|in[- ]office|work from office)\b/i.test(text)) return "on_site";
  return "unknown";
}

function experienceFrom(text: string): string {
  const m = text.match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:(?:-|–|to)\s*(\d{1,2}))?\s*(?:\+\s*)?years?(?:'|’)?(?:\s+of)?\s+(?:relevant\s+|professional\s+|work\s+|hands-on\s+)?experience/i);
  if (m) return m[2] ? `${m[1]} to ${m[2]} years` : `${m[1]}+ years`;
  if (/\b(fresher|freshers|new grad|recent graduate|entry[- ]level|0\s*(?:-|–|to)\s*[12]\s*years)\b/i.test(text)) return "Entry level";
  if (/\bintern(ship)?\b/i.test(text)) return "Internship";
  return "";
}

function educationFrom(jp: JobPosting | null, items: string[]): string {
  const ld = jp?.educationRequirements;
  const fromLd = typeof ld === "string" ? ld : (ld as { credentialCategory?: string })?.credentialCategory;
  if (fromLd) return scrubItem(String(fromLd)) ?? "";
  const hit = items.find((i) => /\b(bachelor|master|degree|b\.?\s?tech|b\.?\s?e\b|b\.?\s?com|bba|mba|graduate in|ca\b|cfa|m\.?\s?tech|phd)\b/i.test(i));
  return hit ?? "";
}

function companyFrom(jp: JobPosting | null, root: HTMLElement, url: URL): string {
  const org = jp?.hiringOrganization;
  const name = typeof org === "string" ? org : org?.name;
  if (name) return clean(name).slice(0, 120);
  const site = root.querySelector('meta[property="og:site_name"]')?.getAttribute("content");
  if (site && !/greenhouse|lever|ashby|workable/i.test(site)) return clean(site).slice(0, 120);
  // The board's company slug, e.g. /headoutcareers/jobs/123 -> "Headoutcareers".
  const slug = url.pathname.split("/").filter(Boolean)[0] ?? "";
  return slug ? slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 120) : "";
}

const take = (items: string[], max: number) => [...new Set(items.map(scrubItem).filter((x): x is string => !!x))].slice(0, max);

/**
 * Build the packet from one page's HTML. Throws if nothing usable was found, so callers
 * never get a success-shaped empty packet.
 */
export function extractPacket(html: string, url: string, source: SourceEntry, now: Date = new Date()): ExternalContextPacket {
  const root = parse(html, { blockTextElements: { script: true, style: false, noscript: false, pre: true } });
  const jp = jobPostingFrom(root);
  for (const el of root.querySelectorAll("script, style, noscript, svg, nav, footer, form, header")) el.remove();

  // Sections come from the page, and from the structured description when there is one.
  let sections = sectionsFrom(root);
  if (jp?.description) {
    // The structured description is the posting itself; prefer it over page chrome when it has sections.
    const fromDesc = sectionsFrom(parse(jp.description));
    if (fromDesc.some((s) => classify(s.heading))) sections = fromDesc;
    else if (fromDesc.length) sections = [...fromDesc, ...sections];
  }
  const provenance: ExternalContextPacket["provenance"] = [];
  // Walk sections in page order. A section with an unrecognised heading belongs to the last
  // recognised one: some boards put every bullet in its own list under one heading.
  const buckets: Record<Exclude<Category, "skip">, string[]> = { resp: [], req: [], pref: [] };
  const firstHeading: Partial<Record<Category, string>> = {};
  let current: Category | null = null;
  for (const s of sections) {
    const c = classify(s.heading);
    if (c) {
      current = c;
      firstHeading[c] ??= s.heading;
      if (c !== "skip") buckets[c].push(...s.items);
    } else if (current && current !== "skip") {
      if (s.heading.length > 20) buckets[current].push(s.heading);
      buckets[current].push(...s.items);
    }
  }
  const FIELD = { resp: "responsibilities", req: "requiredSkills", pref: "preferredSkills" } as const;
  for (const c of ["resp", "req", "pref"] as const) {
    if (buckets[c].length && firstHeading[c]) provenance.push({ field: FIELD[c], source: `Section "${firstHeading[c]!.slice(0, 80)}"` });
  }

  const responsibilities = take(buckets.resp, 12);
  const requiredSkills = take(buckets.req, 15);
  const preferredSkills = take(buckets.pref, 10);

  const u = new URL(url);
  const h1 = root.querySelector("h1, h2");
  const title = clean(jp?.title ?? (h1 ? textOf(h1) : "")).slice(0, 160);
  if (title) provenance.unshift({ field: "title", source: jp?.title ? "Structured job data" : "Page heading" });
  const bodyText = clean(root.textContent).slice(0, 60000);
  const company = companyFrom(jp, root, u);
  if (company) provenance.push({ field: "company", source: (typeof jp?.hiringOrganization === "object" && jp.hiringOrganization?.name) || typeof jp?.hiringOrganization === "string" ? "Structured job data" : "Job board address" });
  const location = scrubItem(locationFrom(jp, root)) ?? "";
  if (location) provenance.push({ field: "location", source: jp?.jobLocation ? "Structured job data" : "Page location label" });
  const experienceLevel = experienceFrom(bodyText);
  if (experienceLevel) provenance.push({ field: "experienceLevel", source: "Posting text" });
  const education = educationFrom(jp, [...requiredSkills, ...preferredSkills]);
  if (education) provenance.push({ field: "education", source: "Posting requirements" });
  const workMode = workModeFrom(jp, bodyText);

  if (!title || (responsibilities.length === 0 && requiredSkills.length === 0)) {
    throw new ExtractError("no_requirements");
  }

  const packet = {
    sourceUrl: url,
    sourceDomain: u.hostname,
    sourceKind: source.kind,
    fetchedAt: now.toISOString(),
    title,
    company,
    location,
    workMode,
    experienceLevel,
    education: education.slice(0, 240),
    responsibilities,
    requiredSkills,
    preferredSkills,
    reviewStatus: "unreviewed" as const,
    provenance: provenance.slice(0, 20),
  };
  const checked = ExternalContextPacket.safeParse(packet);
  if (!checked.success) throw new ExtractError("malformed");
  return checked.data;
}

export class ExtractError extends Error {
  category: "no_requirements" | "malformed";
  constructor(category: "no_requirements" | "malformed") {
    super(category);
    this.category = category;
  }
}

/** True if any field still carries contact details. Used by tests and as a last check before returning. */
export function hasContactData(p: ExternalContextPacket): boolean {
  const all = [p.title, p.company, p.location, p.experienceLevel, p.education, ...p.responsibilities, ...p.requiredSkills, ...p.preferredSkills].join(" \n ");
  return new RegExp(EMAIL.source).test(all) || new RegExp(URLISH.source, "i").test(all) || /linkedin/i.test(all);
}
