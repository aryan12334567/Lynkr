/**
 * Playbooks (build plan U2): for every goal x relationship, how to open, what to ask, which Vault proof to use,
 * how long each channel's message may be, what a follow-up says and which moves are forbidden.
 *
 * Stable exports: Playbook, Angle, playbookFor(goal, relationship), PLAYBOOKS (all 30).
 * Data-driven: a goal is one entry in PLAY below; relationships that cannot use the goal's own ask name a
 * `fallback` (with the explanation shown to the user). Add or change a goal there, not in callers.
 *
 * Methods: Dalton's insight-first ask and TIARA (trends, insights, advice, resources, assistance) for job, network,
 * mentor; a value-first teardown offer for clients; a short, specific, confidential first approach for buying a
 * business; traction-first for funding.
 */
import type { FactKind, Channel, Intent } from "../schemas";
import { CHANNEL_RULES, type Relationship } from "../checker";
import { GOAL_IDS, type OutreachGoal, defaultIntent } from "./goals";

export type Angle = { id: string; label: string; use: string };
export type Playbook = {
 goal: OutreachGoal;
 relationship: Relationship;
 intent: Intent;
 /** 2 to 3 opening angles, best first. */
 angles: readonly Angle[];
 ask: string;
 /** Vault fact kinds that make good proof for this goal. */
 proof: readonly FactKind[];
 /** Most characters (connection note) or words (other channels) for this playbook. */
 lengths: Record<Channel, number>;
 followUp: string;
 forbidden: readonly string[];
 /** Set when this relationship cannot use the goal's own ask: the playbook used instead and why. */
 fallback: { goal: OutreachGoal; explanation: string } | null;
};

const RELATIONSHIPS = ["stranger", "alumni", "knows_me"] as const satisfies readonly Relationship[];
type Rels = readonly Relationship[];
const ALL: Rels = RELATIONSHIPS;
const WARM: Rels = ["alumni", "knows_me"];

const ANGLE_LIBRARY: Record<string, Angle & { rels: Rels }> = {
 insight: { id: "insight", label: "Insight first", rels: ALL, use: "Share one specific thing you learned or built that relates to their work, then ask for their view." },
 context: { id: "context", label: "Their work", rels: ALL, use: "Open with one specific, public thing about their role, team or company, then ask." },
 direct: { id: "direct", label: "Direct", rels: ALL, use: "Say who you are in one line, then ask the single question." },
 shared: { id: "shared", label: "Shared ground", rels: WARM, use: "Open with the connection you have confirmed (the same school or a person you both know), then ask." },
 role: { id: "role", label: "The specific role", rels: ["knows_me"], use: "Name the role, give one line on why your work fits, and offer the job link and your resume." },
 teardown: { id: "teardown", label: "Teardown offer", rels: ALL, use: "Offer one short, specific observation about their product or work, with no strings attached." },
 traction: { id: "traction", label: "Traction first", rels: ALL, use: "Lead with your strongest confirmed number or result, then ask." },
 confidential: { id: "confidential", label: "Confidential and brief", rels: ALL, use: "Say plainly why you are writing, promise discretion, and ask for a short private conversation." },
 idea: { id: "idea", label: "One specific idea", rels: ALL, use: "Name one concrete way your work and theirs could fit together." },
 invite: { id: "invite", label: "Why them", rels: ["knows_me"], use: "Describe what the person would work on and why you thought of them." },
 update: { id: "update", label: "What changed", rels: WARM, use: "Share one real update since you last spoke, then ask to catch up." },
};

type GoalPlay = {
 angles: readonly (keyof typeof ANGLE_LIBRARY)[];
 asks: Record<Relationship, string>;
 proof: readonly FactKind[];
 followUp: string | Record<Relationship, string>;
 forbidden: readonly string[];
 /** Shorter limits for this goal. */
 lengths?: Partial<Record<Channel, number>>;
 /** Relationships where the goal's own ask would be wrong: the intent falls back to the named goal's (learning), with the explanation for the user. */
 fallbacks?: Partial<Record<Relationship, { goal: OutreachGoal; explanation: string }>>;
};

const ONE_FOLLOW_UP = "Send at most one follow-up, and only with something new. If there is still no reply, stop.";

