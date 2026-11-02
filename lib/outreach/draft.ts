/**
 * Draft engine v2 (build plan U3, KTD4 / KTD5, KD2).
 *
 * The pipeline, deterministic first:
 *   1. the playbook for the goal and relationship (./playbooks) decides angle, ask and length;
 *   2. an evidence pack holds the only things a draft may state: at most 2 Story Vault facts (picked by
 *      `factsFor("outreach")`), at most 3 confirmed brief facts, the recipient's name, role and company;
 *   3. one model call writes 2 or 3 versions (the model writes wording only);
 *   4. the trace guard (`draftProblem`) and the checker's block rules run on every version;
 *   5. failing versions are regenerated once, then replaced by the composer;
 *   6. the composer writes complete text from the playbook and the evidence. It is the only path in demo mode,
 *      and its output passes the same guard.
 *
 * Extension points for later units (nothing here builds them):
 *   - `ExtendedDraftInput.extraEvidence`: labelled items a later unit adds to the pack, for example "why you
 *     connected" or a meeting note. They are sources for the trace guard but are not Vault or brief references.
 *   - `notesInDraftsOn()`: LYNKR_OUTREACH_NOTES_IN_DRAFTS=on is the switch for meeting notes (KTD18, U18). This
 *     unit never reads notes. When it is on, the caller loads the notes and passes them as `extraEvidence`
 *     with the label "note".
 *   - `ExtendedDraftInput.intent` and `ASKS`: a timeline intent (thank_you, follow_up, referral) picks the ask.
 *     Register the new intent's ask in `ASKS`; channel lengths come from the playbook (`lengths`).
 */
import { z } from "zod";
import { callStructured, isMock } from "../llm";
import { unsupportedSentences } from "../grounding";
import { checkMessage, CHANNEL_RULES, hasPlaceholder, type Relationship } from "../checker";
import { DEFAULT_CONNECT, notesLeft as notesLeftFor, type Person } from "../connect";
import { confirmedFacts, saveFacts, type Db } from "../db";
import { factsFor } from "../facts";
import { OUTREACH_SYSTEM, outreachUser } from "../prompts";
import { DraftModelReply, type Channel, type DraftRequest, type FactRef, type Intent } from "../schemas";
import { cleanBriefText } from "./brief";
import { getContact, listContacts, recordAISpend } from "./contacts-db";
import { GOAL_IDS, allowsReferralAsk, goalDetailFact, goalFor, type OutreachGoal } from "./goals";
import { STEPS, isStepKind, playbookFor, stepLengths, type Playbook, type StepKind } from "./playbooks";

// ---- types ----

export type BriefFact = { id: string; text: string };
export type EvidenceItem = { id: string; label: "user_words" | "why_connected" | "note" | "selected_reply" | "selected_contact"; text: string };
export type DraftInput = {
 goal: OutreachGoal; relationship: Relationship; channel: Channel; name: string; role?: string | null; company?: string | null;
 facts: readonly FactRef[]; noteLimit?: 200 | 300;
};
export type ExtendedDraftInput = DraftInput & {
 briefFacts?: readonly BriefFact[];
 /** Personalised notes left this month. Unknown when absent. */
 notesLeft?: number;
 tier?: "tier_1" | "tier_2";
 /** A timeline intent. Defaults to the playbook's. */
 intent?: Intent;
 /** "Write a note anyway" after the advice was a blank invitation. */
 forceNote?: boolean;
 extraEvidence?: readonly EvidenceItem[];
 /** Goal question keys that have a confirmed answer anywhere in the Vault. Derived from `facts` when absent. */
 answeredKeys?: readonly string[];
 /** A timeline step (U18). It fixes the intent, the ask and the length; nothing in the evidence can change them. */
 step?: StepKind;
 /** True when a meeting with this contact is on the timeline, so "thank you for your time" is a true statement. */
 meeting?: boolean;
};
export type EvidencePack = {
 recipient: { name: string; role: string; company: string };
 facts: FactRef[];
 briefFacts: BriefFact[];
 extras: EvidenceItem[];
};
export type Candidate = z.infer<typeof DraftModelReply>["versions"][number];
export type DraftVersion = { angle: string; body: string; factRefs: string[]; briefRefs: string[]; verdict: ReturnType<typeof checkMessage>["verdict"] };
export type Advice = { advice: "note" | "blank_invite" | "message"; draftChannel: Channel; recommendation: string; canWriteNote: boolean };
export type DraftResult = {
 versions: DraftVersion[];
 /** "" when nothing more would clearly help. */
 strongerQuestion: string;
 strongerKey: string;
 strongerOptions: string[];
 recommendation: string;
 advice: Advice["advice"];
 channel: Channel;
 notesLeft?: number;
 canWriteNote: boolean;
 /** The intent the draft was written for: the step's, else the playbook's. */
 intent: Intent;
 step?: StepKind;
};

/** LYNKR_OUTREACH_NOTES_IN_DRAFTS: meeting notes may join the evidence pack only when this is exactly "on" (KTD18). */
export const NOTES_IN_DRAFTS_ENV = "LYNKR_OUTREACH_NOTES_IN_DRAFTS";
export const notesInDraftsOn = (): boolean => process.env[NOTES_IN_DRAFTS_ENV]?.trim() === "on";

/** Thrown when the user's daily model-call cap (KTD13) is used up before any model call was made. */
export class DailyCapError extends Error {
 constructor() { super("Daily outreach draft limit reached."); }
}

// ---- small text helpers ----

