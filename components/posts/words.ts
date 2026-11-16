import { formatDay } from "@/lib/ist";
import type { Post, PostType } from "./api";

export const TYPE_WORDS: Record<PostType, string> = {
  proof: "Proof of work",
  setback: "Something that went wrong",
  observation: "Something I noticed",
};

/** "Thu, 12 Nov, 09:00 IST" for an instant. */
export function istWhen(iso: string): string {
  const ist = new Date(new Date(iso).getTime() + 330 * 60_000).toISOString();
  return `${formatDay(ist.slice(0, 10))}, ${ist.slice(11, 16)} IST`;
}

/** The state of a post in words, never in colour alone. */
export function stateWords(p: Post | null): string {
  if (!p) return "Not started";
  switch (p.status) {
    case "draft": return p.currentVersionId ? "Draft ready" : "Answering questions";
    case "approved": return "Approved";
    case "scheduled": {
      const when = p.scheduledAt ? ` for ${istWhen(p.scheduledAt)}` : "";
      return p.publishMode === "auto" ? `Scheduled${when}` : `Reminder set${when}`;
    }
    case "publishing": return "Publishing now";
    case "published": return "Posted";
    case "failed": return "Failed";
    case "unknown": return "Check LinkedIn";
    case "cancelled": return "Cancelled";
  }
}

export function toneOf(p: Post | null): "neutral" | "accent" | "good" | "warn" | "bad" {
  if (!p) return "neutral";
  if (p.status === "published") return "good";
  if (p.status === "failed") return "bad";
  if (p.status === "unknown" || p.status === "cancelled") return "warn";
  if (p.status === "draft") return p.currentVersionId ? "accent" : "neutral";
  return "accent";
}

export const wordsIn = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** The time now in IST as HH:MM. */
export const istClock = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(11, 16);
