/**
 * Chat moves (calendar plan U7, R12, AE6): "move Thursday's post to Friday". Pure: the parser turns words into one move,
 * and the server (lib/calendar/chat-move.ts) matches it to the person's own item and sends it through the move route's
 * owner code. The model, when there is one, is given only each item's day and kind, never a name, label or id.
 */
export const MOVE_KINDS = ["post", "comment", "message", "meeting"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];
export const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

/** The day the item is on now (null when the person did not say), its kind, and the day (and optionally the time) to move it to. */
export type ChatMove = { from_day: WeekdayKey | null; kind: MoveKind; to_day: WeekdayKey; time: string | null };

const DAY = "(mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)";
const KIND = "(posts?|comments?|messages?|outreach|dms?|meetings?|calls?)";
const MOVE_RE = new RegExp(
  `\\b(?:move|shift|reschedule)\\s+(?:my\\s+|the\\s+)?(?:${DAY}(?:'s)?\\s+)?${KIND}\\b(?:\\s+(?:from|on)\\s+${DAY})?\\s+(?:to|for|onto)\\s+${DAY}(?:\\s+(?:at\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?)?`,
);
const KIND_OF: Record<string, MoveKind> = { post: "post", comment: "comment", message: "message", outreach: "message", dm: "message", meeting: "meeting", call: "meeting" };

const dayKey = (w: string): WeekdayKey => w.slice(0, 3) as WeekdayKey;
const kindOf = (w: string): MoveKind | undefined => KIND_OF[w.replace(/s$/, "")];

function toTime(h: number, m: number, ampm?: string): string | null {
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseMove(text: string): ChatMove | null {
  const m = MOVE_RE.exec(text.toLowerCase());
  if (!m) return null;
  const kind = kindOf(m[2]);
  if (!kind) return null;
  const from = m[1] ?? m[3];
  return { from_day: from ? dayKey(from) : null, kind, to_day: dayKey(m[4]), time: m[5] ? toTime(Number(m[5]), Number(m[6] ?? 0), m[7]) : null };
}

/** The date a weekday name means inside the week that starts on `monday`. */
export function dayInWeek(monday: string, key: WeekdayKey): string {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + WEEKDAY_KEYS.indexOf(key));
  return d.toISOString().slice(0, 10);
}

/** What the model may see of the week: day and kind per item, in order. No names, labels, ids or text (R12, KD5). */
export function modelItemLines(items: readonly { day: string; kind: string }[], monday: string): string {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return items
    .map((i) => ({ i, n: Math.round((Date.parse(`${i.day}T00:00:00Z`) - Date.parse(`${monday}T00:00:00Z`)) / 86_400_000) }))
    .filter(({ n }) => n >= 0 && n <= 6)
    .sort((a, b) => a.n - b.n)
    .map(({ i, n }) => `${names[n]}: ${i.kind}`)
    .join("\n");
}