/** Strip placeholders, control characters and line breaks from the limited fields the composer splices in. */
const safe = (s: string | null | undefined, max: number) => (s ?? "").replace(/\[\[[\s\S]*?\]\]|[\[\]{}<>]/g, " ").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max).trim();
const stripEnd = (s: string) => s.replace(/[\s.!?,;:]+$/, "");
const sentence = (s: string) => `${stripEnd(s)}.`;
/** "a" or "an" for the word that follows, by sound: "an analyst", "a university", "an MBA". */
export function an(word: string): string {
 const w = word.trim();
 if (/^(honest|hour|heir)/i.test(w)) return "an";
 if (/^(uni|use|usa|user|eu|one|euro|ukr)/i.test(w)) return "a";
 if (/^[A-Z]{2,}\b/.test(w)) return /^[AEFHILMNORSX]/.test(w) ? "an" : "a";
 return /^[aeiou]/i.test(w) ? "an" : "a";
}
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const FIRST_PERSON = /\b(i|i'm|i've|i'd|my|we|our|me)\b/i;

// ---- goal answers: the one question per goal that clearly improves a draft ----

type LeadDetail = { key: string; options: Record<string, string>; free: (answer: string) => string; warmOnly?: boolean };
/**
 * The composer can write one goal answer in plain words. `options` maps the tap answers that carry information to a
 * sentence; any other tap answer ("Other", "Still deciding") says nothing and is left out. `free` words a typed answer.
 */
const LEAD: Record<OutreachGoal, LeadDetail> = {
 job: { key: "role", options: { "Full time": "I'm looking for a full-time role.", Internship: "I'm looking for an internship.", Contract: "I'm looking for contract work." }, free: a => `I'm looking for ${an(a)} ${a} role.` },
 referral: { key: "company", options: {}, free: a => `I'm interested in roles at ${a}.` },
 network: { key: "topic", options: { "Their work": "I'd like to hear about your work.", "Their field": "I'd like to learn more about your field.", "How they got started": "I'd like to hear how you got started." }, free: a => `I'd like to learn about ${a}.` },
 mentor: { key: "topic", options: { "Career direction": "I'm looking for guidance on my career direction.", Skills: "I'm looking for guidance on building my skills.", "Starting out": "I'm looking for guidance on starting out." }, free: a => `I'm looking for guidance on ${a}.` },
 clients: { key: "buyer", options: { Teams: "My work is aimed at teams.", Businesses: "My work is aimed at businesses.", Individuals: "My work is aimed at individuals." }, free: a => `My work is aimed at ${a}.` },
 hiring: { key: "role", options: { "Full time": "I'm hiring for a full-time role.", Contract: "I'm hiring for a contract role.", Internship: "I'm hiring for an internship." }, free: a => `I'm hiring for ${an(a)} ${a} role.` },
 funding: { key: "stage", options: { "Pre-seed": "I'm raising a pre-seed round.", Seed: "I'm raising a seed round." }, free: a => `I'm raising a ${a} round.` },
 buy_business: { key: "kind", options: { Software: "I'm looking at software businesses.", Services: "I'm looking at service businesses." }, free: a => `I'm looking at ${a} businesses.` },
 partner: { key: "kind", options: { Distribution: "I'm looking for a distribution partnership.", Product: "I'm looking for a product partnership.", Community: "I'm looking for a community partnership." }, free: a => `I'm looking for a ${a} partnership.` },
 reconnect: { key: "reason", options: { Work: "I'd like to reconnect about work.", Advice: "I'd like to ask for your advice." }, free: a => `I'd like to reconnect about ${a}.`, warmOnly: true },
};

const isGoal = (g: unknown): g is OutreachGoal => (GOAL_IDS as readonly unknown[]).includes(g);
const leadDef = (goal: OutreachGoal) => goalFor(goal).details.find(d => d.key === LEAD[goal].key)!;
/** The typed or tapped answer to this goal's lead question, from the facts, or "". */
function leadAnswer(goal: OutreachGoal, facts: readonly FactRef[]): string {
 const q = leadDef(goal).question;
 const hit = facts.find(f => f.kind === "goal_detail" && f.text.startsWith(q));
 return hit ? safe(hit.text.slice(q.length), 80).replace(/[.!?]+$/, "") : "";
}
function leadSentence(goal: OutreachGoal, relationship: Relationship, facts: readonly FactRef[]): string {
 const lead = LEAD[goal], answer = leadAnswer(goal, facts);
 if (!answer || (lead.warmOnly && relationship === "stranger")) return "";
 const option = leadDef(goal).options.find(o => o.toLowerCase() === answer.toLowerCase());
 if (option) return lead.options[option] ?? "";
 return lead.free(answer);
}
/** The one question that would improve this draft, unless it is already answered. */
export function strongerFor(goal: OutreachGoal, facts: readonly FactRef[], answeredKeys?: readonly string[]): { question: string; key: string; options: string[] } {
 const def = leadDef(goal);
 const answered = answeredKeys ? answeredKeys.includes(def.key) : facts.some(f => f.kind === "goal_detail" && f.text.startsWith(def.question));
 return answered ? { question: "", key: "", options: [] } : { question: def.question, key: def.key, options: [...def.options] };
}

// ---- composer lines: goal-defined wording that states no fact about anyone ----

const WHY: Record<OutreachGoal, string> = {
 job: "I'm learning how this kind of work is done day to day.",
 referral: "I'm trying to understand what it takes to do this kind of work well.",
 network: "I'm learning about this field and keen to hear from people working in it.",
 mentor: "I'm early in my career and looking for guidance from people further along.",
 clients: "I think my work could be useful to teams like yours.",
 hiring: "I'm building a team and looking for good people.",
 funding: "I'm building a company and raising money for it.",
 buy_business: "I'm looking to buy and run a business.",
 partner: "I'm building something and looking for the right people to work with.",
 reconnect: "I'd like to hear what you are working on now.",
};
const THANKS = "Thanks for connecting.";
/** Two wordings each, so the versions do not collapse into one when a short note leaves room for little else. */
const REPLY_LEADS = ["Replying to your point", "On your point"];
const NOTICED_LEADS = ["I noticed this about your work", "This stood out in your work"];
const SHARED = "I went to the same college as you.";
const PRIVATE = "I would keep anything you share private.";
/** Recipient-facing opener built on role and company only. `who` is "your work as an analyst at Example Co". */
const LEARNERS: readonly OutreachGoal[] = ["job", "network", "mentor"];
function contextLine(goal: OutreachGoal, relationship: Relationship, who: string, company: string): string {
 if (goal === "referral") return `I'd like to understand what ${company ? `${company} looks` : "your team looks"} for in people.`;
 if (goal === "reconnect" && relationship !== "stranger") return company ? `I'd like to hear how things are going at ${company}.` : "I'd like to hear how things are going for you.";
 if (LEARNERS.includes(goal) || goal === "reconnect") return `I'd like to learn more about ${who}.`;
 return `I'm writing because of ${who}.`;
}

/** Every line the composer can write for a goal. The trace guard treats them as approved wording. */
function templateText(goal: OutreachGoal): string[] {
 const lead = LEAD[goal];
 return [WHY[goal], THANKS, SHARED, PRIVATE, ...Object.values(lead.options), lead.free("x"), contextLine(goal, "alumni", "your work", ""), contextLine(goal, "stranger", "your work", "x"), "Everything stays private.", ...REPLY_LEADS.map(l => `${l}.`), ...NOTICED_LEADS.map(l => `${l}.`)];
}

/** Asks by intent. A later unit registers the ask for a new intent here; anything missing uses the playbook's. */
export const ASKS: Partial<Record<Intent, (book: Playbook) => string>> = {
 // A referral needs a specific job and a resume, which a draft does not have. Until then, ask to learn.
 referral: () => "What would you suggest someone focus on when learning about this work?",
};
const askFor = (book: Playbook, intent: Intent | undefined) => (ASKS[intent ?? book.intent]?.(book) ?? book.ask);

// ---- timeline steps (U18) ----

type StepWording = { variants: { angle: string; lines: (company: string) => string[] }[]; ask: (book: Playbook) => string };
/** Every line the step composer can write. The trace guard treats them as approved wording; none states a fact about the meeting. */
const STEP_WORDING: Record<StepKind, StepWording> = {
 thank_you: {
  variants: [
   { angle: "gratitude", lines: () => ["Thank you for making time to speak with me.", "I really appreciated it."] },
   { angle: "keep_in_touch", lines: () => ["Thank you for speaking with me.", "It meant a lot that you gave me your time."] },
  ],
  ask: () => "Would it be alright if I let you know how things go?",
 },
 follow_up: {
  variants: [
   { angle: "gentle", lines: () => ["I'm following up on my earlier message in case it got buried."] },
   { angle: "brief", lines: () => ["I wanted to follow up on my earlier note, and I understand if you are busy."] },
  ],
  // A first-message referral ask is not repeated: a referral playbook falls back to the learning ask.
  ask: book => (book.intent === "referral" ? ASKS.referral!(book) : book.ask),
 },
 reschedule: {
  variants: [
   { angle: "short", lines: () => ["Sorry we couldn't connect at the time we planned."] },
   { angle: "warm", lines: () => ["I'm sorry our call didn't happen as planned."] },
  ],
  ask: () => "Would you be open to finding another time that works for you?",
 },
 check_in: {
  variants: [
   { angle: "light", lines: () => ["I wanted to check in and see how things are going."] },
   { angle: "company", lines: company => [company ? `I wanted to check in and hear how things are going at ${company}.` : "I wanted to say hello again and hear how you are doing."] },
  ],
  ask: () => "Would you be open to a quick catch-up when you have time?",
 },
 referral_ask: {
  variants: [
   { angle: "direct_ask", lines: () => ["Thank you again for speaking with me."] },
   { angle: "after_thanks", lines: () => ["I'd value your help with one thing."] },
  ],
  ask: () => "If a role on your team fits my work, would you be comfortable referring me? I can send my resume and the job link.",
 },
};
const stepAsk = (step: StepKind, book: Playbook) => STEP_WORDING[step].ask(book);
const stepText = (step: StepKind): string[] => STEP_WORDING[step].variants.flatMap(v => [...v.lines(""), ...v.lines("x")]);
/** The ask for a draft: the step's if there is one, else the intent's, else the playbook's. */
const askOf = (input: Pick<ExtendedDraftInput, "step" | "intent">, book: Playbook) => (input.step ? stepAsk(input.step, book) : askFor(book, input.intent));
/** The intent a draft is written for. It comes from the step or the playbook, never from the evidence. */
export const intentOf = (input: Pick<ExtendedDraftInput, "step" | "intent">, book: Playbook): Intent => (input.step ? STEPS[input.step].intent : input.intent ?? book.intent);
/** A step goes to someone the person has already been in touch with, so the checker reads it as a warm message about a real meeting. */
const checkRelOf = (input: Pick<ExtendedDraftInput, "step" | "relationship">): Relationship => (input.step ? "knows_me" : input.relationship);
const checkCtx = (input: ExtendedDraftInput, facts: string[]) => ({ channel: input.channel, noteMax: input.noteLimit === 300 ? (300 as const) : undefined, intent: "work_question" as const, facts, sharedHistory: input.step && input.meeting ? true : undefined });

// ---- limits ----

/** The most characters (connection note) or words (other channels) a draft may be. */
export function limitFor(input: Pick<DraftInput, "channel" | "noteLimit"> & { step?: StepKind }, book: Playbook): { limit: number; unit: "chars" | "words" } {
 const rule = CHANNEL_RULES[input.channel];
 const lengths = input.step ? stepLengths(book, input.step) : book.lengths;
 if (input.channel === "connection_note") {
  const setting = input.noteLimit ?? 200, goalLimit = lengths.connection_note;
  return { limit: goalLimit < CHANNEL_RULES.connection_note.max ? Math.min(setting, goalLimit) : setting, unit: "chars" };
 }
 return { limit: Math.min(rule.max, lengths[input.channel]), unit: rule.unit };
}
const sizeOf = (body: string, unit: "chars" | "words") => (unit === "chars" ? body.length : body.trim().split(/\s+/).length);

// ---- evidence pack ----

/** The only things a draft may state: at most 2 Vault facts, 3 confirmed brief facts, and the recipient's own details. */
export function buildEvidencePack(input: ExtendedDraftInput): EvidencePack {
 return {
  recipient: { name: safe(input.name, 60), role: safe(input.role, 80), company: safe(input.company, 80) },
  facts: input.facts.slice(0, 2).map(({ id, kind, text }) => ({ id, kind, text })),
  briefFacts: (input.briefFacts ?? []).slice(0, 3).map(({ id, text }) => ({ id, text })),
  extras: (input.extraEvidence ?? []).map(({ id, label, text }) => ({ id, label, text })),
 };
}
/** Text the person selected on LinkedIn: the recipient's public words, never the person's own claims. */
const isSelected = (e: EvidenceItem) => e.label === "selected_reply" || e.label === "selected_contact";
const sourcesOf = (pack: EvidencePack) => [pack.recipient.name, pack.recipient.role, pack.recipient.company, ...pack.facts.map(f => f.text), ...pack.briefFacts.map(f => f.text), ...pack.extras.map(e => e.text)];

// ---- the trace guard (KTD5) ----

const tokenSet = (s: string) => new Set(s.toLowerCase().match(/[\p{L}\p{N}]+(?:[.,][\p{N}]+)?/gu) ?? []);
const MONTH = /\b(?:January|February|March|April|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b|\b(?:in|last|next|this|since|until|by|from|on|of)\s+May\b|\bMay\s+\d/g;
const WEEKDAY = /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g;
const SKIP_CAPS = /^(Hi|Hello|I|No|Would|Could|Can|What|Thank|Thanks|If|The|My|Your|It|This|A|An|We|Our|Is|Are|Do|Did|How|Why|When|Where|Which|Who|You|Yes)$/u;
const STOP = new Set(("about after again also because been before being both could does doing done during each every from have having here into just make made more most much need only other over same should some such than that their them then there these they this those through very want were what when where which while with would your yours youre mine work working role roles team teams people someone anyone thing things time first next last week year years used using took take learned learn noticed something really still well like good great better lot lots part parts kind kinds show shows know think would like hear learn more").split(" "));
const content = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter(w => !STOP.has(w));
const stem = (w: string) => w.replace(/(ings|ing|ed|es|s)$/, "");
const split = (text: string) => text.split(/(?<=[.?!])\s+|\n+/).map(s => s.trim()).filter(Boolean);
/** "I built ...", "we ran ...": something the person says they did. */
const DID = /\b(?:i|we)(?:'ve| have)?\s+(?:also\s+|just\s+|recently\s+|once\s+)?(?:built|made|led|ran|shipped|wrote|designed|launched|grew|managed|founded|won|created|developed|reduced|increased|improved|delivered|helped|worked|interned|cleaned|analy[sz]ed|taught|studied|completed|achieved|earned|scored|presented|organi[sz]ed|started|sold|raised|saved|cut|trained|mentored|published|automated|tested|researched|translated|coded|joined)\b/i;
/** A claim about the recipient's own doings, which only a confirmed brief fact may support. */
const HOOK = /\b(?:i (?:saw|read|noticed|watched|loved|enjoyed|liked|heard|admire|followed|came across)|congrat\w*|your (?:recent|latest|new|post|article|talk|launch|podcast|newsletter|blog|paper|book|project|promotion|keynote|interview|thread|video)|you (?:recently|just|posted|wrote|shared|launched|joined|moved|started|published|spoke|announced))/i;

/** A statement about what happened in a meeting: "you suggested ...", "we discussed ...", "thanks for your advice on ...". */
const MEETING_CLAIM = /\b(?:you (?:mentioned|said|told me|suggested|recommended|shared|explained|walked me through|talked about|pointed out|advised)|we (?:discussed|talked about|spoke about|covered|agreed)|(?:our|the) (?:discussion|conversation|chat|call) (?:about|on)|your (?:advice|suggestion|tip|recommendation|feedback|insight)s? (?:on|about)|what you (?:said|shared|explained|told me)|(?:advice|tips?|suggestions?) (?:you gave|on|about))\b/i;
/** The steps that never ask for anything about work. */
const NO_JOB_ASK: readonly StepKind[] = ["thank_you", "reschedule", "check_in"];
const JOB_ASK = /\b(?:(?:any|a|an|open|available|the) (?:jobs?|roles?|openings?|vacanc(?:y|ies)|positions?)|refer(?:ral|ring)?\b|refer me|hire me|ask(?:ing)? for)\b/i;

const ratio = (s: string, known: Set<string>) => {
 const ws = content(s);
 return ws.length ? ws.filter(w => known.has(stem(w))).length / ws.length : 1;
};
const TINY = new Set("the and for with our not but are was were had has its into from you your who how why may can will did does too out any all new one two per yet nor".split(" "));
/** Every meaningful word of a "what I did" sentence, short ones included, so "I led a team" cannot pass on a name alone. */
const claimRatio = (s: string, known: Set<string>) => {
 const ws = (s.replace(/^(?:hi|hello|dear)\s+[\p{L}'-]+,?\s*/iu, "").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter(w => !TINY.has(w) && !["have", "also", "just", "once", "recently"].includes(w));
 return ws.length ? ws.filter(w => known.has(stem(w))).length / ws.length : 1;
};

/** Why a version cannot be shown, or null. A failed check rejects the whole version, never just its references. */
export function draftProblem(input: ExtendedDraftInput, candidate: Pick<Candidate, "body" | "factRefs" | "briefRefs">): string | null {
 const body = candidate.body.trim();
 if (!body || hasPlaceholder(body)) return "placeholder";
 const book = playbookFor(input.goal, input.relationship);
 const { limit, unit } = limitFor(input, book);
 if (sizeOf(body, unit) > limit) return "length";
 const pack = buildEvidencePack(input);
 if (candidate.factRefs.some(id => !pack.facts.some(f => f.id === id)) || candidate.briefRefs.some(id => !pack.briefFacts.some(f => f.id === id))) return "reference";
 const approved = [...templateText(input.goal), book.ask, askOf(input, book), ...(input.step ? stepText(input.step) : [])];
 const sources = [...sourcesOf(pack), ...approved];
 const evidence = tokenSet(sources.join(" "));
 for (const number of body.match(/\b\d+(?:[.,]\d+)*\b/g) ?? []) if (!evidence.has(number.toLowerCase())) return "number";
 for (const m of [...body.matchAll(MONTH), ...body.matchAll(WEEKDAY)]) if (!evidence.has(m[0].replace(/^(?:in|last|next|this|since|until|by|from|on|of)\s+/i, "").split(/\s+/)[0].toLowerCase())) return "date";
 // Capitalised names, organisations and acronyms must be in the evidence. Greetings and common sentence openers are ignored.
 for (const m of body.matchAll(/\b[A-Z][\p{L}\p{N}'-]*\b/gu)) {
  const word = m[0], before = body.slice(0, m.index);
  if (SKIP_CAPS.test(word.split("'")[0])) continue;
  if (/(?:^|[.!?]\s*)$/.test(before) && /^[A-Z][a-z]+$/.test(word)) continue;
  if (!evidence.has(word.toLowerCase())) return "name";
 }
 for (const quote of body.matchAll(/[“"]([^”"]+)[”"]/g)) if (!sources.join(" ").toLowerCase().includes(quote[1].toLowerCase())) return "quote";
 const known = new Set(content(sources.join(" ")).map(stem));
 // What the person says they did can rest on their own facts and approved wording, never on the recipient's selected words.
 const ownSources = sources.filter(x => !pack.extras.some(e => isSelected(e) && e.text === x));
 const knownAll = new Set((ownSources.join(" ").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).map(stem));
 const recipient = new Set(content([pack.recipient.name, pack.recipient.role, pack.recipient.company, ...pack.briefFacts.map(f => f.text), ...pack.extras.map(e => e.text)].join(" ")).map(stem));
 // What was said or agreed in a meeting is known only from the person's own note (KTD18). Anything else is invented.
 const noteWords = new Set(content(pack.extras.filter(e => e.label === "note").map(e => e.text).join(" ")).map(stem));
 for (const s of split(body)) {
  if (MEETING_CLAIM.test(s) && (!noteWords.size || ratio(s.replace(MEETING_CLAIM, " "), noteWords) < 0.5)) return "meeting_detail";
  if (DID.test(s) && claimRatio(s, knownAll) < 0.5) return "grounding";
  if (HOOK.test(s) && ratio(s, recipient) < 0.5) return "recipient_claim";
 }
 if (unsupportedSentences(body, sources).length) return "grounding";
 // A thank-you, a reschedule or a check-in never asks for a job, an opening or a referral, whatever the evidence says.
 if (input.step && NO_JOB_ASK.includes(input.step) && JOB_ASK.test(body)) return "off_intent";
 const check = checkMessage(body, checkRelOf(input), checkCtx(input, pack.facts.map(f => f.text)));
 if (check.verdict === "Do not send yet") return "checker";
 // A referral ask is for someone who already knows the person's work, and only on the referral playbook or the referral step.
 if (check.isReferralAsk && book.intent !== "referral" && input.step !== "referral_ask") return "referral";
 return null;
}

// ---- advice: note or blank invitation (R18) ----

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** From the tier and the notes left, a note or a blank invitation followed by a message after they accept. */
export function adviceFor(input: Pick<ExtendedDraftInput, "channel" | "tier" | "notesLeft" | "forceNote">): Advice {
 if (input.channel !== "connection_note") {
  return { advice: "message", draftChannel: input.channel, recommendation: "Review the message before sending it yourself.", canWriteNote: false };
 }
 const left = input.notesLeft;
 const noteOk = input.tier !== "tier_2" && (left === undefined || left > 0);
 if (noteOk) {
  return { advice: "note", draftChannel: "connection_note", canWriteNote: true,
   recommendation: left === undefined ? "Check your remaining personalised note allowance before sending." : `Send this as your invitation note. You have ${plural(left, "note", "notes")} left this month.` };
 }
 const why = left === 0 ? "You have used all your notes this month." : "This person is Tier 2, so keep your notes for Tier 1 people.";
 if (input.forceNote) {
  return { advice: "blank_invite", draftChannel: "connection_note", canWriteNote: true,
   recommendation: left === 0 ? "You have 0 notes left this month, so this note goes beyond your allowance. A blank invitation, then a message after they accept, is the safer choice." : `${why} A blank invitation, then a message after they accept, is the safer choice.` };
 }
 return { advice: "blank_invite", draftChannel: "linkedin_message", canWriteNote: true,
  recommendation: `${why} Send a blank invitation, then message after they accept. This is that message; you can still write a note anyway.` };
}

// ---- the composer ----

/** The selected words as one quoted line for the composer: a short first sentence, quoted exactly as selected. */
function selectedLine(item: EvidenceItem | undefined, variant: number): Piece | null {
 if (!item) return null;
 const first = split(item.text)[0] ?? "";
 const cut = first.length <= 100 ? first : first.slice(0, 100).replace(/\s+\S*$/, "");
 const quote = stripEnd(cut.replace(/["“”]/g, "'")).trim();
 if (quote.length < 3) return null;
 return item.label === "selected_reply" ? { text: `${REPLY_LEADS[variant % 2]}: "${quote}".`, keep: 7 } : { text: `${NOTICED_LEADS[variant % 2]}: "${quote}".`, keep: 5 };
}

type Piece = { text: string; keep: number };
type Ctx = {
 goal: OutreachGoal; relationship: Relationship; first: string; who: string; company: string; facts: Piece[]; lead: string;
 briefLine: string; afterAccept: boolean; ask: string; unit: "chars" | "words"; limit: number;
};

function build(c: Ctx, parts: Piece[]): string {
 const greeting = c.first ? `Hi ${c.first},` : "Hello,";
 const list = parts.filter(p => p.text);
 const text = () => [greeting, ...list.map(p => p.text), c.ask].join(" ");
 while (sizeOf(text(), c.unit) > c.limit && list.length) list.splice(list.indexOf(list.reduce((low, p) => (p.keep < low.keep ? p : low))), 1);
 return sizeOf(text(), c.unit) > c.limit ? c.ask : text();
}

/** The first-person facts a message can open with: proof kinds first, no stand-alone fragments. */
function factPieces(book: Playbook, facts: readonly FactRef[]): Piece[] {
 const usable = facts.filter(f => f.kind !== "goal_detail" && book.proof.includes(f.kind) && !hasPlaceholder(f.text));
 const out: Piece[] = [];
 for (const f of usable) {
  const text = safe(f.text, 400);
  const first = split(text)[0] ?? "";
  const line = text.length <= 170 ? text : first.length <= 170 ? first : "";
  if (!line || (!out.length && !FIRST_PERSON.test(line))) continue;
  out.push({ text: sentence(line), keep: out.length ? 1 : 5 });
  if (out.length === 2) break;
 }
 return out;
}

const REALIZERS: Record<string, (c: Ctx) => Piece[] | null> = {
 context: c => [{ text: contextLine(c.goal, c.relationship, c.who, c.company), keep: 6 }, { text: c.briefLine, keep: 5 }, ...c.facts, { text: c.lead, keep: 4 }],
 direct: c => [{ text: WHY[c.goal], keep: 3 }, ...c.facts, { text: c.lead, keep: 4 }],
 insight: c => (c.facts.length ? [...c.facts, { text: contextLine(c.goal, c.relationship, c.who, c.company), keep: 3 }, { text: c.lead, keep: 4 }] : null),
 shared: c => (c.relationship === "alumni" ? [{ text: SHARED, keep: 6 }, ...c.facts, { text: c.lead, keep: 4 }] : null),
 confidential: c => [{ text: WHY[c.goal], keep: 6 }, { text: PRIVATE, keep: 5 }, { text: c.lead, keep: 4 }],
};
const REALIZER_FOR: Record<string, string> = { traction: "insight", idea: "insight", teardown: "insight", update: "insight", invite: "insight", role: "direct" };

/** Offline composer: complete sentences from the playbook and the evidence. It does not infer a relationship or invent a recipient hook. */
export function composeDrafts(input: ExtendedDraftInput): DraftResult {
 if (input.step) return composeStep(input, input.step);
 const advice = adviceFor(input);
 const eff = { ...input, channel: advice.draftChannel };
 const book = playbookFor(eff.goal, eff.relationship);
 const pack = buildEvidencePack(eff);
 const { limit, unit } = limitFor(eff, book);
 const { name, role, company } = pack.recipient;
 const who = role && company ? `your work as ${an(role)} ${role} at ${company}` : role ? `your work as ${an(role)} ${role}` : company ? `your work at ${company}` : "your work";
 const brief = pack.briefFacts.find(f => f.text.length <= 140 && !/["“”]/.test(f.text) && !hasPlaceholder(f.text));
 const facts = factPieces(book, pack.facts);
 const ctx: Ctx = {
  goal: eff.goal, relationship: eff.relationship, first: name.split(" ")[0] ?? "", who, company, facts,
  lead: leadSentence(eff.goal, eff.relationship, pack.facts),
  briefLine: brief ? `I noticed this about your work: "${brief.text.trim()}"${/[.!?]$/.test(brief.text.trim()) ? "" : "."}` : "",
  afterAccept: advice.draftChannel !== input.channel, ask: askFor(book, eff.intent), unit, limit,
 };
 const selectedItem = pack.extras.find(isSelected);
 const versions: DraftVersion[] = [];
 for (const id of [...book.angles.map(a => a.id), "context", "direct"]) {
  if (versions.length === 2) break;
  const realize = REALIZERS[id] ?? REALIZERS[REALIZER_FOR[id] ?? "direct"];
  const parts = realize?.(ctx);
  if (!parts) continue;
  const angle = REALIZERS[id] || REALIZER_FOR[id] ? id : "direct";
  if (versions.some(v => v.angle === angle)) continue;
  const lead = ctx.afterAccept ? [{ text: THANKS, keep: 2 }] : [];
  const selected = selectedLine(selectedItem, versions.length);
  const body = build(ctx, [...lead, ...(selected ? [selected] : []), ...parts]);
  if (versions.some(v => v.body === body)) continue;
  const detail = ctx.lead && body.includes(ctx.lead) ? pack.facts.filter(f => f.kind === "goal_detail" && f.text.startsWith(leadDef(eff.goal).question)).map(f => f.id) : [];
  versions.push(toVersion(eff, { angle, body, factRefs: detail, briefRefs: [] }, pack));
 }
 const stronger = strongerFor(eff.goal, input.facts, input.answeredKeys);
 return { versions, strongerQuestion: stronger.question, strongerKey: stronger.key, strongerOptions: stronger.options, recommendation: advice.recommendation, advice: advice.advice, channel: advice.draftChannel, notesLeft: input.notesLeft, canWriteNote: advice.canWriteNote, intent: intentOf(input, book) };
}

/** A timeline step is written to someone already in touch, so there is no note-or-blank advice and no goal question. */
function stepAdvice(channel: Channel): Advice {
 return { advice: "message", draftChannel: channel, recommendation: "Review the message before sending it yourself.", canWriteNote: false };
}
const adviceOf = (input: ExtendedDraftInput): Advice => (input.step ? stepAdvice(input.channel) : adviceFor(input));

/** Offline composer for a step: complete wording from the step's own lines and the recipient's name and company, nothing about the meeting. */
function composeStep(input: ExtendedDraftInput, step: StepKind): DraftResult {
 const book = playbookFor(input.goal, input.relationship);
 const pack = buildEvidencePack(input);
 const { limit, unit } = limitFor(input, book);
 const first = pack.recipient.name.split(" ")[0] ?? "";
 const greeting = first ? `Hi ${first},` : "Hello,";
 const ask = stepAsk(step, book);
 const versions: DraftVersion[] = [];
 for (const variant of STEP_WORDING[step].variants) {
  const lines = variant.lines(pack.recipient.company);
  const text = () => [greeting, ...lines, ask].join(" ");
  while (sizeOf(text(), unit) > limit && lines.length) lines.pop();
  const body = sizeOf(text(), unit) > limit ? ask : text();
  if (versions.some(v => v.body === body)) continue;
  versions.push(toVersion(input, { angle: variant.angle, body, factRefs: [], briefRefs: [] }, pack));
 }
 return { versions, strongerQuestion: "", strongerKey: "", strongerOptions: [], recommendation: stepAdvice(input.channel).recommendation, advice: "message", channel: input.channel, canWriteNote: false, intent: STEPS[step].intent, step };
}

/** A candidate as a shown version: references added for any evidence it quotes, and the checker's verdict. */
function toVersion(input: ExtendedDraftInput, c: Candidate, pack: EvidencePack): DraftVersion {
 const body = c.body.trim(), flat = norm(body);
 const quotes = (text: string) => { const n = norm(text); return n.length >= 12 && flat.includes(n.slice(0, Math.min(n.length, 40))); };
 const factRefs = [...new Set([...c.factRefs, ...pack.facts.filter(f => quotes(f.text)).map(f => f.id)])];
 const briefRefs = [...new Set([...c.briefRefs, ...pack.briefFacts.filter(f => quotes(f.text)).map(f => f.id)])];
 const verdict = checkMessage(body, checkRelOf(input), checkCtx(input, pack.facts.map(f => f.text))).verdict;
 return { angle: c.angle, body, factRefs, briefRefs, verdict };
}

// ---- the model path ----

export type ModelFn = (attempt: number, pack: EvidencePack, ctx: { input: ExtendedDraftInput; book: Playbook; problems: string[]; afterAccept: boolean }) => Promise<Candidate[]>;
export type GenerateOptions = {
 mock?: boolean;
 model?: ModelFn;
 /** Takes one daily model call. Returns false when the cap is used up. */
 spend?: () => Promise<boolean>;
};

const defaultModel: ModelFn = async (_attempt, pack, { input, book, problems, afterAccept }) => {
 const { limit, unit } = limitFor(input, book);
 const step = input.step ? { kind: input.step, intent: STEPS[input.step].intent, ask: stepAsk(input.step, book), guidance: STEPS[input.step].guidance } : undefined;
 return (await callStructured({ system: OUTREACH_SYSTEM, user: outreachUser(pack, book, { channel: input.channel, limit, unit, problems, afterAccept, step }), schema: DraftModelReply, effort: "low", maxTokens: 2000 })).versions;
};

/** Keeps a model's angle when the playbook has it; otherwise the first playbook angle not used yet. */
function angleOf(c: Candidate, book: Playbook, used: Set<string>): string | null {
 const ids = book.angles.map(a => a.id);
 const named = ids.find(id => id === c.angle.trim().toLowerCase() || book.angles.find(a => a.id === id)?.label.toLowerCase() === c.angle.trim().toLowerCase());
 const pick = named ?? ids.find(id => !used.has(id)) ?? "direct";
 return used.has(pick) ? null : pick;
}

/**
 * Model versions that pass the guard are kept. If fewer than two pass, the model is asked once more; whatever is
 * still missing is filled in by the composer, so the result always holds at least two complete versions.
 * Throws DailyCapError only when the cap is used up before the first model call.
 */
export async function generateOutreach(input: ExtendedDraftInput, opts: GenerateOptions = {}): Promise<DraftResult> {
 const fallback = composeDrafts(input);
 if (opts.mock ?? isMock()) return fallback;
 const advice = adviceOf(input);
 const eff: ExtendedDraftInput = { ...input, channel: advice.draftChannel };
 const book = playbookFor(eff.goal, eff.relationship);
 const pack = buildEvidencePack(eff);
 const call = opts.model ?? defaultModel;
 const kept: DraftVersion[] = [], problems: string[] = [];
 for (let attempt = 0; attempt < 2 && kept.length < 2; attempt++) {
  if (opts.spend && !(await opts.spend())) {
   if (attempt === 0) throw new DailyCapError();
   break;
  }
  let candidates: Candidate[];
  try { candidates = await call(attempt, pack, { input: eff, book, problems: [...new Set(problems)], afterAccept: advice.draftChannel !== input.channel }); } catch { break; }
  for (const c of candidates.slice(0, 3)) {
   const problem = draftProblem(eff, c);
   if (problem) { problems.push(problem); continue; }
   const used = new Set(kept.map(v => v.angle));
   const angle = angleOf(c, book, used);
   if (!angle || kept.some(v => v.body === c.body.trim())) continue;
   kept.push(toVersion(eff, { ...c, angle }, pack));
  }
 }
 if (!kept.length) return fallback;
 const fill = fallback.versions.filter(v => !kept.some(k => k.angle === v.angle || k.body === v.body));
 return { ...fallback, versions: [...kept, ...fill].slice(0, Math.max(2, Math.min(3, kept.length))) };
}

// ---- the route's handler ----

export type DraftDeps = GenerateOptions & { now?: Date };
export type DraftOutcome = { status: number; body: Record<string, unknown> };
const reply = (status: number, body: Record<string, unknown>): DraftOutcome => ({ status, body });
const BriefFacts = z.array(z.object({ text: z.string().max(240) }).passthrough()).max(3);

// ---- evidence from the timeline (U18, KTD18) ----

/** Text addressed to an AI, on top of the brief cleaner's: "ignore instructions", or a planted request for a job or referral. */
const PLANTED = /\b(?:ignore|disregard|forget|override)\b[^.!?\n]*\b(?:instructions?|prompts?|rules?)\b|\b(?:ask|asking|request|tell)\b[^.!?\n]*\bfor (?:an? |any |the )?(?:jobs?|referrals?|openings?|roles?)\b/i;
/** Free text from a note or a "why you connected" line, cleaned the way the brief is, minus planted instructions. Returns "" when nothing is left. */
export function cleanEvidenceText(text: string | null | undefined, max = 280): string {
 const lines = cleanBriefText(text ?? "").split("\n").flatMap(l => l.split(/(?<=[.!?])\s+/)).filter(l => l.trim() && !PLANTED.test(l));
 return safe(lines.join(" "), max);
}

/**
 * Text the person selected on LinkedIn, as one labelled evidence item for this request only. It is cleaned like a note:
 * instructions, planted requests, contact details and sensitive lines are removed. Returns [] when nothing is left.
 * It is never saved, logged, searched or counted.
 */
export function selectionEvidence(selection: string | null | undefined, use: "contact" | "reply" | undefined): EvidenceItem[] {
 const text = cleanEvidenceText(selection, 1500);
 return text ? [{ id: "S1", label: use === "reply" ? "selected_reply" : "selected_contact", text }] : [];
}

const NOTES_WINDOW_MONTHS = 6;
const MAX_NOTES = 3;

/**
 * Evidence this contact's own timeline adds to a draft. "Why you connected" always joins. Meeting notes from the last
 * 6 months join only when LYNKR_OUTREACH_NOTES_IN_DRAFTS is exactly "on"; the notes column is not read otherwise.
 * This is the only code that reads outreach_events notes, and only for the one contact.
 */
async function timelineEvidence(db: Db, userId: string, contact: { id: string; whyText: string | null }, now: Date): Promise<{ extras: EvidenceItem[]; meeting: boolean }> {
 const extras: EvidenceItem[] = [];
 const why = cleanEvidenceText(contact.whyText, 200);
 if (why) extras.push({ id: "W1", label: "why_connected", text: why });
 const met = await db.query("select 1 from outreach_events where user_id = $1 and contact_id = $2 and kind in ('meeting_booked','meeting_done') and status <> 'superseded' limit 1", [userId, contact.id]);
 if (notesInDraftsOn()) {
  const since = new Date(now);
  since.setMonth(since.getMonth() - NOTES_WINDOW_MONTHS);
  const rows = await db.query(
   "select note from outreach_events where user_id = $1 and contact_id = $2 and note is not null and status <> 'superseded' and coalesce(done_at, due_at, created_at) >= $3 order by coalesce(done_at, due_at, created_at) desc, id limit $4",
   [userId, contact.id, since, MAX_NOTES * 2],
  );
  for (const r of rows.rows) {
   const text = cleanEvidenceText(r.note as string);
   if (text && extras.filter(e => e.label === "note").length < MAX_NOTES) extras.push({ id: `N${extras.filter(e => e.label === "note").length + 1}`, label: "note", text });
  }
 }
 return { extras, meeting: met.rows.length > 0 };
}

/**
 * One draft request for one contact, scoped to the user. An answer to the goal question is saved as a confirmed
 * goal_detail fact first, so the draft that follows is rewritten with it and the next contact does not ask again.
 */
export async function runDraft(db: Db, userId: string, req: DraftRequest, deps: DraftDeps = {}): Promise<DraftOutcome> {
 const contact = await getContact(db, userId, req.contactId);
 if (!contact) return reply(404, { error: "Contact not found." });
 const goal: OutreachGoal = isGoal(contact.goal) ? contact.goal : "job";
 const relationship: Relationship = contact.relationship ?? "stranger";

 if (req.answer) {
  if (!goalFor(goal).details.some(d => d.key === req.answer!.key)) return reply(400, { error: "That question is not part of this goal." });
  try { await saveFacts(db, userId, [goalDetailFact(goal, req.answer.key, req.answer.text)]); } catch (e) { return reply(400, { error: e instanceof Error ? e.message : "Add an answer." }); }
 }

 let step: StepKind | undefined;
 if (req.eventId) {
  const ev = await db.query("select kind from outreach_events where user_id = $1 and contact_id = $2 and id = $3 and status <> 'superseded'", [userId, contact.id, req.eventId]);
  if (!ev.rows[0]) return reply(404, { error: "Step not found." });
  if (!isStepKind(ev.rows[0].kind)) return reply(400, { error: "There is no message to write for that step." });
  step = ev.rows[0].kind;
  if (req.channel === "connection_note") return reply(400, { error: "A connection note can't carry this step. Pick a message or an email." });
  if (step === "referral_ask" && !allowsReferralAsk(goal)) return reply(400, { error: "A referral ask is only for the job and referral goals." });
 }

 const book = playbookFor(goal, relationship);
 const vault = await confirmedFacts(db, userId);
 const facts = factsFor("outreach", vault, { goal, proof: book.proof, detail: LEAD[goal].key });
 const rawBrief = BriefFacts.safeParse((contact.brief as { facts?: unknown } | null)?.facts);
 // The brief is stored on the contact, so it is cleaned again here: instructions and sensitive lines never reach a draft.
 const briefFacts = (rawBrief.success ? rawBrief.data : []).map(f => cleanBriefText(f.text).trim()).filter(Boolean).slice(0, 3).map((text, i) => ({ id: `B${i + 1}`, text }));
 const answeredKeys = goalFor(goal).details.filter(d => vault.some(f => f.kind === "goal_detail" && f.text.startsWith(d.question))).map(d => d.key);

 let notesLeft: number | undefined;
 if (req.channel === "connection_note") {
  const people = (await listContacts(db, userId)).filter(c => c.noteUsed).map(c => ({ id: c.id, label: c.name, relationship: c.relationship ?? "stranger", withNote: true, status: "invited", addedAt: c.createdAt.toISOString(), invitedAt: (c.invitedAt ?? c.updatedAt).toISOString() }) as Person);
  notesLeft = notesLeftFor({ ...DEFAULT_CONNECT, monthlyNotes: req.monthlyNotes ?? DEFAULT_CONNECT.monthlyNotes, people }, deps.now);
 }

 const timeline = await timelineEvidence(db, userId, contact, deps.now ?? new Date());
 const mock = deps.mock ?? isMock();
 try {
  const result = await generateOutreach(
   { goal, relationship, channel: req.channel, name: contact.name, role: contact.role, company: contact.company, facts, briefFacts, noteLimit: req.noteLimit, tier: contact.tier, notesLeft, forceNote: req.forceNote, answeredKeys, step, meeting: timeline.meeting, extraEvidence: [...timeline.extras, ...selectionEvidence(req.selection, req.selectionUse)] },
   { mock, model: deps.model, spend: deps.spend ?? (() => recordAISpend(db, userId)) },
  );
  return reply(200, result);
 } catch (e) {
  if (e instanceof DailyCapError) return reply(429, { error: "You have used today's AI-written drafts. The limit resets tomorrow; demo drafts still work." });
  throw e;
 }
}
