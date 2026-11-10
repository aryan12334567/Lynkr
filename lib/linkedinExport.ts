/**
 * Reads the user's own LinkedIn data export in the browser
 * (prod/lynkr-profile-fix-intelligence-plan.md §4, upload rules). Only files on
 * the allowlist below are ever decompressed. Messages, connections, contacts,
 * account history, ads and inferred-data files are listed by name and skipped.
 * Connections.csv is opened only when the caller passes useConnections (the user ticked
 * "Use my connections"); its email column is dropped while parsing.
 * Nothing here is uploaded or saved; the caller keeps the result in memory.
 */

export type ImportedProfile = {
  headline: string;
  summary: string;
  industry: string;
  location: string;
  positions: { title: string; company: string; description: string; started: string; finished: string }[];
  education: { school: string; degree: string; started: string; finished: string }[];
  skills: string[];
  projects: { title: string; description: string; url: string }[];
  certifications: { name: string; authority: string; url: string }[];
  courses: string[];
  honors: string[];
  publications: string[];
  volunteering: { role: string; organisation: string; description: string }[];
};

export const SECTIONS = ["profile", "positions", "education", "skills", "projects", "certifications", "courses", "honors", "publications", "volunteering"] as const;
export type Section = (typeof SECTIONS)[number];

export const SECTION_LABEL: Record<Section, string> = {
  profile: "Headline, About, industry, location",
  positions: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  courses: "Courses",
  honors: "Honours and awards",
  publications: "Publications",
  volunteering: "Volunteering",
};

/** File name (lower-case, without folders) → section. Anything else is never opened. */
const ALLOW: Record<string, Section> = {
  "profile.csv": "profile",
  "positions.csv": "positions",
  "education.csv": "education",
  "skills.csv": "skills",
  "projects.csv": "projects",
  "certifications.csv": "certifications",
  "courses.csv": "courses",
  "honors.csv": "honors",
  "publications.csv": "publications",
  "volunteering.csv": "volunteering",
  "volunteering experiences.csv": "volunteering",
};

export function sectionOf(path: string): Section | null {
  const name = path.split(/[\\/]/).pop()!.toLowerCase();
  return ALLOW[name] ?? null;
}

export const EMPTY_IMPORT: ImportedProfile = {
  headline: "",
  summary: "",
  industry: "",
  location: "",
  positions: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  courses: [],
  honors: [],
  publications: [],
  volunteering: [],
};

// ---- CSV ----

/** RFC 4180-style CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

/** Rows as objects keyed by header. Some exports start with a "Notes:" preamble; skip to the header row. */
function records(text: string, mustHave: string): Record<string, string>[] {
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => r.some((f) => f.trim().toLowerCase() === mustHave.toLowerCase()));
  if (h === -1) return [];
  const header = rows[h].map((f) => f.trim().toLowerCase());
  return rows.slice(h + 1).map((r) => Object.fromEntries(header.map((k, i) => [k, (r[i] ?? "").trim()])));
}

const cap = (s: string, n = 2000) => (s.length > n ? s.slice(0, n) : s);

