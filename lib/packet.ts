/**
 * One person, one message (prod/lynkr-message-checker-outreach-build-plan.md §4–§7,
 * prod/lynkr-outreach-intelligence-plan.md §4–§6). The user supplies a short
 * "relevance packet": how they know the person, one real thing to mention, why
 * this person, and one ask. Lynkr decides whether there is a good reason to write
 * before it helps with wording, and never fills a missing detail with praise.
 */
import type { Bridge, Channel, ConnectReply, FactRef, Intent, Packet, ProfileInput } from "./schemas";
import { checkMessage, CHANNEL_RULES, type Relationship } from "./checker";
import { STAGE_PHRASE } from "./roles";

export const INTENT_LABEL: Record<Intent, string> = {
  learn_role: "Learn what the role is like",
  work_question: "Ask one question about their work",
  feedback: "Get feedback on something I made",
  explore_team: "Understand a team or company",
  live_job: "Ask about a live job opening",
  referral: "Ask for a referral",
  follow_up: "Follow up after no reply",
  thank_you: "Say thanks after a conversation",
};

export const BRIDGE_LABEL: Record<Bridge, string> = {
  knows_me: "They know me",
  worked_studied: "We worked or studied together",
  alumni: "Same college or cohort",
  event: "We met at an event or community",
  mutual_intro: "Someone introduced us, with permission",
  public_work: "I read or used their public work",
  live_role: "They're hiring for a live role",
  none: "No link yet",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  connection_note: CHANNEL_RULES.connection_note.label,
  linkedin_message: CHANNEL_RULES.linkedin_message.label,
  inmail: CHANNEL_RULES.inmail.label,
  email: CHANNEL_RULES.email.label,
};

export const EMPTY_PACKET: Packet = {
  intent: "work_question",
  bridge: "public_work",
  channel: "connection_note",
  recipientRole: "",
  roleChecked: false,
  anchor: "",
  anchorSource: "",
  whyThem: "",
  ask: "",
};

/** The ask-ladder rung this bridge sits on. */
export function relationshipOf(b: Bridge): Relationship {
  if (b === "knows_me" || b === "worked_studied") return "knows_me";
  if (b === "alumni") return "alumni";
  return "stranger";
}

/** A real shared history the message may refer to (a call, a meeting, an introduction). */
export function hasSharedHistory(b: Bridge): boolean {
  return b === "knows_me" || b === "worked_studied" || b === "event" || b === "mutual_intro";
}

/** What to ask, and what to avoid, for this situation (checker plan §7). */
export function askAdvice(p: Packet): { suggest: string; avoid: string } {
  const rel = relationshipOf(p.bridge);
  if (p.intent === "thank_you") return { suggest: "Thank them, recall one real detail, confirm any promised next step.", avoid: "A second ask in the same message." };
  if (p.intent === "follow_up") return { suggest: "One useful update or one easy question, then stop.", avoid: "\"Just following up\", urgency or repeated nudges." };
  if (p.intent === "referral") {
    return rel === "knows_me" || p.bridge === "mutual_intro"
      ? { suggest: "Ask if they're comfortable referring you. Give the job ID or link, a true reason you fit and your resume.", avoid: "Asking them to vouch without context." }
      : { suggest: "Don't ask for a referral yet. Ask one specific question about their work or team first.", avoid: "A referral request to someone who doesn't know you." };
  }
  if (p.bridge === "live_role") return { suggest: "One question tied to the actual opening or process.", avoid: "Assuming they own the hiring decision." };
  if (p.bridge === "alumni") return { suggest: "One question about their role or team. A short chat can be optional.", avoid: "Acting closer than you are, or opening with a referral." };
  if (p.bridge === "event") return { suggest: "Continue the conversation from the event with one relevant question.", avoid: "Claiming an interaction that didn't happen." };
  if (rel === "knows_me") return { suggest: "Ask directly for the specific feedback, advice or introduction you need.", avoid: "Over-explaining your background." };
  return { suggest: "One specific question about a piece of their work you actually read.", avoid: "Generic praise, or asking a stranger for a job, a referral or a call." };
}

export type ContactStatus = "good" | "need_detail" | "other_route" | "hold";

export type ContactDecision = { status: ContactStatus; label: string; reason: string; next: string };

const CONTACT_LABEL: Record<ContactStatus, string> = {
  good: "Good reason to contact",
  need_detail: "Need one more detail",
  other_route: "Consider another person or channel",
  hold: "Hold off",
};

const VAGUE_ANCHOR = /^(their|your)?\s*(profile|journey|work|experience|background)\.?$|\b(works? at|working at|is at)\b/i;

