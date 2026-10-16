import { istToUTC } from "./ist";

/** Calendar reminders: .ics files and Google Calendar links. Events are 15 minutes. */
export type CalEvent = { uid: string; title: string; description: string; day: string; time: string };

const DURATION_MIN = 15;

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** RFC 5545: lines longer than 75 octets continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function eventTimes(e: CalEvent): { start: Date; end: Date } {
  const start = istToUTC(e.day, e.time);
  return { start, end: new Date(start.getTime() + DURATION_MIN * 60_000) };
}

export function buildIcs(events: CalEvent[], now: Date = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Lynkr//Weekly plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const e of events) {
    const { start, end } = eventTimes(e);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@lynkr`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escapeText(e.title)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(e.title)}`,
      "TRIGGER:-PT0M",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Google Calendar "add event" link. Long descriptions are cut to keep the URL usable. */
export function googleCalendarUrl(e: CalEvent): string {
  const { start, end } = eventTimes(e);
  const details = e.description.length > 1500 ? e.description.slice(0, 1497) + "…" : e.description;
  const p = new URLSearchParams({ action: "TEMPLATE", text: e.title, dates: `${stamp(start)}/${stamp(end)}`, details });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function downloadIcs(filename: string, events: CalEvent[]): void {
  const blob = new Blob([buildIcs(events)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
