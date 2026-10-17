import { daysBetween, mondayOf, todayIST } from "./ist";
import type { Relationship } from "./checker";
import type { Bridge, Channel, Intent, ProfileInput, StoryFact } from "./schemas";
import { matchRole } from "./roles";

/**
 * Connect Coach: who to look for, the note budget and a local people tracker.
 * Specs: research/spec-connect-coach.md, prod/lynkr-outreach-intelligence-plan.md §5 and §7.
 * Everything here stays in this browser. No names are suggested, nothing is searched for you.
 */

/** Funnel stages. Channels without an invitation (email, a message to an existing connection) skip invited/accepted. */
export type PersonStatus = "considered" | "invited" | "accepted" | "messaged" | "replied";

export const OUTCOMES = ["useful_answer", "conversation_booked", "introduced", "role_info", "referral_offered", "no_reply", "declined", "stopped"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const OUTCOME_LABEL: Record<Outcome, string> = {
  useful_answer: "Useful answer",
  conversation_booked: "Conversation booked",
  introduced: "Introduced to someone",
  role_info: "Learned about the role",
  referral_offered: "Referral offered",
  no_reply: "No reply",
  declined: "Declined",
  stopped: "I chose to stop",
};
export const USEFUL: Outcome[] = ["useful_answer", "conversation_booked", "introduced", "role_info", "referral_offered"];

export type Person = {
  id: string;
  label: string;
  relationship: Relationship;
  bridge?: Bridge;
  channel?: Channel;
  intent?: Intent;
  withNote: boolean;
  status: PersonStatus;
  addedAt: string;
  invitedAt?: string;
  acceptedAt?: string;
  messagedAt?: string;
  repliedAt?: string;
  outcome?: Outcome;
  outcomeAt?: string;
};

export type Connect = { monthlyNotes: number; weeklyCap: number; people: Person[] };

export type LookFor = { who: string; why: string; search: string; tier: "known" | "shared" | "public_work" | "company"; firstDegree?: boolean };

export const DEFAULT_CONNECT: Connect = { monthlyNotes: 3, weeklyCap: 5, people: [] };

export const STATUS_LABEL: Record<PersonStatus, string> = {
  considered: "To find",
  invited: "Invited",
  accepted: "Accepted",
  messaged: "Messaged",
  replied: "Replied",
};

export const NOTE_MAX = 200;

/** True when this person starts with a connection request, so invited/accepted apply. */
export const usesInvite = (p: Pick<Person, "channel">) => !p.channel || p.channel === "connection_note";

export function stagesFor(p: Pick<Person, "channel">): PersonStatus[] {
  return usesInvite(p) ? ["considered", "invited", "accepted", "messaged", "replied"] : ["considered", "messaged", "replied"];
}

export function searchUrl(keywords: string, firstDegree = false): string {
  const net = firstDegree ? `&network=${encodeURIComponent('["F"]')}` : "";
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}${net}`;
}

/** A web search the user runs themselves. Lynkr never fetches the results. */
export function webSearchUrl(q: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Older saves used to_find/sent and sentAt. */
export function migratePerson(p: Omit<Person, "status"> & { status: string; sentAt?: string }): Person {
  const status = (p.status === "to_find" ? "considered" : p.status === "sent" ? "invited" : p.status) as PersonStatus;
  const { sentAt, ...rest } = p;
  return { ...rest, status, invitedAt: p.invitedAt ?? sentAt };
}

// ---- budget and cap (IST month / week) ----

export function notesUsedThisMonth(people: Person[], now: Date = new Date()): number {
  const month = todayIST(now).slice(0, 7);
  return people.filter((p) => p.withNote && p.invitedAt && todayIST(new Date(p.invitedAt)).slice(0, 7) === month).length;
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

export function addPerson(
  c: Connect,
  label: string,
  relationship: Relationship,
  withNote: boolean,
  now: Date = new Date(),
  extra: Partial<Pick<Person, "bridge" | "channel" | "intent">> = {},
): Connect {
  const person: Person = {
    id: `p-${now.getTime().toString(36)}-${c.people.length}`,
    label: label.trim().slice(0, 120),
    relationship,
    withNote: withNote && usesInvite(extra),
    status: "considered",
    addedAt: now.toISOString(),
    ...extra,
  };
  return { ...c, people: [...c.people, person] };
}

const STAMP: Partial<Record<PersonStatus, keyof Person>> = {
  invited: "invitedAt",
  accepted: "acceptedAt",
  messaged: "messagedAt",
  replied: "repliedAt",
};

/** Move a person one step forward (+1) or back (-1) along their channel's stages. */
export function stepPerson(c: Connect, id: string, dir: 1 | -1, now: Date = new Date()): Connect {
  return {
    ...c,
    people: c.people.map((p) => {
      if (p.id !== id) return p;
      const stages = stagesFor(p);
      const i = Math.max(0, Math.min(stages.length - 1, stages.indexOf(p.status) + dir));
      const status = stages[i];
      const next: Person = { ...p, status };
      const key = STAMP[status];
      if (dir === 1 && key) (next as Record<string, unknown>)[key] = now.toISOString();
      // Going back clears the later stamps, so an un-sent note isn't counted. Notes already used aren't refunded on removal.
      for (const later of stages.slice(i + 1)) {
        const k = STAMP[later];
        if (k) (next as Record<string, unknown>)[k] = undefined;
      }
      return next;
    }),
  };
}

export function setOutcome(c: Connect, id: string, outcome: Outcome | undefined, now: Date = new Date()): Connect {
  return { ...c, people: c.people.map((p) => (p.id === id ? { ...p, outcome, outcomeAt: outcome ? now.toISOString() : undefined } : p)) };
}

export function removePerson(c: Connect, id: string): Connect {
  return { ...c, people: c.people.filter((p) => p.id !== id) };
}

/** Messaged 5+ days ago with no reply and not stopped: one follow-up is reasonable, then stop. */
export function personFollowUpDue(p: Person, now: Date = new Date()): boolean {
  return p.status === "messaged" && !!p.messagedAt && !p.outcome && daysBetween(p.messagedAt, now) >= 5;
}

// ---- funnel: separate stages, visible denominators, mature cohorts only ----

export const ACCEPT_WINDOW = 14;
export const REPLY_WINDOW = 7;
/** Below this many mature attempts, show counts only. */
export const MIN_FOR_RATE = 5;

export type Funnel = {
  considered: number;
  invited: number;
  /** Invitations old enough to judge. */
  invitedMature: number;
  acceptedOfMature: number;
  pendingMature: number;
  messaged: number;
  messagedMature: number;
  repliedOfMature: number;
  useful: number;
};

export function funnel(people: Person[], now: Date = new Date()): Funnel {
  const old = (iso: string | undefined, days: number) => !!iso && daysBetween(iso, now) >= days;
  const invited = people.filter((p) => p.invitedAt);
  const mature = invited.filter((p) => old(p.invitedAt, ACCEPT_WINDOW));
  const messaged = people.filter((p) => p.messagedAt);
  const msgMature = messaged.filter((p) => old(p.messagedAt, REPLY_WINDOW));
  return {
    considered: people.length,
    invited: invited.length,
    invitedMature: mature.length,
    acceptedOfMature: mature.filter((p) => p.acceptedAt).length,
    pendingMature: mature.filter((p) => !p.acceptedAt).length,
    messaged: messaged.length,
    messagedMature: msgMature.length,
    repliedOfMature: msgMature.filter((p) => p.repliedAt).length,
    useful: people.filter((p) => p.outcome && USEFUL.includes(p.outcome)).length,
  };
}

/** "Where is it stuck?" (outreach plan §7): advice per stage, never a verdict on the person. */
export const DIAGNOSE: Record<string, { label: string; advice: string }> = {
  finding: { label: "I can't find useful people", advice: "Change the role keywords on the search cards, add your specialisation, or try an alumni or event route instead of company name alone." },
  accepting: { label: "Few people accept", advice: "Check the target fits your goal and stage, the note mentions one real thing, and you're inviting people you have a reason to know. A shorter note or no note to warm contacts can help." },
  replying: { label: "They accept but don't reply", advice: "Make the first message after accepting one low-effort question about their work, and send it soon after they accept. Don't ask for a referral or a call first." },
  next_step: { label: "Replies, but nothing comes of it", advice: "Be clearer about what you want: a specific question, feedback on one thing, or an introduction. Say it once, plainly." },
  unsure: { label: "I don't know where it's stuck", advice: "Track your next 8 to 10 people here for two weeks before changing anything. Small numbers swing a lot." },
};

// ---- who to look for: kinds of people, best bridge first, never named people ----

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

export function lookFor(profile: ProfileInput, facts: Pick<StoryFact, "kind" | "text">[]): LookFor[] {
  const role = profile.targetRole.trim();
  const spec = profile.specialization?.trim() ?? "";
  const market = profile.market?.trim() ?? "";
  const pattern = matchRole(role);
  const withSpec = (q: string) => [q, spec].filter(Boolean).join(" ");

  const cards: LookFor[] = [
    {
      tier: "known",
      who: "People you already know who are near this work",
      why: "Classmates, seniors, internship mentors and former colleagues are the best first messages. Start here.",
      search: role,
      firstDegree: true,
    },
    {
      tier: "shared",
      who: `${role} people from your college or community`,
      why: "A shared college, club or event is a real reason they'll recognise. Add your college name to the search.",
      search: withSpec(`${role} alumni`),
    },
  ];
  for (const l of (pattern?.lookFor ?? []).slice(0, 2)) {
    cards.push({ tier: "public_work", who: l.who, why: l.why, search: withSpec([l.query, market].filter(Boolean).join(" ")) });
  }
  if (!pattern) {
    cards.push({ tier: "public_work", who: `People who post about ${role} work`, why: "A post you actually read gives you a specific reason to write.", search: withSpec(role) });
  }

  const target = facts.find((f) => f.kind === "target");
  const named = target
    ? clip(stripNames(target.text), 80)
        .split(/\s+/)
        .slice(1)
        .map((w) => w.replace(/[^\w&-]/g, ""))
        .filter((w) => /^[A-Z]/.test(w))
        .slice(0, 2)
    : [];
  if (named.length) {
    cards.push({
      tier: "company",
      who: `${role} people at ${named.join(", ")}`,
      why: "Working at a company you like isn't a reason they'll recognise. Find one thing they made or said before you write.",
      search: [role, ...named].join(" "),
    });
  }
  return cards.slice(0, 5);
}

export const OTHER_ROUTES = [
  "Your college's alumni page or placement cell",
  "A professional association or student chapter in your field",
  "Speaker lists from meetups and conferences you attended or watched",
  "A company's own team or engineering blog",
  "Open-source projects or public portfolios you have used",
];

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