/** Step 1 of the checker: is this the right person and reason, before any wording? */
export function contactDecision(p: Packet): ContactDecision {
  const rel = relationshipOf(p.bridge);
  const d = (status: ContactStatus, reason: string, next: string): ContactDecision => ({ status, label: CONTACT_LABEL[status], reason, next });

  if (p.intent === "referral" && rel === "stranger" && p.bridge !== "mutual_intro") {
    return d("hold", "A referral asks them to vouch for you, and they don't know you yet.", "Ask one question about their work first, or find someone who knows you.");
  }
  if (p.intent === "live_job" && p.bridge === "none") {
    return d("other_route", "A live job is a good reason only if this person is connected to it.", "Check they work on that team or recruit for it, or use the company's own application route.");
  }
  const anchor = p.anchor.trim();
  if (p.bridge === "none" && (!anchor || VAGUE_ANCHOR.test(anchor))) {
    return d(
      "other_route",
      "\"They work at a company I like\" isn't a reason they'll recognise.",
      "Find one thing they made or said that you actually read, look for a stronger link (alumni, an event), or skip this person.",
    );
  }
  if (!knowsWell(p.bridge) && anchor.length < 12) {
    return d("need_detail", "There's no specific thing to mention yet.", "Add one real thing: a post, talk, project or the event where you met.");
  }
  if (!p.ask.trim()) {
    return d("need_detail", "There's no ask yet.", "Write the one question or next step you want.");
  }
  if (p.recipientRole.trim() && !p.roleChecked) {
    return d("need_detail", "Their current role isn't confirmed.", "Check their current title and team yourself, then tick \"I checked this\".");
  }
  return d("good", reasonFor(p), "Write it, then review every line yourself.");
}

const knowsWell = (b: Bridge) => b === "knows_me" || b === "worked_studied" || b === "mutual_intro";

function reasonFor(p: Packet): string {
  if (p.bridge === "public_work") return "You have a specific piece of their work to respond to.";
  if (p.bridge === "alumni") return "You share a college and have a specific reason to ask them.";
  if (p.bridge === "event") return "You met them, and have something to continue.";
  if (p.bridge === "live_role") return "There's a live role they're connected to.";
  return "You have a real relationship and a clear ask.";
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

/** The user's ask as its own sentence: capitalised, ending in a question mark. */
const asQuestion = (s: string) => {
  const t = s.trim().replace(/[.!\s]+$/, "");
  const q = t.endsWith("?") ? t : `${t}?`;
  return q.charAt(0).toUpperCase() + q.slice(1);
};

function bridgeSentence(p: Packet): string {
  const a = clip(p.anchor, 110);
  switch (p.bridge) {
    case "public_work":
      return `I read your ${a}.`;
    case "alumni":
      return `We both studied at [[your college]]. ${a ? `I saw your ${a}.` : ""}`.trim();
    case "event":
      return `We met at ${a || "[[the event]]"}.`;
    case "mutual_intro":
      return `[[their name]] suggested I write to you.${a ? ` ${a}.` : ""}`;
    case "live_role":
      return `I'm looking at the ${a || "[[role title]]"} opening${/\b(job|req|id|http)/i.test(p.anchorSource) ? ` (${clip(p.anchorSource, 60)})` : " ([[job ID or link]])"}.`;
    case "worked_studied":
    case "knows_me":
      return a ? `${a.charAt(0).toUpperCase()}${a.slice(1)}.` : "";
    default:
      return a ? `I saw your ${a}.` : "";
  }
}

/** "I'm a final-year student working towards data analyst roles." */
export function whoLine(profile: ProfileInput): string {
  const role = clip(profile.targetRole, 40);
  if (profile.stage === "switching") return `I'm moving into ${role} work.`;
  if (profile.stage === "early_career") return `I'm early in my career and working towards ${role} roles.`;
  const stage = STAGE_PHRASE[profile.stage];
  return `I'm ${stage ? `${stage} ` : ""}working towards ${role} roles.`;
}

/**
 * Demo-mode draft, and the shape the AI must follow: uses only the packet and the
 * facts the user picked. Returns needs_context / do_not_send instead of filling gaps.
 */
export function composeNote(profile: ProfileInput, p: Packet, facts: FactRef[]): ConnectReply {
  const decision = contactDecision(p);
  if (decision.status === "hold") {
    return { fitStatus: "do_not_send", body: "", whyThisIsRelevant: decision.reason, question: decision.next, factRefs: [] };
  }
  if (decision.status !== "good") {
    return { fitStatus: "needs_context", body: "", whyThisIsRelevant: decision.reason, question: decision.next, factRefs: [] };
  }
  const who = whoLine(profile);
  const fact = facts[0] ? `${clip(facts[0].text, 120)}.` : "";
  const ask = asQuestion(p.ask);
  const isNote = p.channel === "connection_note";
  const out = p.intent === "thank_you" || p.intent === "follow_up" || isNote ? "" : "No worries if you're busy.";
  const parts = [`Hi [[their first name]],`, bridgeSentence(p), who, fact, ask, out].filter(Boolean);
  let body = parts.join(" ");
  const rule = CHANNEL_RULES[p.channel];
  // A note must fit: drop the fact first, then the "who I am" line, before giving up.
  if (rule.unit === "chars" && body.length > rule.max) body = [parts[0], parts[1], who, ask].filter(Boolean).join(" ");
  if (rule.unit === "chars" && body.length > rule.max) body = [parts[0], parts[1], ask].filter(Boolean).join(" ");
  const used = body.includes(fact) && fact ? [facts[0].id] : [];
  const result = checkMessage(body.replace(/\[\[[^\]]+\]\]/g, "Asha"), relationshipOf(p.bridge), {
    channel: p.channel,
    intent: p.intent,
    sharedHistory: hasSharedHistory(p.bridge),
  });
  const tooLong = rule.unit === "chars" && body.length > rule.max;
  return {
    fitStatus: result.verdict === "Do not send yet" && !tooLong ? "do_not_send" : "ready_for_review",
    body,
    whyThisIsRelevant: `${decision.reason}${p.whyThem.trim() ? ` You said: "${clip(p.whyThem, 120)}".` : ""}`,
    question: tooLong ? "It's over the note limit. Shorten your observation or your ask." : "",
    factRefs: used,
  };
}
