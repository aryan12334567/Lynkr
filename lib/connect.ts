import { daysBetween, mondayOf, todayIST } from "./ist";
import type { Relationship } from "./checker";
import type { ProfileInput, Turn } from "./schemas";

/** Connect Coach. Spec: research/spec-connect-coach.md. */
export type PersonStatus = "to_find" | "sent" | "accepted" | "messaged" | "replied";

export type Person = {
  id: string;
  label: string;
  relationship: Relationship;
  withNote: boolean;
  status: PersonStatus;
  addedAt: string;
  sentAt?: string;
  messagedAt?: string;
};

export type Connect = { monthlyNotes: number; weeklyCap: number; people: Person[] };

export type LookFor = { who: string; why: string; search: string };

export const DEFAULT_CONNECT: Connect = { monthlyNotes: 3, weeklyCap: 5, people: [] };

export const STATUS_ORDER: PersonStatus[] = ["to_find", "sent", "accepted", "messaged", "replied"];

export const STATUS_LABEL: Record<PersonStatus, string> = {
  to_find: "To find",
  sent: "Sent",
  accepted: "Accepted",
  messaged: "Messaged",
  replied: "Replied",
};

export const NOTE_MAX = 200;

export function searchUrl(keywords: string): string {
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

// ---- budget and cap (IST month / week) ----

export function notesUsedThisMonth(people: Person[], now: Date = new Date()): number {
  const month = todayIST(now).slice(0, 7);
  return people.filter((p) => p.withNote && p.sentAt && todayIST(new Date(p.sentAt)).slice(0, 7) === month).length;
}

export function notesLeft(c: Connect, now: Date = new Date()): number {
  return Math.max(0, c.monthlyNotes - notesUsedThisMonth(c.people, now));
}

export function addedThisWeek(people: Person[], now: Date = new Date()): number {
  const week = mondayOf(todayIST(now));
  return people.filter((p) => mondayOf(todayIST(new Date(p.addedAt))) === week).length;
}

export function canAdd(c: Connect, now: Date = new Date()): boolean {
  return addedThisWeek(c.people, now) < c.weeklyCap;
}

// ---- tracker ----

export function addPerson(c: Connect, label: string, relationship: Relationship, withNote: boolean, now: Date = new Date()): Connect {
  const person: Person = {
    id: `p-${now.getTime().toString(36)}-${c.people.length}`,
    label: label.trim().slice(0, 120),
    relationship,
    withNote,
    status: "to_find",
    addedAt: now.toISOString(),
  };
  return { ...c, people: [...c.people, person] };
}

/** Move a person one step forward (+1) or back (-1) through the tracker states. */
export function stepPerson(c: Connect, id: string, dir: 1 | -1, now: Date = new Date()): Connect {
  return {
    ...c,
    people: c.people.map((p) => {
      if (p.id !== id) return p;
      const i = Math.max(0, Math.min(STATUS_ORDER.length - 1, STATUS_ORDER.indexOf(p.status) + dir));
      const status = STATUS_ORDER[i];
      const next: Person = { ...p, status };
      if (dir === 1 && status === "sent") next.sentAt = now.toISOString();
      if (dir === 1 && status === "messaged") next.messagedAt = now.toISOString();
      // Going back before "sent" un-sends it, so the note isn't counted; already-sent notes are not refunded on removal.
      if (i < STATUS_ORDER.indexOf("sent")) next.sentAt = undefined;
      if (i < STATUS_ORDER.indexOf("messaged")) next.messagedAt = undefined;
      return next;
    }),
  };
}

export function removePerson(c: Connect, id: string): Connect {
  return { ...c, people: c.people.filter((p) => p.id !== id) };
}

/** Messaged 5+ days ago with no reply: time for the follow-up draft. */
export function personFollowUpDue(p: Person, now: Date = new Date()): boolean {
  return p.status === "messaged" && !!p.messagedAt && daysBetween(p.messagedAt, now) >= 5;
}

// ---- screenshot validation ----

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Returns an error message, or null if the image can be sent. */
export function validateImage(mediaType: string, base64: string): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(mediaType)) return "Use a PNG, JPG or WebP screenshot.";
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > IMAGE_MAX_BYTES) return "That screenshot is over 4 MB. Crop it to the profile or post and try again.";
  return null;
}

// ---- demo mode (no AI key) ----

/** Drop runs of 2+ capitalised words (likely a person's full name) from free text. */
export function stripNames(text: string): string {
  return text
    .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n).trimEnd() : t;
}

export function mockLookFor(profile: ProfileInput, turns: Turn[]): LookFor[] {
  const role = profile.targetRole.trim();
  const targetsRaw = turns[5] && turns[5].a !== "(skipped)" ? turns[5].a : "";
  const targets = clip(stripNames(targetsRaw), 60);
  const cards: LookFor[] = [
    { who: `${role} team leads and managers`, why: "They decide who gets hired into the team, and they read short, specific notes.", search: `${role} manager` },
    { who: `People who joined as a ${role} in the last 2 years`, why: "They remember the job hunt and answer questions about the first year honestly.", search: `${role} fresher` },
    { who: `Alumni of your college working in ${role} roles`, why: "A shared college is the easiest reason to say yes to a 15-minute chat.", search: `${role} alumni` },
    { who: `Recruiters hiring for ${role} roles`, why: "They can tell you which openings are real and what the shortlist looks for.", search: `recruiter ${role}` },
    { who: `People who post about ${role} work`, why: "Commenting on their posts first warms them up before you connect.", search: `${role}` },
  ];
  if (targets) {
    // Search on the places and companies they named (capitalised words after the first), not the whole sentence.
    const names = targets
      .split(/\s+/)
      .slice(1)
      .map((w) => w.replace(/[^\w&-]/g, ""))
      .filter((w) => /^[A-Z]/.test(w))
      .slice(0, 2);
    cards.splice(1, 0, {
      who: `${role} people at: ${targets}`,
      why: "These are the places you said you want to reach.",
      search: [role, ...names].join(" "),
    });
  }
  return cards;
}

/** Demo note from a pasted profile: uses no facts from the pasted text, only blanks. */
export function mockNote(profile: ProfileInput, pasted: string): { who: string; hook: string; note: string } {
  void pasted; // Demo mode doesn't read the pasted profile; the AI does.
  return {
    who: "Demo mode doesn't read profiles. Add your own label in the tracker below.",
    hook: "Pick one specific thing from their profile or post and put it in the note.",
    note: `Hi [[their first name]], I read your [[post or project]]. I'm working towards ${clip(profile.targetRole, 40)} roles and would like to follow your work. Glad to connect.`,
  };
}