const PLAY: Record<OutreachGoal, GoalPlay> = {
 job: {
  angles: ["insight", "context", "role", "shared", "direct"],
  asks: {
   stranger: "What would you suggest someone focus on when learning about this work?",
   alumni: "Would you be open to a 15-minute chat about how you got into this work?",
   knows_me: "Do you know of any open roles on your team that fit my work?",
  },
  proof: ["project", "contribution", "evidence", "learning"],
  followUp: `Share one relevant update on your work since you wrote, then ask once more. ${ONE_FOLLOW_UP} After a reply, thank them and say what you did with their advice.`,
  forbidden: ["asking for any job or any opening", "attaching a resume to a first message to someone who does not know you"],
 },
 referral: {
  angles: ["role", "shared", "insight", "context", "direct"],
  asks: {
   stranger: "What would you suggest someone focus on when learning about this work?",
   alumni: "Would you be open to a 15-minute chat about what your team looks for?",
   knows_me: "Would you be comfortable referring me for the role?",
  },
  proof: ["project", "contribution", "evidence", "challenge"],
  followUp: {
   stranger: `Thank them for any reply and say what you did with their advice. ${ONE_FOLLOW_UP}`,
   alumni: `Thank them and share what you did with their advice. Ask about a referral only once they know your work. ${ONE_FOLLOW_UP}`,
   knows_me: "If they agree, send the job link and your resume the same day. If there is no reply, send one short nudge with the link, then stop.",
  },
  forbidden: ["asking for a referral without naming one specific role", "asking for a referral without the job link and your resume"],
  fallbacks: {
   stranger: { goal: "job", explanation: "A referral spends someone's reputation on a person they do not know, so this playbook asks to learn about their work instead. The referral ask comes later, once they know your work." },
   alumni: { goal: "job", explanation: "A referral needs someone who already knows your work, so this playbook asks to learn what their team looks for first. The referral ask comes later, once they know your work." },
  },
 },
 network: {
  angles: ["insight", "context", "shared", "direct"],
  asks: {
   stranger: "What has been most useful to you in this work?",
   alumni: "Would you be open to a 15-minute chat about your path in this field?",
   knows_me: "Would you be up for a catch-up on what you are working on now?",
  },
  proof: ["learning", "opinion", "project", "challenge"],
  followUp: `Share one useful link or idea related to what they do, then stop asking. ${ONE_FOLLOW_UP}`,
  forbidden: ["asking for a job or a referral", "asking for more than one thing"],
 },
 mentor: {
  angles: ["context", "insight", "shared", "direct"],
  asks: {
   stranger: "What is one thing you would suggest someone at my stage focus on?",
   alumni: "Would you be open to one 15-minute conversation about your experience?",
   knows_me: "Would you be willing to give me your view on my next step now and then?",
  },
  proof: ["learning", "challenge", "project", "opinion"],
  followUp: `Tell them what you did with their advice. People help again when they see it used. ${ONE_FOLLOW_UP}`,
  forbidden: ["asking someone to be your mentor outright", "asking for a long or open-ended commitment"],
 },
 clients: {
  angles: ["teardown", "insight", "context", "shared", "direct"],
  asks: {
   stranger: "Would it be useful if I sent a short teardown of one part of your work?",
   alumni: "Would you be open to a short conversation about how your team handles this today?",
   knows_me: "Would you like to talk through whether this could help your team?",
  },
  proof: ["offer", "evidence", "project", "contribution"],
  followUp: `Follow up once with a second, different observation about their work. Do not resend the first message. ${ONE_FOLLOW_UP}`,
  forbidden: ["a sales pitch in the first message", "attaching a deck, a price or a proposal unasked", "claims about client results you have not confirmed"],
 },
 hiring: {
  angles: ["context", "invite", "insight", "direct"],
  asks: {
   stranger: "Would you be open to a short conversation about the kind of work you want to do next?",
   alumni: "Would you be open to a short chat about the kind of work you want to do next?",
   knows_me: "Would you be interested in hearing about a role on my team?",
  },
  proof: ["offer", "project", "evidence"],
  followUp: `Follow up once with one concrete detail about the work. ${ONE_FOLLOW_UP}`,
  forbidden: ["naming a salary", "promising a role or terms you cannot offer"],
 },
 funding: {
  angles: ["traction", "insight", "shared", "context", "direct"],
  asks: {
   stranger: "Would you be open to a short conversation about whether this fits your investment interests?",
   alumni: "Would you be open to a 15-minute conversation about whether this fits what you invest in?",
   knows_me: "Would you give me your honest feedback on how I describe the progress so far?",
  },
  proof: ["evidence", "project", "contribution", "offer"],
  followUp: `Follow up once with a new milestone or number you have confirmed. Do not attach a deck unless they ask. ${ONE_FOLLOW_UP}`,
  forbidden: ["numbers for traction or revenue you have not confirmed", "asking for money in the first message", "attaching a deck unasked"],
 },
 buy_business: {
  angles: ["confidential", "shared", "context", "direct"],
  asks: {
   stranger: "Would you be open to a brief, confidential conversation about your business?",
   alumni: "Would you be open to a brief, confidential conversation about your business?",
   knows_me: "Would you be open to a private conversation about the future of your business?",
  },
  proof: ["contribution", "evidence", "learning"],
  followUp: "Follow up once, briefly and privately. If they decline, thank them and stop.",
  forbidden: ["naming a price", "hinting that the business is struggling", "asking them to share financials in the first message"],
  lengths: { connection_note: 180, linkedin_message: 60, inmail: 90, email: 100 },
 },
 partner: {
  angles: ["idea", "context", "insight", "shared", "direct"],
  asks: {
   stranger: "Would you be open to exploring whether our work could fit together?",
   alumni: "Would you be open to a short call to explore whether our work could fit together?",
   knows_me: "Would you be up for talking through a possible collaboration?",
  },
  proof: ["offer", "project", "evidence", "contribution"],
  followUp: `Follow up once with a sharper version of the idea. ${ONE_FOLLOW_UP}`,
  forbidden: ["a vague offer to collaborate with no specific idea", "claiming a shared audience or results you cannot show"],
 },
 reconnect: {
  angles: ["update", "shared", "insight", "context", "direct"],
  asks: {
   stranger: "What has been most useful to you in this work?",
   alumni: "Would you be open to catching up?",
   knows_me: "Would you be open to catching up soon?",
  },
  proof: ["project", "learning", "contribution"],
  followUp: `Keep it light: one line on what you are up to, and no new ask. ${ONE_FOLLOW_UP}`,
  forbidden: ["pretending a recent conversation happened", "putting an ask in the first line"],
  fallbacks: {
   stranger: { goal: "network", explanation: "Reconnecting needs a shared history, and a stranger has none with you. This playbook opens a first conversation about their work instead." },
  },
 },
};

