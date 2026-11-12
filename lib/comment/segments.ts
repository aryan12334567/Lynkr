/** Splits a comment into plain text and the sentences Lynkr could not tie to anything the person gave ("Check this line"). */
export function flagSegments(body: string, flags: string[]): { text: string; flagged: boolean }[] {
  const hits = flags
    .map((f) => ({ at: body.indexOf(f), len: f.length }))
    .filter((h) => h.at >= 0 && h.len > 0)
    .sort((a, b) => a.at - b.at);
  const out: { text: string; flagged: boolean }[] = [];
  let pos = 0;
  for (const h of hits) {
    if (h.at < pos) continue;
    if (h.at > pos) out.push({ text: body.slice(pos, h.at), flagged: false });
    out.push({ text: body.slice(h.at, h.at + h.len), flagged: true });
    pos = h.at + h.len;
  }
  if (pos < body.length) out.push({ text: body.slice(pos), flagged: false });
  return out.length ? out : [{ text: body, flagged: false }];
}
