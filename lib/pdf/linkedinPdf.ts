/**
 * Reads the PDF LinkedIn makes with "Save to PDF" (build plan Part 2), in the browser only.
 * The file is never uploaded or stored: the text is pulled out here, shown to the person to
 * confirm, and only the fields they keep go any further. Everything read from the file is data,
 * never instructions.
 */

export type ImportedFields = {
  name: string;
  headline: string;
  location: string;
  about: string;
  experience: { title: string; company: string; dates: string; description: string }[];
  education: { school: string; degree: string; dates: string }[];
  skills: string[];
};

export type TextItem = { str: string; x: number; y: number; page: number; size: number };

export const EMPTY_FIELDS: ImportedFields = { name: "", headline: "", location: "", about: "", experience: [], education: [], skills: [] };

export const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 6;

/** Why this file can't be read, or null. Checked before anything is parsed. */
export function checkPdfFile(name: string, type: string, size: number): string | null {
  const isPdf = type === "application/pdf" || /\.pdf$/i.test(name);
  if (!isPdf) return "Please choose the PDF file LinkedIn saved (it ends in .pdf).";
  if (size <= 0) return "That file is empty. Try saving the PDF from LinkedIn again.";
  if (size > MAX_PDF_BYTES) return "That file is over 5 MB. A LinkedIn profile PDF is usually much smaller: check it's the right file.";
  return null;
}

// ---- layout ----

type Line = { text: string; size: number; page: number; y: number };

const SIDEBAR_HEADINGS = ["Contact", "Top Skills", "Languages", "Certifications", "Honors-Awards", "Publications", "Patents"];
const MAIN_HEADINGS = ["Summary", "About", "Experience", "Education", "Licenses & Certifications", "Volunteer Experience", "Projects"];
const SPLIT_X = 180;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Group items into lines: same page, same baseline (within 2pt), left to right. */
function toLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && last.page === it.page && Math.abs(last.y - it.y) < 2) {
      last.text = clean(`${last.text} ${it.str}`);
      last.size = Math.max(last.size, it.size);
    } else lines.push({ text: clean(it.str), size: it.size, page: it.page, y: it.y });
  }
  // "Page 1 of 3" footers aren't content.
  return lines.filter((l) => l.text && !/^Page \d+ of \d+$/i.test(l.text));
}

/** Split lines into sections by heading: [heading, lines][]; lines before the first heading are under "". */
function sections(lines: Line[], headings: string[]): Map<string, Line[]> {
  const out = new Map<string, Line[]>([["", []]]);
  let cur = "";
  for (const l of lines) {
    const h = headings.find((x) => x.toLowerCase() === l.text.toLowerCase());
    if (h) {
      cur = h;
      if (!out.has(h)) out.set(h, []);
      continue;
    }
    out.get(cur)!.push(l);
  }
  return out;
}

const DATES = /^(?:[A-Z][a-z]+ )?\d{4}\s*[-–]\s*(?:Present|(?:[A-Z][a-z]+ )?\d{4})(?:\s*\(.*\))?$/;
const PLACE = /^[A-Z][\w .'-]+(?:, [A-Z][\w .'-]+){1,3}$/;

function parseExperience(lines: Line[]): ImportedFields["experience"] {
  const starts: { i: number; title: string; company: string; dates: string }[] = [];
  let company = "";
  for (let i = 0; i < lines.length; i++) {
    if (!DATES.test(lines[i].text)) continue;
    const title = lines[i - 1];
    if (!title) continue;
    const before = lines[i - 2];
    const prevEnd = starts.length ? starts[starts.length - 1].i : -1;
    // A company line sits above the title in a larger (or equal) font, after the previous role started.
    if (before && i - 2 > prevEnd && before.size >= title.size + 0.2 && !DATES.test(before.text)) company = before.text;
    starts.push({ i, title: title.text, company, dates: lines[i].text });
  }
  return starts.slice(0, 10).map((s, n) => {
    const next = starts[n + 1];
    // Description runs until the next role's title (or company) line.
    const end = next ? next.i - (next.company !== s.company && next.i - 2 > s.i ? 2 : 1) : lines.length;
    let body = lines.slice(s.i + 1, end).map((l) => l.text);
    if (body.length && PLACE.test(body[0]) && body[0].length < 60) body = body.slice(1);
    return { title: s.title.slice(0, 160), company: s.company.slice(0, 120), dates: s.dates.slice(0, 80), description: clean(body.join(" ")).slice(0, 1200) };
  });
}

function parseEducation(lines: Line[]): ImportedFields["education"] {
  const out: ImportedFields["education"] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const next = lines[i + 1];
    if (!next || next.size >= l.size) continue;
    const m = next.text.match(/\(([^)]*\d{4}[^)]*)\)\s*$/);
    out.push({
      school: l.text.slice(0, 160),
      degree: clean(next.text.replace(/·?\s*\([^)]*\)\s*$/, "")).replace(/[·,\s]+$/, "").slice(0, 160),
      dates: m ? clean(m[1]) : "",
    });
    i++;
  }
  return out.slice(0, 6);
}

