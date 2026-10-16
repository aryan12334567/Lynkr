/** Blanks look like [[what to fill in]] inside draft text. */
export type Segment =
  | { type: "text"; text: string }
  | { type: "slot"; label: string; index: number };

const SLOT = /\[\[([^\]]{1,160})\]\]/g;

export function parseSlots(raw: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  let index = 0;
  for (const m of raw.matchAll(SLOT)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ type: "text", text: raw.slice(last, start) });
    out.push({ type: "slot", label: m[1].trim(), index: index++ });
    last = start + m[0].length;
  }
  if (last < raw.length) out.push({ type: "text", text: raw.slice(last) });
  return out;
}

export function slotCount(raw: string): number {
  return parseSlots(raw).filter((s) => s.type === "slot").length;
}

export function openSlots(raw: string, fills: string[]): number {
  return parseSlots(raw).filter((s) => s.type === "slot" && !(fills[s.index] ?? "").trim()).length;
}

export function renderFilled(raw: string, fills: string[]): string {
  return parseSlots(raw)
    .map((s) => (s.type === "text" ? s.text : (fills[s.index] ?? "").trim()))
    .join("");
}