const RELATIONSHIP_FORBIDDEN: Record<Relationship, readonly string[]> = {
 stranger: ["referral ask to a stranger", "invented relationship", "invented facts or numbers"],
 alumni: ["referral ask before they know your work", "invented relationship", "invented facts or numbers"],
 knows_me: ["invented relationship", "invented facts or numbers"],
};

const MAX_BY_RELATIONSHIP: Record<Relationship, Partial<Record<Channel, number>>> = {
 stranger: { linkedin_message: 70, inmail: 100, email: 120 },
 alumni: { linkedin_message: 80, inmail: 110, email: 140 },
 knows_me: {},
};

function lengthsFor(play: GoalPlay, relationship: Relationship): Record<Channel, number> {
 const out = {} as Record<Channel, number>;
 for (const channel of Object.keys(CHANNEL_RULES) as Channel[]) {
  out[channel] = Math.min(CHANNEL_RULES[channel].max, MAX_BY_RELATIONSHIP[relationship][channel] ?? Infinity, play.lengths?.[channel] ?? Infinity);
 }
 return out;
}

function anglesFor(play: GoalPlay, relationship: Relationship): readonly Angle[] {
 return play.angles.map(id => ANGLE_LIBRARY[id]).filter(a => a.rels.includes(relationship)).slice(0, 3).map(({ id, label, use }) => ({ id, label, use }));
}

function build(goal: OutreachGoal, relationship: Relationship): Playbook {
 const play = PLAY[goal];
 const followUp = typeof play.followUp === "string" ? play.followUp : play.followUp[relationship];
 return {
  goal, relationship, intent: defaultIntent(goal, relationship),
  angles: anglesFor(play, relationship), ask: play.asks[relationship], proof: play.proof,
  lengths: lengthsFor(play, relationship), followUp,
  forbidden: [...new Set([...RELATIONSHIP_FORBIDDEN[relationship], ...play.forbidden])],
  fallback: play.fallbacks?.[relationship] ?? null,
 };
}

export const PLAYBOOKS: readonly Playbook[] = GOAL_IDS.flatMap(goal => RELATIONSHIPS.map(relationship => build(goal, relationship)));
export function playbookFor(goal: OutreachGoal, relationship: Relationship): Playbook {
 return PLAYBOOKS.find(p => p.goal === goal && p.relationship === relationship)!;
}
