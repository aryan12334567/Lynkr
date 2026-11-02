import type { Contact, ContactStatus } from "./contacts-db";

/** A contact as the browser gets it: the same fields, with dates as ISO strings. */
type DateField = "invitedAt" | "acceptedAt" | "messagedAt" | "repliedAt" | "outcomeAt" | "nextActionAt" | "goalReachedAt" | "closedAt" | "createdAt" | "updatedAt";
export type UiContact = Omit<Contact, DateField> & { [K in DateField]: K extends "createdAt" | "updatedAt" ? string : string | null };

export const STAGES: readonly { id: ContactStatus; label: string }[] = [
  { id: "to_contact", label: "To contact" },
  { id: "invited", label: "Invited" },
  { id: "accepted", label: "Accepted" },
  { id: "messaged", label: "Messaged" },
  { id: "replied", label: "Replied" },
  { id: "meeting", label: "Meeting" },
  { id: "outcome", label: "Finished" },
];
export const stageLabel = (status: string): string => STAGES.find((s) => s.id === status)?.label ?? status;

type BoardLike = { id: string; status: string; tier: string; repliedAt?: string | null };

/** People who replied are Boosters: suggested first for later asks (R28). */
export const isBooster = (c: Pick<BoardLike, "repliedAt">): boolean => Boolean(c.repliedAt);

export function filterContacts<T extends BoardLike>(contacts: readonly T[], f: { tier1: boolean; boosters: boolean }): T[] {
  return contacts.filter((c) => (!f.tier1 || c.tier === "tier_1") && (!f.boosters || isBooster(c)));
}

/** One column per stage, in order, each with Tier 1 first. The stage comes from the timeline; nobody edits it. */
export function groupByStage<T extends BoardLike>(contacts: readonly T[]): { id: ContactStatus; label: string; contacts: T[] }[] {
  return STAGES.map((s) => ({
    ...s,
    contacts: contacts.filter((c) => c.status === s.id).sort((a, b) => Number(b.tier === "tier_1") - Number(a.tier === "tier_1")),
  }));
}
