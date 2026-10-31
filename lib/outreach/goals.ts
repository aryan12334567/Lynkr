/**
 * Outreach goals (build plan U2). Data-driven: add a goal or a field here, not in callers.
 *
 * Stable exports other units import:
 *   GOAL_IDS, OutreachGoal           the 10 goal ids
 *   GOALS, goalFor(id)               the goal catalog (label, details, targets, signals, intents, success)
 *   defaultIntent(goal, rel)         default intent per relationship (reads GoalDefinition.intents)
 *   preselectGoals(wants|labels)     interview wants (or their labels) to preselected outreach goals
 *   unansweredGoalDetails(goal, facts)  details not yet answered by a confirmed goal_detail fact
 *   goalDetailFact(goal, key, answer)   the goal_detail fact to save for an answer
 *   saveOutreachGoals(db, user, goals, details)  persist goals in context_brief.data.outreach + detail facts
 *   readOutreachGoals(db, user)      the saved goals
 * Playbooks (goal x relationship) live in ./playbooks and read GOALS.
 */
import type { Want, Intent, StoryFact } from "../schemas";
import { WANT_LABEL } from "../schemas";
import type { Relationship } from "../checker";
import { getBrief, saveBrief, saveFacts, type Db } from "../db";

export const GOAL_IDS = ["job", "referral", "network", "mentor", "clients", "hiring", "funding", "buy_business", "partner", "reconnect"] as const;
export type OutreachGoal = (typeof GOAL_IDS)[number];

/** One question about a goal: tap an option or type your own answer. */
export type GoalDetail = { key: string; question: string; options: readonly string[]; freeText: true };
export type GoalDefinition = {
 id: OutreachGoal;
 label: string;
 description: string;
 /** Interview wants that preselect this goal. */
 wants: readonly Want[];
 /** At most 3. */
 details: readonly GoalDetail[];
 /** Default target types, and the signals that matter when picking people. */
 targets: readonly string[];
 signals: readonly string[];
 /** Default intent for each relationship. */
 intents: Record<Relationship, Intent>;
 /** What counts as success for this goal. */
 success: string;
};

const detail = (key: string, question: string, ...options: string[]): GoalDetail => ({ key, question, options, freeText: true });

