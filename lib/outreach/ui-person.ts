// The person card's plain rules: the profile link, chips, and what a draft's verdict and Mark sent mean.
import { searchUrl } from "../connect";
import type { Intent } from "../schemas";

export function profileLink(c: { name: string; company: string | null; profileUrl: string | null }): { href: string; label: string; known: boolean } {
  if (c.profileUrl) return { href: c.profileUrl, label: "Open profile", known: true };
  return { href: searchUrl([c.name, c.company].filter(Boolean).join(" ")), label: "Find on LinkedIn", known: false };
}

export const INTENTS: readonly { id: Intent; label: string }[] = [
  { id: "learn_role", label: "Learn about the role" },
  { id: "work_question", label: "Ask about their work" },
  { id: "feedback", label: "Ask for feedback" },
  { id: "explore_team", label: "Explore the team" },
  { id: "live_job", label: "Ask about an open job" },
  { id: "referral", label: "Ask for a referral" },
  { id: "follow_up", label: "Follow up" },
  { id: "thank_you", label: "Say thank you" },
];
export const intentLabel = (id: string): string => INTENTS.find((i) => i.id === id)?.label ?? id;

export const RELATIONSHIPS = [
  { id: "stranger", label: "Stranger" },
  { id: "alumni", label: "Alumni" },
  { id: "knows_me", label: "They know me" },
] as const;

export const CHANNEL_OPTIONS = [
  { id: "connection_note", label: "Connection note" },
  { id: "linkedin_message", label: "LinkedIn message" },
  { id: "inmail", label: "InMail" },
  { id: "email", label: "Email" },
] as const;
export type ChannelId = (typeof CHANNEL_OPTIONS)[number]["id"];

/** A message the checker blocks is never offered for copying (R17). */
export const canCopy = (verdict: string): boolean => verdict !== "Do not send yet";
export const verdictTone = (verdict: string): "good" | "warn" | "bad" => (verdict === "Do not send yet" ? "bad" : verdict === "Edit before sending" ? "warn" : "good");

/** The playbook angle id as the contact's `angleUsed` value (the route accepts angle_ followed by lowercase letters, digits and underscores). */
export const angleValue = (angle: string): string => `angle_${angle.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "other"}`;
export const angleLabel = (angle: string): string => { const t = angle.replace(/_/g, " "); return t.charAt(0).toUpperCase() + t.slice(1); };

/**
 * What Mark sent writes. A connection note is an invite (it uses one of the notes left this month); anything else is a message.
 * `notesLeft` is what the last draft said, or undefined when it did not say.
 */
export function sentPlan(result: { channel: string }, notesLeft: number | undefined): { kind: "invite_sent" | "message_sent"; noteUsed: boolean; notesLeft: number | undefined } {
  const note = result.channel === "connection_note";
  return { kind: note ? "invite_sent" : "message_sent", noteUsed: note, notesLeft: note && notesLeft !== undefined ? Math.max(0, notesLeft - 1) : notesLeft };
}
