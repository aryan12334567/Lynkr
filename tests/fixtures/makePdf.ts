// A tiny PDF writer for test fixtures: Helvetica text lines at fixed positions, one or more pages,
// with a correct cross-reference table. No dependencies. Text must be Latin-1.

export type PdfLine = { text: string; x: number; y: number; size: number };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export function makePdf(pages: PdfLine[][]): Uint8Array {
  const objs: string[] = [];
  const fontId = 3;
  const pageIds: number[] = [];
  // 1 catalog, 2 pages, 3 font, then a page and its content stream per page.
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  let next = 4;
  for (const lines of pages) {
    const pageId = next++;
    const contentId = next++;
    pageIds.push(pageId);
    const stream = lines.map((l) => `BT /F1 ${l.size} Tf 1 0 0 1 ${l.x} ${l.y} Tm (${esc(l.text)}) Tj ET`).join("\n");
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    objs[contentId] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }
  objs[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offsets[i] = Buffer.byteLength(body, "latin1");
    body += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body, "latin1"));
}

/** A LinkedIn "Save to PDF" style page: sidebar at x 30, main column at x 220. */
export type Profile = {
  name: string;
  headline: string[];
  location: string;
  skills: string[];
  summary?: string[];
  roles: { company?: string; title: string; dates: string; place?: string; text?: string[] }[];
  education: { school: string; degree: string }[];
  headings?: { summary: string; experience: string; education: string; skills: string };
};

export function linkedInPdf(p: Profile): Uint8Array {
  const h = p.headings ?? { summary: "Summary", experience: "Experience", education: "Education", skills: "Top Skills" };
  const lines: PdfLine[] = [];
  let sy = 740;
  const side = (text: string, size = 10) => {
    lines.push({ text, x: 30, y: sy, size });
    sy -= 16;
  };
  side("Contact", 13);
  side("www.linkedin.com/in/example");
  side(h.skills, 13);
  p.skills.forEach((s) => side(s));
  side("Languages", 13);
  side("English (Full Professional)");

  let y = 740;
  const main = (text: string, size: number) => {
    lines.push({ text, x: 220, y, size });
    y -= size + 6;
  };
  main(p.name, 26);
  p.headline.forEach((l) => main(l, 12));
  main(p.location, 10.5);
  if (p.summary) {
    main(h.summary, 15);
    p.summary.forEach((l) => main(l, 10.5));
  }
  main(h.experience, 15);
  for (const r of p.roles) {
    if (r.company) main(r.company, 12);
    main(r.title, 11.5);
    main(r.dates, 10.5);
    if (r.place) main(r.place, 10.5);
    (r.text ?? []).forEach((l) => main(l, 10.5));
  }
  main(h.education, 15);
  for (const e of p.education) {
    main(e.school, 12);
    main(e.degree, 10.5);
  }
  // Long profiles spill onto a second page, as LinkedIn's do.
  const first = lines.filter((l) => l.y > 60);
  const rest = lines.filter((l) => l.y <= 60).map((l) => ({ ...l, y: l.y + 680 }));
  return makePdf(rest.length ? [first, rest] : [first]);
}