export const GOALS: readonly GoalDefinition[] = [
 { id: "job", label: "Find a job", description: "Learn about roles and teams that fit your work.", wants: ["job", "internship"],
  details: [detail("role", "What kind of role are you looking for?", "Full time", "Internship", "Contract"), detail("focus", "What kind of work do you want to do?", "The work I do now", "Something adjacent", "A new direction"), detail("location", "Where would you like to work?", "Remote", "Hybrid", "On site")],
  targets: ["People doing the role you want", "Team leads at companies you like", "Alumni at those companies"], signals: ["Open roles", "Team changes", "Public work"],
  intents: { stranger: "learn_role", alumni: "learn_role", knows_me: "live_job" }, success: "You learn how the role works, or hear about a real opening" },
 { id: "referral", label: "Get a referral", description: "Ask someone who knows your work about a specific role.", wants: ["referral"],
  details: [detail("job", "Which role is this for?", "A specific open role", "Not chosen yet"), detail("fit", "What makes your work a fit for it?", "I have done similar work", "I am moving into it"), detail("company", "Which company is it at?", "A company I chose", "Still deciding")],
  targets: ["People who know your work", "People on the team that is hiring"], signals: ["Open roles", "A way in you already have"],
  intents: { stranger: "learn_role", alumni: "learn_role", knows_me: "referral" }, success: "A referral is offered, or you learn what the team looks for" },
 { id: "network", label: "Learn and network", description: "Meet people and exchange ideas about your field.", wants: ["network"],
  details: [detail("topic", "What would you like to learn about?", "Their work", "Their field", "How they got started"), detail("outcome", "What would you like from the conversation?", "Learn how they work", "Hear their path", "Swap ideas")],
  targets: ["Peers", "Practitioners in your field"], signals: ["Public work", "Shared interests"],
  intents: { stranger: "work_question", alumni: "work_question", knows_me: "work_question" }, success: "A useful reply or conversation" },
 { id: "mentor", label: "Find a mentor", description: "Meet people whose experience you can learn from.", wants: ["mentor"],
  details: [detail("topic", "What would you like guidance on?", "Career direction", "Skills", "Starting out"), detail("stage", "Where are you now?", "Student", "Early career", "Mid career")],
  targets: ["Experienced practitioners", "People a few steps ahead of you"], signals: ["Public work", "Teaching or writing"],
  intents: { stranger: "work_question", alumni: "feedback", knows_me: "feedback" }, success: "Advice received, or an ongoing conversation" },
 { id: "clients", label: "Win clients or close a deal", description: "Find people who could benefit from your work.", wants: ["clients"],
  details: [detail("offer", "What do you offer?", "A service", "A product"), detail("buyer", "Who is it for?", "Teams", "Businesses", "Individuals"), detail("result", "What result have you delivered?", "A client result", "A project", "Not yet")],
  targets: ["Potential buyers", "Owners of the problem you solve"], signals: ["Company changes", "Public problems you can help with"],
  intents: { stranger: "work_question", alumni: "work_question", knows_me: "explore_team" }, success: "A conversation with a buyer" },
 { id: "hiring", label: "Hire someone", description: "Meet potential candidates for your team.", wants: [],
  details: [detail("role", "What role are you hiring for?", "Full time", "Contract", "Internship"), detail("level", "What level?", "Junior", "Mid", "Senior"), detail("work", "What would the person work on?", "Product", "Operations", "Growth")],
  targets: ["Potential candidates", "People who know good candidates"], signals: ["Relevant experience", "Public work"],
  intents: { stranger: "work_question", alumni: "work_question", knows_me: "live_job" }, success: "A candidate conversation" },
 { id: "funding", label: "Raise funding", description: "Start conversations with potential investors.", wants: [],
  details: [detail("stage", "What stage are you at?", "Pre-seed", "Seed", "Later"), detail("traction", "What progress can you share?", "Customers", "Revenue", "Usage"), detail("use", "What will the money be used for?", "Build product", "Hire", "Grow sales")],
  targets: ["Investors who back your stage", "Operators who angel invest"], signals: ["Investment focus", "Recent investments"],
  intents: { stranger: "work_question", alumni: "work_question", knows_me: "feedback" }, success: "An investor conversation" },
 { id: "buy_business", label: "Buy a business", description: "Start a discreet conversation with a business owner.", wants: [],
  details: [detail("kind", "What kind of business?", "Software", "Services", "Other"), detail("size", "What size range?", "Small", "Medium"), detail("why", "Why are you interested?", "Operate it", "Grow it")],
  targets: ["Business owners", "Advisers who know owners"], signals: ["Company news", "Owner tenure"],
  intents: { stranger: "work_question", alumni: "work_question", knows_me: "work_question" }, success: "An owner conversation" },
 { id: "partner", label: "Find a partner", description: "Explore a possible collaboration.", wants: [],
  details: [detail("kind", "What kind of partnership?", "Distribution", "Product", "Community"), detail("bring", "What can you bring?", "Audience", "Skills", "A product"), detail("need", "What would you hope they bring?", "Reach", "Skills", "A product")],
  targets: ["Potential partners", "People with an audience you share"], signals: ["Shared work", "Complementary products"],
  intents: { stranger: "work_question", alumni: "work_question", knows_me: "explore_team" }, success: "A partnership conversation" },
 { id: "reconnect", label: "Reconnect", description: "Get back in touch with people you already know.", wants: [],
  details: [detail("reason", "What would you like to reconnect about?", "Catch up", "Work", "Advice"), detail("last", "When did you last talk?", "This year", "Last year", "Longer ago")],
  targets: ["People you know"], signals: ["Shared history", "Recent changes in their work"],
  intents: { stranger: "work_question", alumni: "follow_up", knows_me: "follow_up" }, success: "A reply" },
];

export function goalFor(id: OutreachGoal): GoalDefinition { return GOALS.find(g => g.id === id)!; }

// ---- after-meeting rules (build plan R40, R43) ----

/** Goals that are offered a "referral ask" step after a meeting. It does not change the first message (see defaultIntent). */
export const REFERRAL_ASK_GOALS: readonly string[] = ["job", "referral"];
export function allowsReferralAsk(goal: string): boolean { return REFERRAL_ASK_GOALS.includes(goal); }

/** Conversation goals: a meeting marked Useful meets their success text. */
export const CONVERSATION_GOALS: readonly string[] = ["network", "clients", "hiring", "funding", "buy_business", "partner"];