/** Merge one allowlisted CSV into the profile. Only the listed columns are read. */
export function applySection(p: ImportedProfile, section: Section, text: string): ImportedProfile {
  const next = { ...p };
  switch (section) {
    case "profile": {
      // Deliberately ignores address, birth date, zip code, phone/IM and other personal columns.
      const r = records(text, "headline")[0];
      if (r) {
        next.headline = cap(r["headline"] ?? "", 300);
        next.summary = cap(r["summary"] ?? "");
        next.industry = cap(r["industry"] ?? "", 120);
        next.location = cap(r["geo location"] ?? r["location"] ?? "", 120);
      }
      break;
    }
    case "positions":
      next.positions = records(text, "title").map((r) => ({
        title: cap(r["title"] ?? "", 160),
        company: cap(r["company name"] ?? "", 160),
        description: cap(r["description"] ?? ""),
        started: r["started on"] ?? "",
        finished: r["finished on"] ?? "",
      }));
      break;
    case "education":
      next.education = records(text, "school name").map((r) => ({
        school: cap(r["school name"] ?? "", 160),
        degree: cap(r["degree name"] ?? "", 160),
        started: r["start date"] ?? "",
        finished: r["end date"] ?? "",
      }));
      break;
    case "skills":
      next.skills = records(text, "name").map((r) => cap(r["name"] ?? "", 80)).filter(Boolean);
      break;
    case "projects":
      next.projects = records(text, "title").map((r) => ({ title: cap(r["title"] ?? "", 160), description: cap(r["description"] ?? ""), url: cap(r["url"] ?? "", 300) }));
      break;
    case "certifications":
      // License numbers are skipped.
      next.certifications = records(text, "name").map((r) => ({ name: cap(r["name"] ?? "", 160), authority: cap(r["authority"] ?? "", 160), url: cap(r["url"] ?? "", 300) }));
      break;
    case "courses":
      next.courses = records(text, "name").map((r) => cap(r["name"] ?? "", 160)).filter(Boolean);
      break;
    case "honors":
      next.honors = records(text, "title").map((r) => cap(r["title"] ?? "", 160)).filter(Boolean);
      break;
    case "publications":
      next.publications = records(text, "name").map((r) => cap(r["name"] ?? "", 200)).filter(Boolean);
      break;
    case "volunteering":
      next.volunteering = records(text, "role").map((r) => ({ role: cap(r["role"] ?? "", 160), organisation: cap(r["company name"] ?? "", 160), description: cap(r["description"] ?? "") }));
      break;
  }
  return next;
}

export function sectionCount(p: ImportedProfile, s: Section): number {
  if (s === "profile") return [p.headline, p.summary, p.industry, p.location].filter(Boolean).length;
  return (p[s] as unknown[]).length;
}

/** Keep only the sections the user ticked. */
export function pick(p: ImportedProfile, keep: Section[]): ImportedProfile {
  const out: ImportedProfile = { ...EMPTY_IMPORT };
  for (const s of keep) {
    if (s === "profile") Object.assign(out, { headline: p.headline, summary: p.summary, industry: p.industry, location: p.location });
    else (out as Record<string, unknown>)[s] = p[s];
  }
  return out;
}

/** Plain text of the chosen fields, for an AI request the user has agreed to. */
export function importedText(p: ImportedProfile): string {
  const lines: string[] = [];
  if (p.headline) lines.push(`Headline: ${p.headline}`);
  if (p.summary) lines.push(`About: ${p.summary}`);
  if (p.industry) lines.push(`Industry: ${p.industry}`);
  if (p.location) lines.push(`Location: ${p.location}`);
  for (const x of p.positions) lines.push(`Experience: ${x.title}${x.company ? ` at ${x.company}` : ""}. ${x.description}`);
  for (const x of p.education) lines.push(`Education: ${x.degree} ${x.school}`.trim());
  if (p.skills.length) lines.push(`Skills: ${p.skills.join(", ")}`);
  for (const x of p.projects) lines.push(`Project: ${x.title}. ${x.description}${x.url ? ` (${x.url})` : ""}`);
  for (const x of p.certifications) lines.push(`Certification: ${x.name}${x.authority ? `, ${x.authority}` : ""}`);
  if (p.courses.length) lines.push(`Courses: ${p.courses.join(", ")}`);
  if (p.honors.length) lines.push(`Honours: ${p.honors.join(", ")}`);
  if (p.publications.length) lines.push(`Publications: ${p.publications.join(", ")}`);
  for (const x of p.volunteering) lines.push(`Volunteering: ${x.role} at ${x.organisation}. ${x.description}`);
  return lines.join("\n").slice(0, 8000);
}

// ---- ZIP (central directory only; stored and deflate entries) ----

export type ZipEntry = { name: string; method: number; compressedSize: number; offset: number };

