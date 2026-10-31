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
import { GOAL_IDS, goalDetailFact, goalFor, type OutreachGoal } from "./goals";
import { playbookFor, type Playbook } from "./playbooks";

// ---- types ----

export type BriefFact = { id: string; text: string };
export type EvidenceItem = { id: string; label: "user_words" | "why_connected" | "note"; text: string };
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
 return [WHY[goal], THANKS, SHARED, PRIVATE, ...Object.values(lead.options), lead.free("x"), contextLine(goal, "alumni", "your work", ""), contextLine(goal, "stranger", "your work", "x"), "Everything stays private."];
}

/** Asks by intent. A later unit registers the ask for a new intent here; anything missing uses the playbook's. */
export const ASKS: Partial<Record<Intent, (book: Playbook) => string>> = {
 // A referral needs a specific job and a resume, which a draft does not have. Until then, ask to learn.
 referral: () => "What would you suggest someone focus on when learning about this work?",
};
const askFor = (book: Playbook, intent: Intent | undefined) => (ASKS[intent ?? book.intent]?.(book) ?? book.ask);

// ---- limits ----

/** The most characters (connection note) or words (other channels) a draft may be. */
export function limitFor(input: Pick<DraftInput, "channel" | "noteLimit">, book: Playbook): { limit: number; unit: "chars" | "words" } {
 const rule = CHANNEL_RULES[input.channel];
 if (input.channel === "connection_note") {
  const setting = input.noteLimit ?? 200, goalLimit = book.lengths.connection_note;
  return { limit: goalLimit < CHANNEL_RULES.connection_note.max ? Math.min(setting, goalLimit) : setting, unit: "chars" };
 }
 return { limit: Math.min(rule.max, book.lengths[input.channel]), unit: rule.unit };
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
 const approved = [...templateText(input.goal), book.ask, askFor(book, input.intent)];
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
 const knownAll = new Set((sources.join(" ").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).map(stem));
 const recipient = new Set(content([pack.recipient.name, pack.recipient.role, pack.recipient.company, ...pack.briefFacts.map(f => f.text), ...pack.extras.map(e => e.text)].join(" ")).map(stem));
 for (const s of split(body)) {
  if (DID.test(s) && claimRatio(s, knownAll) < 0.5) return "grounding";
  if (HOOK.test(s) && ratio(s, recipient) < 0.5) return "recipient_claim";
 }
 if (unsupportedSentences(body, sources).length) return "grounding";
 const check = checkMessage(body, input.relationship, { channel: input.channel, noteMax: input.noteLimit === 300 ? 300 : undefined, intent: "work_question", facts: pack.facts.map(f => f.text) });
 if (check.verdict === "Do not send yet") return "checker";
 // A referral ask is for someone who already knows the person's work, and only on the referral playbook.
 if (check.isReferralAsk && book.intent !== "referral") return "referral";
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
 const versions: DraftVersion[] = [];
 for (const id of [...book.angles.map(a => a.id), "context", "direct"]) {
  if (versions.length === 2) break;
  const realize = REALIZERS[id] ?? REALIZERS[REALIZER_FOR[id] ?? "direct"];
  const parts = realize?.(ctx);
  if (!parts) continue;
  const angle = REALIZERS[id] || REALIZER_FOR[id] ? id : "direct";
  if (versions.some(v => v.angle === angle)) continue;
  const lead = ctx.afterAccept ? [{ text: THANKS, keep: 2 }] : [];
  const body = build(ctx, [...lead, ...parts]);
  if (versions.some(v => v.body === body)) continue;
  const detail = ctx.lead && body.includes(ctx.lead) ? pack.facts.filter(f => f.kind === "goal_detail" && f.text.startsWith(leadDef(eff.goal).question)).map(f => f.id) : [];
  versions.push(toVersion(eff, { angle, body, factRefs: detail, briefRefs: [] }, pack));
 }
 const stronger = strongerFor(eff.goal, input.facts, input.answeredKeys);
 return { versions, strongerQuestion: stronger.question, strongerKey: stronger.key, strongerOptions: stronger.options, recommendation: advice.recommendation, advice: advice.advice, channel: advice.draftChannel, notesLeft: input.notesLeft, canWriteNote: advice.canWriteNote };
}

/** A candidate as a shown version: references added for any evidence it quotes, and the checker's verdict. */
function toVersion(input: ExtendedDraftInput, c: Candidate, pack: EvidencePack): DraftVersion {
 const body = c.body.trim(), flat = norm(body);
 const quotes = (text: string) => { const n = norm(text); return n.length >= 12 && flat.includes(n.slice(0, Math.min(n.length, 40))); };
 const factRefs = [...new Set([...c.factRefs, ...pack.facts.filter(f => quotes(f.text)).map(f => f.id)])];
 const briefRefs = [...new Set([...c.briefRefs, ...pack.briefFacts.filter(f => quotes(f.text)).map(f => f.id)])];
 const verdict = checkMessage(body, input.relationship, { channel: input.channel, noteMax: input.noteLimit === 300 ? 300 : undefined, intent: "work_question", facts: pack.facts.map(f => f.text) }).verdict;
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
 return (await callStructured({ system: OUTREACH_SYSTEM, user: outreachUser(pack, book, { channel: input.channel, limit, unit, problems, afterAccept }), schema: DraftModelReply, effort: "low", maxTokens: 2000 })).versions;
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
 const advice = adviceFor(input);
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

 const mock = deps.mock ?? isMock();
 try {
  const result = await generateOutreach(
   { goal, relationship, channel: req.channel, name: contact.name, role: contact.role, company: contact.company, facts, briefFacts, noteLimit: req.noteLimit, tier: contact.tier, notesLeft, forceNote: req.forceNote, answeredKeys },
   { mock, model: deps.model, spend: deps.spend ?? (() => recordAISpend(db, userId)) },
  );
  return reply(200, result);
 } catch (e) {
  if (e instanceof DailyCapError) return reply(429, { error: "You have used today's AI-written drafts. The limit resets tomorrow; demo drafts still work." });
  throw e;
 }
}