/** A record that may meet a goal's success text (R40). Rating "good" is how the meeting card stores Useful. */
export type SuccessRecord = { kind: "reply" } | { kind: "meeting_done"; happened: "yes" | "no_show" | "moved" | null; rating: "good" | "neutral" | "bad" | null };
/** Whether this record meets the goal's success, so Goal reached is ticked by default (the person can untick it). */
export function recordMeetsGoal(goal: string, record: SuccessRecord): boolean {
 if (record.kind === "reply") return goal === "reconnect";
 return CONVERSATION_GOALS.includes(goal) && record.happened === "yes" && record.rating === "good";
}
export function defaultIntent(goal: OutreachGoal, relationship: Relationship): Intent { return goalFor(goal).intents[relationship]; }

const WANT_BY_LABEL = new Map<string, Want>((Object.entries(WANT_LABEL) as [Want, string][]).map(([want, label]) => [label.toLowerCase(), want]));
/** Interview wants (ids or the labels the person saw) to preselected goals, in catalog order. */
export function preselectGoals(wants: readonly (Want | string)[]): OutreachGoal[] {
 const picked = new Set<string>(wants.map(w => WANT_BY_LABEL.get(String(w).toLowerCase()) ?? String(w)));
 return GOALS.filter(g => g.wants.some(w => picked.has(w))).map(g => g.id);
}

// ---- goal details as facts ----

/** Fact id for an answer: stable per goal and question so an answer is replaced, never duplicated. Fits the 12 character limit. */
const detailFactId = (goal: OutreachGoal, key: string): string => `D${GOAL_IDS.indexOf(goal)}${goalFor(goal).details.findIndex(d => d.key === key)}`;
const detailQid = (goal: OutreachGoal, key: string): string => `goal_detail:${goal}:${key}`;
const MAX_ANSWER = 200;

/** The confirmed fact that records an answer to one goal question. */
export function goalDetailFact(goal: OutreachGoal, key: string, answer: string): StoryFact {
 const def = goalFor(goal)?.details.find(d => d.key === key);
 if (!def) throw new Error("That is not a question for this goal.");
 const clean = answer.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_ANSWER).trim();
 if (!clean) throw new Error("Add an answer.");
 return { id: detailFactId(goal, key), kind: "goal_detail", text: `${def.question} ${clean}`, sourceTurnIds: [], reviewStatus: "confirmed", useInDrafts: true, sourceQid: detailQid(goal, key), updatedAt: new Date().toISOString() };
}

/** Details of a goal that no confirmed goal_detail fact answers yet. */
export function unansweredGoalDetails(goal: OutreachGoal, facts: readonly StoryFact[]): GoalDetail[] {
 return goalFor(goal).details.filter(d => !facts.some(f => f.kind === "goal_detail" && f.reviewStatus === "confirmed" && (f.sourceQid === detailQid(goal, d.key) || f.id === detailFactId(goal, d.key))));
}

// ---- saving ----

export type GoalDetailAnswer = { goal: OutreachGoal; key: string; answer: string };
const isGoal = (g: unknown): g is OutreachGoal => (GOAL_IDS as readonly unknown[]).includes(g);

/** Saved goals; an empty list when none or when the stored value is not valid. */
export async function readOutreachGoals(db: Db, userId: string): Promise<OutreachGoal[]> {
 const brief = await getBrief<{ outreach?: { goals?: unknown } }>(db, userId);
 const goals = brief?.data?.outreach?.goals;
 return Array.isArray(goals) ? goals.filter(isGoal) : [];
}

/**
 * Saves goals in context_brief.data.outreach (a new brief version only when the goals change; every other brief
 * field is kept as it was) and each answer as a confirmed goal_detail fact. Validates everything before writing.
 */
export async function saveOutreachGoals(db: Db, userId: string, goals: readonly OutreachGoal[], details: readonly GoalDetailAnswer[] = []): Promise<{ goals: OutreachGoal[]; version: number; detailsSaved: number }> {
 if (!goals.every(isGoal)) throw new Error("Choose valid goals.");
 const unique = [...new Set(goals)];
 const facts = details.map(d => {
  if (!isGoal(d.goal) || !unique.includes(d.goal)) throw new Error("Answer questions only for goals you chose.");
  return goalDetailFact(d.goal, d.key, d.answer);
 });
 const brief = await getBrief(db, userId);
 const data = (brief?.data ?? {}) as Record<string, unknown>;
 const old = data.outreach && typeof data.outreach === "object" ? data.outreach : {};
 const version = await saveBrief(db, userId, { ...data, outreach: { ...old, goals: unique } });
 const saved = facts.length ? (await saveFacts(db, userId, facts)).saved : 0;
 return { goals: unique, version, detailsSaved: saved };
}