export function listZip(buf: ArrayBuffer): ZipEntry[] {
  const v = new DataView(buf);
  // End of central directory: search backwards for its signature.
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("That file isn't a ZIP archive.");
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const out: ZipEntry[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error("This ZIP looks damaged.");
    const method = v.getUint16(p + 10, true);
    const compressedSize = v.getUint32(p + 20, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const offset = v.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    out.push({ name, method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export async function readZipEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const v = new DataView(buf);
  if (v.getUint32(e.offset, true) !== 0x04034b50) throw new Error("This ZIP looks damaged.");
  const start = e.offset + 30 + v.getUint16(e.offset + 26, true) + v.getUint16(e.offset + 28, true);
  const data = new Uint8Array(buf, start, e.compressedSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error(`Unsupported compression in ${e.name}.`);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

// ---- Connections.csv (opt-in only) ----

/** Kept on this device; LinkedIn's email column is deliberately discarded. */
export type Connection = { name: string; company: string; role: string; profileUrl: string; connectedOn: string };

export const CONNECTIONS_NOT_FOUND = "Connections file not found in this archive";

export const isConnectionsFile = (path: string) => /(^|[\\/])connections\.csv$/i.test(path);

export function normalizeProfileUrl(value: string): string {
  try {
    const u = new URL(value);
    const match = /^\/in\/([a-z0-9-]+)\/?$/i.exec(u.pathname);
    if (u.protocol !== "https:" || !["www.linkedin.com", "linkedin.com"].includes(u.hostname.toLowerCase()) || !match || u.username || u.password || u.port) return "";
    return `https://www.linkedin.com/in/${match[1]}/`;
  } catch { return ""; }
}

/**
 * Matches headers by name (any column order) and skips the notes lines LinkedIn puts above them.
 * The Email Address column is blanked in the parsed rows and never copied into the result.
 */
export function parseConnectionsCsv(text: string): Connection[] {
  const rows = parseCsv(text);
  const headerAt = rows.findIndex((row) => row.some((x) => x.trim().toLowerCase() === "first name") && row.some((x) => x.trim().toLowerCase() === "last name"));
  if (headerAt < 0) throw new Error("That Connections file has no First Name and Last Name columns.");
  const headers = rows[headerAt].map((x) => x.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);
  const email = col("email address");
  const get = (row: string[], name: string) => (row[col(name)] ?? "").trim();
  return rows.slice(headerAt + 1).map((row) => {
    const c: Connection = {
      name: [get(row, "first name"), get(row, "last name")].filter(Boolean).join(" "),
      company: get(row, "company"), role: get(row, "position"),
      profileUrl: normalizeProfileUrl(get(row, "url")), connectedOn: get(row, "connected on"),
    };
    if (email >= 0) row[email] = "";
    return c;
  }).filter((c) => !!c.name);
}

export type ImportResult = {
  profile: ImportedProfile; read: { file: string; section: Section }[]; skipped: string[];
  /** Only set when the caller passed useConnections. false means the archive had no Connections.csv. */
  connections?: Connection[] | false;
};

/**
 * Read a LinkedIn export ZIP, or one or more of its CSV files.
 * Connections.csv is opened only when useConnections is true (the "Use my connections" tick).
 */
export async function readExport(files: { name: string; buffer: ArrayBuffer }[], opts: { useConnections?: boolean } = {}): Promise<ImportResult> {
  let profile: ImportedProfile = { ...EMPTY_IMPORT };
  const read: ImportResult["read"] = [];
  const skipped: string[] = [];
  let connections: Connection[] | false | undefined = opts.useConnections ? false : undefined;
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      for (const e of listZip(f.buffer)) {
        if (e.name.endsWith("/")) continue;
        if (opts.useConnections && isConnectionsFile(e.name)) {
          connections = parseConnectionsCsv(await readZipEntry(f.buffer, e));
          continue;
        }
        const section = sectionOf(e.name);
        if (!section) {
          skipped.push(e.name);
          continue;
        }
        profile = applySection(profile, section, await readZipEntry(f.buffer, e));
        read.push({ file: e.name, section });
      }
    } else {
      if (opts.useConnections && isConnectionsFile(f.name)) {
        connections = parseConnectionsCsv(new TextDecoder().decode(f.buffer));
        continue;
      }
      const section = sectionOf(f.name);
      if (!section) {
        skipped.push(f.name);
        continue;
      }
      profile = applySection(profile, section, new TextDecoder().decode(f.buffer));
      read.push({ file: f.name, section });
    }
  }
  return connections === undefined ? { profile, read, skipped } : { profile, read, skipped, connections };
}