/** Pure parser for the "Save to PDF" layout: a left sidebar and a main column. */
export function parseLinkedInItems(items: TextItem[]): ImportedFields {
  const usable = items.filter((i) => i.str && i.str.trim());
  if (!usable.length) return { ...EMPTY_FIELDS };
  const hasSidebar = usable.some((i) => i.x < SPLIT_X) && usable.some((i) => i.x >= SPLIT_X);
  const side = hasSidebar ? toLines(usable.filter((i) => i.x < SPLIT_X)) : [];
  const main = toLines(hasSidebar ? usable.filter((i) => i.x >= SPLIT_X) : usable);

  const sideSecs = sections(side, SIDEBAR_HEADINGS);
  const skills = (sideSecs.get("Top Skills") ?? []).map((l) => l.text.slice(0, 60)).slice(0, 20);

  const mainSecs = sections(main, MAIN_HEADINGS);
  const head = mainSecs.get("") ?? [];
  let name = "";
  let headline = "";
  let location = "";
  if (head.length) {
    const top = Math.max(...head.filter((l) => l.page === head[0].page).map((l) => l.size));
    const ni = head.findIndex((l) => l.size === top);
    name = head[ni].text.slice(0, 100);
    const rest = head.slice(ni + 1).map((l) => l.text);
    if (rest.length >= 2 && PLACE.test(rest[rest.length - 1]) && rest[rest.length - 1].length < 70) location = rest.pop()!;
    headline = clean(rest.join(" ")).slice(0, 220);
  }
  const about = clean([...(mainSecs.get("Summary") ?? []), ...(mainSecs.get("About") ?? [])].map((l) => l.text).join(" ")).slice(0, 2600);
  return {
    name,
    headline,
    location,
    about,
    experience: parseExperience(mainSecs.get("Experience") ?? []),
    education: parseEducation(mainSecs.get("Education") ?? []),
    skills,
  };
}

/** False when the parse found almost nothing: a scanned file, or a profile in another language. */
export function hasEnoughText(f: ImportedFields): boolean {
  return !!f.headline && (f.about.length > 0 || f.experience.length > 0 || f.education.length > 0);
}

/** What the interview's first question (current role) is pre-filled with. */
export function prefillFrom(f: ImportedFields): { currentRole: string } {
  const now = f.experience.find((e) => /present/i.test(e.dates)) ?? f.experience[0];
  if (now) return { currentRole: clean(`${now.title}${now.company ? ` at ${now.company}` : ""}`).slice(0, 200) };
  return { currentRole: f.headline.slice(0, 200) };
}

/** A compact text block for prompts. It's data the person confirmed, never instructions. */
export function importText(f: ImportedFields): string {
  const lines: string[] = [];
  if (f.headline) lines.push(`Headline: ${f.headline}`);
  if (f.location) lines.push(`Location: ${f.location}`);
  if (f.about) lines.push(`About: ${f.about}`);
  for (const e of f.experience) lines.push(`Experience: ${e.title}${e.company ? ` at ${e.company}` : ""}${e.dates ? ` (${e.dates})` : ""}. ${e.description}`.trim());
  for (const e of f.education) lines.push(`Education: ${[e.degree, e.school].filter(Boolean).join(", ")}${e.dates ? ` (${e.dates})` : ""}`);
  if (f.skills.length) lines.push(`Skills: ${f.skills.join(", ")}`);
  return lines.join("\n").slice(0, 4000);
}

// ---- reading the file ----

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> };
export type PdfLib = {
  getDocument: (src: { data: Uint8Array; isEvalSupported?: boolean; disableFontFace?: boolean; verbosity?: number }) => { promise: Promise<PdfDoc>; destroy: () => Promise<void> };
};

/** Text items from the first pages of a PDF, with position and font size. */
export async function extractItems(pdfjs: PdfLib, data: Uint8Array): Promise<TextItem[]> {
  // Text only: no fonts are rendered, so pdf.js's font warnings are switched off (verbosity 0 = errors).
  const task = pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  const out: TextItem[] = [];
  try {
    const doc = await task.promise;
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      for (const raw of content.items) {
        const it = raw as { str?: string; transform?: number[] };
        if (typeof it.str !== "string" || !it.transform) continue;
        const [a, b, , , x, y] = it.transform;
        out.push({ str: it.str, x, y, page: p, size: Math.round(Math.hypot(a, b) * 10) / 10 });
      }
    }
  } finally {
    await task.destroy();
  }
  return out;
}

/** Browser only. pdf.js is loaded on demand, with its worker running in this thread (no worker file to serve). */
export async function readLinkedInPdf(file: File): Promise<ImportedFields> {
  const problem = checkPdfFile(file.name, file.type, file.size);
  if (problem) throw new Error(problem);
  const g = globalThis as { pdfjsWorker?: unknown };
  // @ts-expect-error -- the worker bundle ships without type declarations; it's only loaded for its side effect.
  if (!g.pdfjsWorker) g.pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const pdfjs = (await import("pdfjs-dist")) as unknown as PdfLib;
  let items: TextItem[];
  try {
    items = await extractItems(pdfjs, new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new Error("Couldn't read that PDF. Save it from LinkedIn again, or paste your profile instead.");
  }
  return parseLinkedInItems(items);
}
