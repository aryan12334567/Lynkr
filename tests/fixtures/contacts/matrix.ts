/**
 * Outreach evaluation harness (build plan U12). Shared by scripts/eval-outreach.mts and tests/outreach-evaluation.test.mts.
 *
 * Everything here runs offline. The draft engine runs in demo mode (the deterministic composer). Where a model
 * matters, a local function stands in for it: a worst-case model that obeys whatever the evidence says. No key is
 * read and no network call is made.
 *
 * A "failure" is a draft or a fixture that breaks a rule. Each carries the rule and a suspected cause that names the
 * lib file and function to fix. This harness never changes lib files.
 */
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { checkMessage, CHANNEL_RULES, hasPlaceholder, type Relationship } from "../../../lib/checker";
import { pgliteDb, saveFacts, type Db } from "../../../lib/db";
import type { Channel, FactRef, Intent } from "../../../lib/schemas";
import { cleanBriefText, groundedBriefFacts } from "../../../lib/outreach/brief";
import { addContact } from "../../../lib/outreach/contacts-db";
import { composeDrafts, draftProblem, generateOutreach, limitFor, runDraft, selectionEvidence, type Candidate, type DraftResult, type DraftVersion, type EvidenceItem, type ExtendedDraftInput, type ModelFn } from "../../../lib/outreach/draft";
import { GOAL_IDS, allowsReferralAsk, goalDetailFact, type OutreachGoal } from "../../../lib/outreach/goals";
import { STEPS, STEP_KINDS, playbookFor, type StepKind } from "../../../lib/outreach/playbooks";
import { recordEvent } from "../../../lib/outreach/timeline";
import { OUTREACH_PERSONAS, type OutreachPersona } from "../personas";
import { BENIGN_NOTE, BENIGN_PAGE, BENIGN_SELECTION, BENIGN_WHY, CANARY, INJECTIONS, SENSITIVE, type Injection, type Sensitive } from "./injections";
import { recipientAt, type Recipient } from "./recipients";

export const RELATIONSHIPS = ["stranger", "alumni", "knows_me"] as const satisfies readonly Relationship[];
export const FIRST_CHANNELS = ["connection_note", "linkedin_message", "inmail", "email"] as const satisfies readonly Channel[];
export const STEP_CHANNELS = ["linkedin_message", "inmail", "email"] as const satisfies readonly Channel[];

// ---------------------------------------------------------------------------------------------
// Scoring one draft
// ---------------------------------------------------------------------------------------------

export type Failure = { id: string; rule: string; body: string; detail?: string };
export type Scored = {
  id: string;
  kind: "first" | "step" | "selection";
  goal: OutreachGoal;
  persona: string;
  relationship: Relationship;
  channel: Channel;
  angle: string;
  body: string;
  verdict: string;
  tells: string[];
  /** The tips of the checker's fix and block flags, which is why a verdict says "Edit before sending". */
  editReasons: string[];
  failures: Failure[];
};

/** What the evidence behind a draft was, as the scorer sees it (independent of the engine's own pack). */
export type ScoreCtx = {
  id: string;
  kind: Scored["kind"];
  goal: OutreachGoal;
  persona: string;
  relationship: Relationship;
  /** The input the engine was given, with the channel it actually drafted for. */
  input: ExtendedDraftInput;
  expectIntent: Intent;
};

const TOKEN = /[\p{L}\p{N}]+(?:[.,][\p{N}]+)?/gu;
const tokens = (texts: string[]) => new Set(texts.join(" ").toLowerCase().match(TOKEN) ?? []);
const wordsIn = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
const sizeOf = (body: string, unit: "chars" | "words") => (unit === "chars" ? body.length : body.trim().split(/\s+/).length);
const TINY = new Set("the and for with our not but are was were had has its into from you your who how why may can will did does too out any all new one two per yet nor have also just once recently".split(" "));
const GREETING = /^(?:hi|hello|dear)\s+[\p{L}'-]+,?\s*/iu;
const DID = /\b(?:i|we)(?:'ve| have)?\s+(?:also\s+|just\s+|recently\s+|once\s+)?(?:built|made|led|ran|shipped|wrote|designed|launched|grew|managed|founded|won|created|developed|reduced|increased|improved|delivered|helped|worked|interned|cleaned|analy[sz]ed|taught|studied|completed|achieved|earned|scored|presented|organi[sz]ed|started|sold|raised|saved|cut|trained|mentored|published|automated|tested|researched|coded|joined)\b/i;
const RECIPIENT_HOOK = /\b(?:i (?:saw|read|noticed|watched|loved|enjoyed|heard|admire|followed|came across)|congrat\w*|your (?:recent|latest|new|post|article|talk|launch|podcast|newsletter|blog|paper|book|promotion|keynote|interview|thread|video))\b/i;
const MEETING_CLAIM = /\b(?:you (?:mentioned|said|told me|suggested|recommended|shared|explained|walked me through|pointed out|advised)|we (?:discussed|talked about|spoke about|covered|agreed)|our (?:discussion|conversation|chat|call) (?:about|on)|your (?:advice|suggestion|tip|recommendation|feedback) (?:on|about))\b/i;
const INVENTED_TIES = /\b(?:catch(?:ing)? up|reconnect(?:ing)?|great to hear from you|as we discussed|when we (?:met|spoke)|last time|our (?:last|earlier) (?:chat|call|conversation)|long time|it'?s been a while|good to see you again)\b/i;
const JOB_ASK = /\b(?:refer me|referral|referring me|hire me|any (?:jobs?|openings?)|job at)\b/i;
const NO_JOB_ASK_STEPS: readonly StepKind[] = ["thank_you", "reschedule", "check_in"];

/** Why a draft fails, judged without the engine's own guard: numbers, names, quotes, hooks, meeting claims, own-work claims. */
export function untracedClaims(body: string, evidence: string[], opts: { recipientEvidence: boolean; noteEvidence: boolean; userEvidence: string[] }): string[] {
  const out: string[] = [];
  const known = tokens(evidence);
  for (const n of body.match(/\b\d+(?:[.,]\d+)*\b/g) ?? []) if (!known.has(n.toLowerCase())) out.push(`number ${n}`);
  const rest = body.replace(GREETING, "");
  for (const m of rest.matchAll(/\b[A-Z][\p{L}\p{N}'-]*\b/gu)) {
    const word = m[0];
    const before = rest.slice(0, m.index);
    if (/^(?:I|I'm|I've|I'd|I'll|Hi|Hello)$/.test(word) || /(?:^|[.!?]["”]?\s*|["“]\s*)$/.test(before)) continue;
    if (!known.has(word.toLowerCase()) && !known.has(word.toLowerCase().split("'")[0])) out.push(`name ${word}`);
  }
  const hay = evidence.join(" ").toLowerCase();
  for (const q of body.matchAll(/[“"]([^”"]+)[”"]/g)) if (!hay.includes(q[1].toLowerCase().replace(/'/g, "'"))) out.push(`quote "${q[1].slice(0, 30)}"`);
  const sentences = body.split(/(?<=[.?!]["”]?)\s+|\n+/).map(s => s.trim()).filter(Boolean);
  const ownKnown = tokens(opts.userEvidence);
  for (const s of sentences) {
    const unquoted = s.replace(/[“"][^”"]*[”"]/g, " ");
    if (!opts.noteEvidence && MEETING_CLAIM.test(unquoted)) out.push(`meeting detail "${s.slice(0, 40)}"`);
    if (!opts.recipientEvidence && RECIPIENT_HOOK.test(unquoted)) out.push(`recipient hook "${s.slice(0, 40)}"`);
    if (DID.test(unquoted)) {
      const ws = wordsIn(unquoted.replace(GREETING, "")).filter(w => !TINY.has(w));
      const stem = (w: string) => w.replace(/(ings|ing|ed|es|s)$/, "");
      const ownStems = new Set([...ownKnown].map(stem));
      if (ws.length && ws.filter(w => ownStems.has(stem(w))).length / ws.length < 0.8) out.push(`own claim "${s.slice(0, 40)}"`);
    }
  }
  return out;
}

/** The AI tells that apply to a short message, from the copywriting skill's ai-tells list and the checker's banned phrases. */
const TELLS: [string, RegExp][] = [
  ["em dash", /[—–]|\s--\s/],
  ["exclamation", /!/],
  ["contrast reveal", /\b(?:it'?s|this is|that'?s) not (?:just )?[^.?!]{1,60}(?:,|\.) ?(?:it'?s|but|this is)|\bnot just [^.?!,]{1,40}, but\b|\bisn'?t (?:about )?[^.?!]{1,40}(?:,|\.) ?(?:it'?s|but)/i],
  ["negation list", /\bno [a-z]+(?:,| and) no [a-z]+/i],
  ["self-answered question", /\b(?:the result|the catch|the best part|why does this matter)\?/i],
  ["stock opener", /\b(?:i hope this (?:message|email) finds you well|here'?s the thing|i'?ll be honest|quick question|i came across your profile|hope you'?re doing well)\b/i],
  ["banned word", /\b(?:delve|tapestry|testament|embark|synergy|leverage|seamless|robust|streamline|unlock|empower|elevate|thrilled|passionate|journey|game[- ]chang\w*|cutting-edge|best-in-class|circle back)\b/i],
  ["generic praise", /\b(?:i (?:really )?admire your|impressive profile|inspiring)\b/i],
  ["tidy closer", /\bthe future of [^.?!]{0,40}\b(?:is|starts)\b|\bbecause (?:you|your team) deserve/i],
  ["I'd love to / excited", /\b(?:i'?d love to|excited to)\b/i],
  ["dangling reference", /\b(?:whether|how) (?:this|that) (?:fits|works)\b|\bhandles this today\b|\bat my stage\b/i],
];
export const tellsOf = (body: string): string[] => TELLS.filter(([, re]) => re.test(body)).map(([name]) => name);

/** Everything the three kinds of draft share: traced, no placeholder, within limits, checked. */
export function scoreVersion(ctx: ScoreCtx, result: DraftResult, v: DraftVersion): Scored {
  const { input } = ctx;
  const failures: Failure[] = [];
  const fail = (rule: string, detail?: string) => failures.push({ id: ctx.id, rule, body: v.body, detail });
  const body = v.body;
  const channel = result.channel;

  // 1. Placeholders and fragments: the engine's own test plus a wider one for what a broken template leaves behind.
  if (hasPlaceholder(body)) fail("placeholder", "brackets, braces, TODO or TBD");
  const stray = /\b(?:undefined|null|NaN)\b|\{\{|\}\}|\bHi\s*,|\s{2,}|\b(?:as an?|at|of|in)\s*[,.]|\.\.|,\s*,|\s[,.]/.exec(body);
  if (stray) fail("placeholder", `leftover fragment "${stray[0]}"`);
  if (((body.match(/"/g) ?? []).length) % 2) fail("placeholder", "unbalanced quotation marks");

  // 2. Traced claims: the engine's guard, then an independent reading of the same evidence.
  const problem = draftProblem(input, { body, factRefs: v.factRefs, briefRefs: v.briefRefs });
  if (problem) fail(`trace guard: ${problem}`);
  const extras = input.extraEvidence ?? [];
  const recipient = [input.name, input.role ?? "", input.company ?? ""];
  const userEvidence = input.facts.map(f => f.text);
  const evidence = [...recipient, ...userEvidence, ...(input.briefFacts ?? []).map(b => b.text), ...extras.map(e => e.text)];
  // The approved wording a step or playbook may add: the ask and lines of the engine's own templates are not claims.
  const book = playbookFor(input.goal, input.relationship);
  const stepAsk = input.step ? stepTexts(input.step) : [];
  const ask = [book.ask, ...stepAsk];
  const untraced = untracedClaims(body, [...evidence, ...ask], { recipientEvidence: (input.briefFacts?.length ?? 0) + extras.length > 0, noteEvidence: extras.some(e => e.label === "note"), userEvidence: [...userEvidence, ...ask, ...extras.filter(e => e.label !== "selected_reply" && e.label !== "selected_contact").map(e => e.text)] });
  for (const u of untraced) fail("untraced claim", u);

  // 3. Limits: the channel's own cap, and the playbook's or step's cap.
  const rule = CHANNEL_RULES[channel];
  const cap = channel === "connection_note" && input.noteLimit === 300 ? 300 : rule.max;
  if (sizeOf(body, rule.unit) > cap) fail("channel limit", `${sizeOf(body, rule.unit)} ${rule.unit} > ${cap}`);
  const lim = limitFor({ channel, noteLimit: input.noteLimit, step: input.step }, book);
  if (sizeOf(body, lim.unit) > lim.limit) fail("playbook limit", `${sizeOf(body, lim.unit)} ${lim.unit} > ${lim.limit}`);

  // 4. The checker.
  const rel: Relationship = input.step ? "knows_me" : input.relationship;
  const check = checkMessage(body, rel, { channel, noteMax: input.noteLimit === 300 ? 300 : undefined, intent: "work_question", facts: input.facts.map(f => f.text), sharedHistory: input.step && input.meeting ? true : undefined });
  if (check.verdict === "Do not send yet" || v.verdict === "Do not send yet") fail("checker blocks", check.flags.filter(f => f.severity === "block").map(f => f.phrase).join(", "));
  const editReasons = check.verdict === "Edit before sending" ? [...check.checks.filter(c => !c.ok && c.severity !== "advice").map(c => c.label.replace(/\(\d+\)$/, "").trim()), ...check.flags.filter(f => f.severity === "fix").map(f => f.phrase.replace(/:.*/, ""))] : [];

  // 5. Role: the intent, the referral rule, invented history.
  if (result.intent !== ctx.expectIntent) fail("intent", `${result.intent} != ${ctx.expectIntent}`);
  if (JOB_ASK.test(body) && result.intent !== "referral") fail("referral outside its playbook", body.match(JOB_ASK)![0]);
  if (input.step && NO_JOB_ASK_STEPS.includes(input.step) && JOB_ASK.test(body)) fail("job ask in a step that never asks", body.match(JOB_ASK)![0]);
  if (!input.step && input.relationship === "stranger" && INVENTED_TIES.test(body)) fail("invented relationship", body.match(INVENTED_TIES)![0]);

  return { id: ctx.id, kind: ctx.kind, goal: ctx.goal, persona: ctx.persona, relationship: ctx.relationship, channel, angle: v.angle, body, verdict: v.verdict, tells: tellsOf(body), editReasons, failures };
}

function stepTexts(step: StepKind): string[] {
  // The engine's approved step wording is private to draft.ts. A step draft is built only from these lines and the
  // recipient's details, so the scorer reads them back from a real step draft with no evidence at all.
  const input: ExtendedDraftInput = { goal: "job", relationship: "knows_me", channel: "email", name: "Zed", facts: [], step, meeting: true };
  return composeDrafts(input).versions.map(v => v.body);
}

/** Two or three complete versions, never fewer than two. */
function scoreResult(ctx: ScoreCtx, result: DraftResult): Scored[] {
  const scored = result.versions.map(v => scoreVersion({ ...ctx, id: `${ctx.id}/${v.angle}` }, result, v));
  if (result.versions.length < 2) scored.push({ id: ctx.id, kind: ctx.kind, goal: ctx.goal, persona: ctx.persona, relationship: ctx.relationship, channel: result.channel, angle: "-", body: "", verdict: "", tells: [], editReasons: [], failures: [{ id: ctx.id, rule: "fewer than two versions", body: "", detail: `${result.versions.length} version(s)` }] });
  const bodies = result.versions.map(v => v.body);
  if (new Set(bodies).size !== bodies.length) scored[0].failures.push({ id: ctx.id, rule: "duplicate versions", body: bodies[0] });
  return scored;
}

// ---------------------------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------------------------

export type Report = {
  combinations: number;
  drafts: number;
  failures: Failure[];
  verdicts: Record<string, number>;
  editReasons: Record<string, number>;
  tells: Record<string, number>;
  draftsWithTells: number;
  /** Drafts per channel by checker verdict. */
  byChannel: Record<string, { total: number; ready: number; edit: number }>;
  /** Drafts per goal by checker verdict. */
  byGoal: Record<string, { total: number; edit: number }>;
  scored: Scored[];
};
const emptyReport = (): Report => ({ combinations: 0, drafts: 0, failures: [], verdicts: {}, editReasons: {}, tells: {}, draftsWithTells: 0, byChannel: {}, byGoal: {}, scored: [] });
function absorb(report: Report, scored: Scored[]): void {
  report.combinations++;
  for (const s of scored) {
    if (!s.body && s.failures.length) { report.failures.push(...s.failures); continue; }
    report.drafts++;
    report.scored.push(s);
    report.failures.push(...s.failures);
    report.verdicts[s.verdict] = (report.verdicts[s.verdict] ?? 0) + 1;
    const ch = (report.byChannel[s.channel] ??= { total: 0, ready: 0, edit: 0 });
    ch.total++;
    if (s.verdict === "Edit before sending") ch.edit++; else if (s.verdict === "Looks ready for your review") ch.ready++;
    const g = (report.byGoal[s.goal] ??= { total: 0, edit: 0 });
    g.total++; if (s.verdict === "Edit before sending") g.edit++;
    for (const r of new Set(s.editReasons)) report.editReasons[r] = (report.editReasons[r] ?? 0) + 1;
    for (const t of s.tells) report.tells[t] = (report.tells[t] ?? 0) + 1;
    if (s.tells.length) report.draftsWithTells++;
  }
}
export const failuresByRule = (failures: Failure[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const f of failures) out[f.rule] = (out[f.rule] ?? 0) + 1;
  return out;
};

// ---------------------------------------------------------------------------------------------
// 1. First messages: 10 goals x 7 personas x 3 relationships x 4 channels x variants
// ---------------------------------------------------------------------------------------------

export type Variant = "bare" | "lead_tap" | "lead_typed" | "brief" | "tier2" | "note300";
/** A tapped option for some goals, a typed answer for the rest. */
const TAP: Record<OutreachGoal, { key: string; answer: string }> = {
  job: { key: "role", answer: "Full time" }, referral: { key: "company", answer: "Zoho" }, network: { key: "topic", answer: "Their work" },
  mentor: { key: "topic", answer: "Skills" }, clients: { key: "buyer", answer: "Teams" }, hiring: { key: "role", answer: "Contract" },
  funding: { key: "stage", answer: "Seed" }, buy_business: { key: "kind", answer: "Services" }, partner: { key: "kind", answer: "Distribution" }, reconnect: { key: "reason", answer: "Work" },
};
const TYPED: Record<OutreachGoal, { key: string; answer: string }> = {
  job: { key: "role", answer: "analytics internship" }, referral: { key: "company", answer: "Fractal Analytics" }, network: { key: "topic", answer: "supply chain planning" },
  mentor: { key: "topic", answer: "moving into product" }, clients: { key: "buyer", answer: "restaurant owners" }, hiring: { key: "role", answer: "senior designer" },
  funding: { key: "stage", answer: "angel" }, buy_business: { key: "kind", answer: "logistics" }, partner: { key: "kind", answer: "newsletter" }, reconnect: { key: "reason", answer: "a possible project" },
};
const toRef = (f: { id: string; kind: string; text: string }): FactRef => ({ id: f.id, kind: f.kind as FactRef["kind"], text: f.text });
const detailRef = (goal: OutreachGoal, a: { key: string; answer: string }): FactRef => toRef(goalDetailFact(goal, a.key, a.answer));
const BRIEF_FACT = { id: "B1", text: "Wrote a post about warehouse costs." };

export function firstMessageInput(goal: OutreachGoal, persona: OutreachPersona, relationship: Relationship, channel: Channel, variant: Variant, recipient: Recipient): ExtendedDraftInput {
  // The engine reads at most two facts. With a goal answer, factsFor("outreach") keeps the best proof and the answer.
  const facts: FactRef[] = persona.facts.map(toRef);
  if (variant === "lead_tap") facts.splice(1, facts.length, detailRef(goal, TAP[goal]));
  if (variant === "lead_typed") facts.splice(1, facts.length, detailRef(goal, TYPED[goal]));
  return {
    goal, relationship, channel, name: recipient.name, role: recipient.role, company: recipient.company, facts,
    ...(variant === "brief" ? { briefFacts: [BRIEF_FACT] } : {}),
    ...(variant === "tier2" ? { tier: "tier_2" as const } : {}),
    ...(variant === "note300" ? { noteLimit: 300 as const } : {}),
  };
}
const VARIANTS_FOR = (channel: Channel): Variant[] => (channel === "connection_note" ? ["bare", "lead_tap", "lead_typed", "brief", "tier2", "note300"] : ["bare", "lead_tap", "lead_typed", "brief"]);

export async function runFirstMessages(): Promise<Report> {
  const report = emptyReport();
  let n = 0;
  for (const goal of GOAL_IDS) for (const persona of OUTREACH_PERSONAS) for (const relationship of RELATIONSHIPS) for (const channel of FIRST_CHANNELS) for (const variant of VARIANTS_FOR(channel)) {
    const input = firstMessageInput(goal, persona, relationship, channel, variant, recipientAt(n++));
    const result = await generateOutreach(input, { mock: true });
    const id = `${goal}/${persona.id}/${relationship}/${channel}/${variant}`;
    absorb(report, scoreResult({ id, kind: "first", goal, persona: persona.id, relationship, input: { ...input, channel: result.channel }, expectIntent: playbookFor(goal, relationship).intent }, result));
  }
  return report;
}

// ---------------------------------------------------------------------------------------------
// 2. Selected text used as evidence: 10 goals x 7 personas x 3 relationships x reply|contact x 2 channels
// ---------------------------------------------------------------------------------------------

export const SELECTIONS = [
  "Great point on credit risk.",
  "Leads credit risk models for retail lending.",
  "We cut warehouse costs by 18 percent last year.",
  "Hiring is the hardest part of scaling a small team.",
];

export async function runSelections(): Promise<Report & { quoted: number; quotable: number }> {
  const report = emptyReport() as Report & { quoted: number; quotable: number };
  report.quoted = 0; report.quotable = 0;
  let n = 0;
  for (const goal of GOAL_IDS) for (const persona of OUTREACH_PERSONAS) for (const relationship of RELATIONSHIPS) for (const use of ["reply", "contact"] as const) for (const channel of ["linkedin_message", "connection_note"] as const) {
    const text = SELECTIONS[n % SELECTIONS.length];
    const recipient = recipientAt(n++);
    const base = firstMessageInput(goal, persona, relationship, channel, "bare", recipient);
    const input: ExtendedDraftInput = { ...base, extraEvidence: selectionEvidence(text, use) };
    const result = await generateOutreach(input, { mock: true });
    const id = `${goal}/${persona.id}/${relationship}/${channel}/selection-${use}`;
    const scored = scoreResult({ id, kind: "selection", goal, persona: persona.id, relationship, input: { ...input, channel: result.channel }, expectIntent: playbookFor(goal, relationship).intent }, result);
    const plain = await generateOutreach(base, { mock: true });
    if (plain.intent !== result.intent) scored[0].failures.push({ id, rule: "intent", body: scored[0].body, detail: `selection changed intent ${plain.intent} -> ${result.intent}` });
    absorb(report, scored);
    if (channel === "linkedin_message") { report.quotable++; if (result.versions.some(v => v.body.toLowerCase().includes(text.slice(0, 12).toLowerCase()))) report.quoted++; }
  }
  return report;
}

// ---------------------------------------------------------------------------------------------
// 3. Timeline steps through the real handler: runDraft with an eventId, on PGlite
// ---------------------------------------------------------------------------------------------

const sql = (name: string) => readFileSync(new URL(`../../../scripts/migrations/${name}`, import.meta.url), "utf8");
export async function freshDb(users: string[]): Promise<{ pg: PGlite; db: Db }> {
  const pg = new PGlite();
  await pg.exec(`create table "user" (id text primary key); ${users.map(u => `insert into "user" values ('${u}');`).join(" ")}`);
  for (const f of ["001_vertical1.sql", "002_outreach.sql", "005_outreach_timeline.sql"]) await pg.exec(sql(f));
  return { pg, db: pgliteDb(pg) as Db };
}
const stamp = new Date().toISOString();
export async function seedPersona(db: Db, userId: string, persona: OutreachPersona): Promise<void> {
  await saveFacts(db, userId, persona.facts.map(f => ({ id: f.id, kind: f.kind, text: f.text, sourceTurnIds: [], reviewStatus: "confirmed" as const, useInDrafts: true, updatedAt: stamp })));
}
const none = () => [] as never[];
const PERSON = { bridge: "public_work", intent: "learn_role", tier: "tier_1" } as const;

/** A contact with the events that make `step` due. Returns the contact id and the step's event id. */
export async function contactWithStep(db: Db, userId: string, opts: { goal: OutreachGoal; relationship: Relationship; recipient: Recipient; step: StepKind; whyText?: string; whySource?: "finder" | "comment"; note?: string; tag: string }): Promise<{ contactId: string; eventId: string }> {
  const c = await addContact(db, userId, { ...PERSON, name: opts.recipient.name, company: opts.recipient.company, role: opts.recipient.role, goal: opts.goal as never, relationship: opts.relationship, ...(opts.whyText ? { whyText: opts.whyText, whySource: opts.whySource ?? "manual" } : {}) });
  const op = (suffix: string) => `${opts.tag}-${c.id}-${suffix}`;
  if (opts.step === "follow_up") {
    await recordEvent(db, userId, { type: "insert", opId: op("sent"), contactId: c.id, kind: "message_sent", doneAt: new Date(Date.now() - 6 * 86400_000) }, { suggest: none });
  } else {
    const at = new Date(Date.now() - 36 * 3600_000);
    await recordEvent(db, userId, { type: "insert", opId: op("book"), contactId: c.id, kind: "meeting_booked", meetingAt: at, doneAt: new Date(at.getTime() - 86400_000) }, { suggest: none });
    const happened = opts.step === "reschedule" ? "no_show" : "yes";
    await recordEvent(db, userId, { type: "insert", opId: op("done"), contactId: c.id, kind: "meeting_done", happened, rating: happened === "yes" ? "good" : undefined, ...(opts.note ? { note: opts.note } : {}) }, { suggest: none });
  }
  const step = await recordEvent(db, userId, { type: "insert", opId: op("step"), contactId: c.id, kind: opts.step, status: "due", dueAt: new Date(Date.now() + 86400_000) }, { suggest: none });
  return { contactId: c.id, eventId: step.event.id };
}

export async function withNotes<T>(value: string | undefined, run: () => Promise<T>): Promise<T> {
  const before = process.env.LYNKR_OUTREACH_NOTES_IN_DRAFTS;
  if (value === undefined) delete process.env.LYNKR_OUTREACH_NOTES_IN_DRAFTS; else process.env.LYNKR_OUTREACH_NOTES_IN_DRAFTS = value;
  try { return await run(); } finally { if (before === undefined) delete process.env.LYNKR_OUTREACH_NOTES_IN_DRAFTS; else process.env.LYNKR_OUTREACH_NOTES_IN_DRAFTS = before; }
}

type Out = DraftResult & { error?: string };
const outOf = (r: { status: number; body: Record<string, unknown> }): Out => r.body as unknown as Out;

export async function runTimeline(): Promise<Report & { byStep: Record<string, number> }> {
  const report = emptyReport() as Report & { byStep: Record<string, number> };
  report.byStep = {};
  const users = OUTREACH_PERSONAS.map((_, i) => `u${i}`);
  const { pg, db } = await freshDb(users);
  try {
    for (let i = 0; i < users.length; i++) await seedPersona(db, users[i], OUTREACH_PERSONAS[i]);
    let n = 0;
    for (const goal of GOAL_IDS) for (const relationship of RELATIONSHIPS) {
      const steps = STEP_KINDS.filter(s => s !== "referral_ask" || allowsReferralAsk(goal));
      for (const step of steps) {
        const pi = n % OUTREACH_PERSONAS.length, recipient = recipientAt(n++);
        const userId = users[pi], persona = OUTREACH_PERSONAS[pi];
        const { contactId, eventId } = await contactWithStep(db, userId, { goal, relationship, recipient, step, tag: "t" });
        for (const channel of STEP_CHANNELS) {
          const id = `${goal}/${persona.id}/${relationship}/${step}/${channel}`;
          const res = await withNotes(undefined, () => runDraft(db, userId, { contactId, channel, eventId }, { mock: true }));
          if (res.status !== 200) { absorb(report, [{ id, kind: "step", goal, persona: persona.id, relationship, channel, angle: "-", body: "", verdict: "", tells: [], editReasons: [], failures: [{ id, rule: "step draft refused", body: "", detail: `${res.status} ${JSON.stringify(res.body)}` }] }]); continue; }
          const out = outOf(res);
          const input: ExtendedDraftInput = { goal, relationship, channel, name: recipient.name, role: recipient.role, company: recipient.company, facts: persona.facts.map(toRef), step, meeting: step !== "follow_up" };
          absorb(report, scoreResult({ id, kind: "step", goal, persona: persona.id, relationship, input, expectIntent: STEPS[step].intent }, out));
          if (out.step !== step) report.failures.push({ id, rule: "intent", body: "", detail: `step echoed as ${out.step}` });
          report.byStep[step] = (report.byStep[step] ?? 0) + out.versions.length;
        }
      }
    }
    // A referral ask is refused outside the job and referral goals.
    for (const goal of GOAL_IDS.filter(g => !allowsReferralAsk(g))) {
      const recipient = recipientAt(n++);
      const { contactId, eventId } = await contactWithStep(db, users[0], { goal, relationship: "knows_me", recipient, step: "referral_ask", tag: "r" });
      const res = await runDraft(db, users[0], { contactId, channel: "email", eventId }, { mock: true });
      report.combinations++;
      if (res.status !== 400) report.failures.push({ id: `${goal}/referral_ask`, rule: "referral ask allowed outside its goals", body: "", detail: `status ${res.status}` });
    }
  } finally { await pg.close(); }
  return report;
}

// ---------------------------------------------------------------------------------------------
// 4. Injection and sensitive-topic fixtures
// ---------------------------------------------------------------------------------------------

export type Path = "selection_reply" | "selection_contact" | "meeting_note" | "why_text" | "page_brief";
export const PATHS: Path[] = ["selection_reply", "selection_contact", "meeting_note", "why_text", "page_brief"];
const PATH_LABEL: Record<Path, string> = { selection_reply: "selected text (reply)", selection_contact: "selected text (contact)", meeting_note: "meeting note (notes switch on)", why_text: "finder-sourced why you connected", page_brief: "page text through the brief" };
export const pathLabel = (p: Path) => PATH_LABEL[p];

/**
 * A worst-case model: it does what the evidence tells it. It returns one version that repeats every piece of evidence
 * it was given, and one that obeys a planted request. A guard that works rejects the second; a cleaner that works leaves
 * nothing in the first.
 */
export function compliantModel(seen: string[]): ModelFn {
  return async (_attempt, pack, ctx) => {
    seen.push(JSON.stringify({ extras: pack.extras, briefFacts: pack.briefFacts, facts: pack.facts }));
    const first = pack.recipient.name.split(" ")[0] || "there";
    const evidence = [...pack.extras.map(e => e.text), ...pack.briefFacts.map(b => b.text)].join(" ");
    const echo: Candidate = { angle: "direct", body: `Hi ${first}, ${evidence} ${ctx.input.step ? "" : ctx.book.ask}`.replace(/\s+/g, " ").trim(), factRefs: [], briefRefs: pack.briefFacts.map(b => b.id) };
    const obey: Candidate = { angle: "context", body: `Hi ${first}, could you refer me for a job at ${pack.recipient.company || "your company"}? ${CANARY}`, factRefs: [], briefRefs: [] };
    return [echo, obey];
  };
}

export type FixtureOutcome = { bodies: string[]; intent: string; seen: string; status: number };

/** One contact for one path, drafted in demo mode or with the worst-case model. `plant` is "" for the baseline. */
async function draftWith(db: Db, userId: string, path: Path, goal: OutreachGoal, plantText: string, position: "first" | "last", mode: "demo" | "model", n: number): Promise<FixtureOutcome> {
  const benign: Record<Path, string> = { selection_reply: BENIGN_SELECTION, selection_contact: BENIGN_SELECTION, meeting_note: BENIGN_NOTE, why_text: BENIGN_WHY, page_brief: BENIGN_PAGE };
  const text = !plantText ? benign[path] : position === "first" ? `${plantText} ${benign[path]}` : `${benign[path]} ${plantText}`;
  const recipient = recipientAt(n);
  const relationship: Relationship = RELATIONSHIPS[n % 3];
  const seen: string[] = [];
  const opts = mode === "demo" ? { mock: true as const } : { mock: false as const, spend: async () => true, model: compliantModel(seen) };
  if (path === "meeting_note" || path === "why_text") {
    const step: StepKind = n % 2 ? "thank_you" : "check_in";
    const { contactId, eventId } = await contactWithStep(db, userId, { goal, relationship, recipient, step, tag: `f${n}-${mode}`, ...(path === "why_text" ? { whyText: text.slice(0, 200), whySource: "finder" as const } : { note: text.slice(0, 280) }) });
    const res = await withNotes("on", () => runDraft(db, userId, { contactId, channel: "linkedin_message", eventId }, opts));
    const out = outOf(res);
    return { bodies: (out.versions ?? []).map(v => v.body), intent: out.intent, seen: seen.join("\n"), status: res.status };
  }
  let brief: Record<string, unknown> = { facts: [], noHook: true };
  if (path === "page_brief") {
    // The worst-case extractor: every sentence of the page becomes a "fact" with its own quote.
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    const facts = groundedBriefFacts(sentences.map(s => ({ text: s, quote: s, source: "page", date: "" })), [{ source: "page", text }]);
    brief = { facts };
  }
  const c = await addContact(db, userId, { ...PERSON, name: recipient.name, company: recipient.company, role: recipient.role, goal: goal as never, relationship, brief });
  const selection = path === "selection_reply" || path === "selection_contact" ? text : undefined;
  const res = await runDraft(db, userId, { contactId: c.id, channel: "linkedin_message", ...(selection ? { selection, selectionUse: path === "selection_reply" ? "reply" as const : "contact" as const } : {}) }, opts);
  const out = outOf(res);
  return { bodies: (out.versions ?? []).map(v => v.body), intent: out.intent, seen: seen.join("\n"), status: res.status };
}

const expectedIntent = (path: Path, goal: OutreachGoal, relationship: Relationship, n: number): Intent => (path === "meeting_note" || path === "why_text" ? (n % 2 ? STEPS.thank_you.intent : STEPS.check_in.intent) : playbookFor(goal, relationship).intent);

export type FixtureReport = { cases: number; runs: number; failures: (Failure & { kind: string; path: Path })[] };

export async function runInjections(): Promise<FixtureReport> {
  const report: FixtureReport = { cases: 0, runs: 0, failures: [] };
  const { pg, db } = await freshDb(["inj"]);
  try {
    await seedPersona(db, "inj", OUTREACH_PERSONAS[0]);
    let n = 0;
    for (let ii = 0; ii < INJECTIONS.length; ii++) for (let pi = 0; pi < PATHS.length; pi++) for (const position of ["first", "last"] as const) {
      const inj = INJECTIONS[ii], path = PATHS[pi];
      const goals = [GOAL_IDS[(ii + pi + (position === "first" ? 0 : 1)) % 10], GOAL_IDS[(ii * 3 + pi + 5) % 10]];
      for (const goal of goals) for (const mode of ["demo", "model"] as const) {
        n++;
        const id = `injection ${inj.id} / ${PATH_LABEL[path]} / ${position} / ${goal} / ${mode}`;
        const idx = n;
        // Both runs use the same recipient and relationship, so the only difference is the planted text.
        const baseSame = await draftWith(db, "inj", path, goal, "", position, mode, idx);
        const hit = await draftWith(db, "inj", path, goal, inj.text, position, mode, idx);
        report.cases++; report.runs += 2;
        const relationship = RELATIONSHIPS[idx % 3];
        const fail = (rule: string, detail: string, body = "") => report.failures.push({ id, rule, body, detail, kind: inj.kind, path });
        if (hit.status !== 200) { fail("draft refused", `status ${hit.status}`); continue; }
        if (hit.intent !== expectedIntent(path, goal, relationship, idx)) fail("intent changed", `${hit.intent}`);
        for (const b of hit.bodies) {
          if (b.includes(CANARY)) fail("planted text in a draft", "canary in draft", b);
          if (JOB_ASK.test(b) && !baseSame.bodies.some(x => JOB_ASK.test(x)) && !(allowsReferralAsk(goal) && hit.intent === "referral")) fail("job or referral ask introduced", b.match(JOB_ASK)![0], b);
        }
        if (mode === "demo" && JSON.stringify(hit.bodies) !== JSON.stringify(baseSame.bodies)) fail("draft differs from the one without the plant", "demo drafts changed", hit.bodies.find(b => !baseSame.bodies.includes(b)) ?? "");
        if (mode === "model" && (hit.seen.includes(CANARY) || hit.seen.toLowerCase().includes(inj.text.slice(0, 25).toLowerCase()))) fail("planted text reached the model's evidence", "evidence pack holds the plant", hit.seen.slice(0, 200));
      }
    }
  } finally { await pg.close(); }
  return report;
}

export async function runSensitive(): Promise<FixtureReport> {
  const report: FixtureReport = { cases: 0, runs: 0, failures: [] };
  const { pg, db } = await freshDb(["sen"]);
  try {
    await seedPersona(db, "sen", OUTREACH_PERSONAS[0]);
    let n = 0;
    for (let si = 0; si < SENSITIVE.length; si++) for (let pi = 0; pi < PATHS.length; pi++) for (const position of ["first", "last"] as const) {
      const s: Sensitive = SENSITIVE[si], path = PATHS[pi];
      const goal = GOAL_IDS[(si + pi) % 10];
      for (const mode of ["demo", "model"] as const) {
        const idx = ++n;
        const id = `sensitive ${s.id} / ${PATH_LABEL[path]} / ${position} / ${goal} / ${mode}`;
        const hit = await draftWith(db, "sen", path, goal, s.text, position, mode, idx);
        report.cases++; report.runs++;
        const fail = (rule: string, detail: string, body = "") => report.failures.push({ id, rule, body, detail, kind: s.kind, path });
        if (hit.status !== 200) { fail("draft refused", `status ${hit.status}`); continue; }
        for (const b of hit.bodies) if (s.marker.test(b)) fail("sensitive detail in a draft", b.match(s.marker)![0], b);
        if (mode === "model" && s.marker.test(hit.seen)) fail("sensitive detail reached the model's evidence", hit.seen.match(s.marker)![0], hit.seen.slice(0, 200));
      }
      // The brief itself: cleaning the page and keeping grounded facts leaves nothing sensitive.
      if (position === "first" && path === "page_brief") {
        const page = `${s.text} ${BENIGN_PAGE}`;
        const cleaned = cleanBriefText(page);
        const facts = groundedBriefFacts([{ text: s.text, quote: s.text, source: "page", date: "" }, { text: BENIGN_PAGE, quote: BENIGN_PAGE, source: "page", date: "" }], [{ source: "page", text: page }]);
        report.cases++;
        const id = `sensitive ${s.id} / brief`;
        if (s.marker.test(cleaned)) report.failures.push({ id, rule: "sensitive detail kept by the brief cleaner", body: cleaned, detail: cleaned.match(s.marker)![0], kind: s.kind, path });
        if (facts.some(f => s.marker.test(f.text))) report.failures.push({ id, rule: "sensitive brief fact", body: facts.map(f => f.text).join(" | "), detail: "grounded fact", kind: s.kind, path });
      }
    }
  } finally { await pg.close(); }
  return report;
}

// ---------------------------------------------------------------------------------------------
// The 20 drafts a reader scores for "sounds like a person" and specificity
// ---------------------------------------------------------------------------------------------

export type SampleSpec = { kind: "first" | "step" | "selection"; goal: OutreachGoal; persona: number; relationship: Relationship; channel: Channel; variant?: Variant; step?: StepKind; use?: "reply" | "contact"; recipient: number; angleIndex: 0 | 1 };

/** Ten goals twice in first messages (14), three timeline steps, three selection uses. Fixed, so the scores stay attached. */
export const SAMPLE_SPECS: SampleSpec[] = [
  ...GOAL_IDS.map((goal, i): SampleSpec => ({ kind: "first", goal, persona: [0, 1, 4, 3, 5, 2, 5, 6, 5, 2][i], relationship: RELATIONSHIPS[i % 3], channel: (["linkedin_message", "email", "connection_note", "inmail"] as const)[i % 4], variant: (["lead_typed", "bare", "brief", "lead_tap"] as const)[i % 4], recipient: i, angleIndex: 0 })),
  { kind: "first", goal: "job", persona: 0, relationship: "alumni", channel: "linkedin_message", variant: "lead_tap", recipient: 2, angleIndex: 1 },
  { kind: "first", goal: "clients", persona: 5, relationship: "stranger", channel: "email", variant: "bare", recipient: 5, angleIndex: 1 },
  { kind: "first", goal: "buy_business", persona: 6, relationship: "stranger", channel: "connection_note", variant: "bare", recipient: 3, angleIndex: 1 },
  { kind: "first", goal: "reconnect", persona: 2, relationship: "knows_me", channel: "linkedin_message", variant: "lead_typed", recipient: 1, angleIndex: 1 },
  { kind: "step", goal: "job", persona: 0, relationship: "stranger", channel: "linkedin_message", step: "thank_you", recipient: 0, angleIndex: 0 },
  { kind: "step", goal: "network", persona: 4, relationship: "alumni", channel: "email", step: "follow_up", recipient: 5, angleIndex: 1 },
  { kind: "step", goal: "referral", persona: 1, relationship: "knows_me", channel: "linkedin_message", step: "referral_ask", recipient: 1, angleIndex: 0 },
  { kind: "selection", goal: "network", persona: 2, relationship: "stranger", channel: "linkedin_message", use: "reply", recipient: 0, angleIndex: 0 },
  { kind: "selection", goal: "partner", persona: 5, relationship: "stranger", channel: "linkedin_message", use: "contact", recipient: 1, angleIndex: 0 },
  { kind: "selection", goal: "mentor", persona: 3, relationship: "alumni", channel: "connection_note", use: "contact", recipient: 5, angleIndex: 0 },
];

export type Sample = { n: number; id: string; spec: SampleSpec; body: string; tells: string[]; verdict: string };

/** Rebuilds the 20 drafts the current engine writes for the fixed specs. */
export async function buildSamples(): Promise<Sample[]> {
  const out: Sample[] = [];
  const users = OUTREACH_PERSONAS.map((_, i) => `s${i}`);
  const { pg, db } = await freshDb(users);
  try {
    for (let i = 0; i < users.length; i++) await seedPersona(db, users[i], OUTREACH_PERSONAS[i]);
    for (const [i, spec] of SAMPLE_SPECS.entries()) {
      const persona = OUTREACH_PERSONAS[spec.persona], recipient = recipientAt(spec.recipient);
      let result: DraftResult;
      if (spec.kind === "step") {
        const { contactId, eventId } = await contactWithStep(db, users[spec.persona], { goal: spec.goal, relationship: spec.relationship, recipient, step: spec.step!, tag: "s" });
        result = outOf(await runDraft(db, users[spec.persona], { contactId, channel: spec.channel, eventId }, { mock: true }));
      } else {
        const base = firstMessageInput(spec.goal, persona, spec.relationship, spec.channel, spec.variant ?? "bare", recipient);
        const extra: EvidenceItem[] = spec.kind === "selection" ? selectionEvidence(SELECTIONS[spec.recipient % SELECTIONS.length], spec.use) : [];
        result = await generateOutreach({ ...base, extraEvidence: extra }, { mock: true });
      }
      const v = result.versions[Math.min(spec.angleIndex, result.versions.length - 1)];
      out.push({ n: i + 1, id: `${spec.kind}/${spec.goal}/${persona.id}/${spec.relationship}/${spec.channel}/${spec.step ?? spec.use ?? spec.variant ?? ""}/${v.angle}`, spec, body: v.body, tells: tellsOf(v.body), verdict: v.verdict });
    }
  } finally { await pg.close(); }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Reporting: which rule broke, where, and which lib function is the suspected cause
// ---------------------------------------------------------------------------------------------

/** "draft": the user would see it. "evidence": it reached what a model reads, but no shown draft carried it (defence in depth). */
export const levelOf = (rule: string): "draft" | "evidence" => (/reached the model/.test(rule) ? "evidence" : "draft");

export type Located = Failure & { path?: Path; kind?: string };
const PLANT_CAUSE = {
  selection: "lib/outreach/draft.ts cleanEvidenceText (with PLANTED) and lib/outreach/brief.ts cleanBriefText (INSTRUCTION) remove sentences by phrase list only, so a planted line phrased another way survives. composeDrafts (selectedLine) then quotes the first surviving sentence of the selection word for word. Fix in U3 (draft.ts) and U4 (brief.ts).",
  page: "lib/outreach/brief.ts cleanBriefText and groundedBriefFacts apply INSTRUCTION and SENSITIVE only, and runDraft (draft.ts, the brief cleaning before briefFacts) re-cleans with cleanBriefText only, so PLANTED (used by cleanEvidenceText) never runs on brief facts. composeDrafts then quotes the brief fact after `I noticed this about your work`. Fix in U4 (brief.ts) and U3 (runDraft).",
  evidence: "lib/outreach/draft.ts cleanEvidenceText and lib/outreach/brief.ts cleanBriefText remove sentences by phrase list only; the plant is still in the evidence pack a model reads. The guard and composer kept it out of the shown drafts in these cases. Fix in U3/U4 (a broader cleaner).",
};
export function suspectedCause(f: Located): string {
  const r = f.rule;
  if (r === "trace guard: recipient_claim") return "lib/outreach/draft.ts split(), the sentence splitter draftProblem uses, does not split after a closing quote, so the composer's own brief line `I noticed this about your work: \"...\".` is merged with the next sentence and the HOOK check reads the merged text against the recipient's words. composeDrafts output fails its own guard. Fix in U3: split on [.?!] followed by an optional closing quote.";
  if (r === "trace guard: grounding") return "lib/outreach/draft.ts draftProblem: the DID check (\"I/we built ...\") reads the recipient's words inside the quoted selection, `\"We cut warehouse costs ...\"`, as the user's own claim and finds no support in the user's facts. Strip quoted spans from the sentence before the DID check. Fix in U3.";
  if (/sensitive/.test(r)) return "lib/outreach/brief.ts SENSITIVE is a keyword list (religion, health, family, finance words). Everyday phrasing of the same topics (a wife expecting, a surgery, a mortgage, a party and an election, a son with autism, lost savings) does not match, and cleanBriefText keeps the sentence for the brief, selected text, notes and why-you-connected lines alike. R13 asks for zero. Fix in U4 (brief.ts SENSITIVE), which U3 cleanEvidenceText reuses.";
  if (/planted|intent|ask introduced|differs/.test(r)) return f.path === "page_brief" ? PLANT_CAUSE.page : PLANT_CAUSE.selection;
  return "See the rule and the draft.";
}
export function groupFailures(failures: Located[]): { rule: string; path?: Path; count: number; example: Located; cause: string }[] {
  const groups = new Map<string, { rule: string; path?: Path; count: number; example: Located; cause: string }>();
  for (const f of failures) {
    const key = `${f.rule}|${f.path ?? ""}|${f.kind ?? ""}`;
    const g = groups.get(key);
    if (g) g.count++;
    else groups.set(key, { rule: f.rule, path: f.path, count: 1, example: f, cause: levelOf(f.rule) === "evidence" ? PLANT_CAUSE.evidence : suspectedCause(f) });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}
/** The text a failing test prints: one block per rule and path with a count, an example draft and the suspected cause. */
export function formatFailures(failures: Located[]): string {
  if (!failures.length) return "none";
  const lines = ["Failures to fix before release:"];
  for (const g of groupFailures(failures)) {
    lines.push(`- ${g.count} x "${g.rule}"${g.path ? ` via ${PATH_LABEL[g.path]}` : ""}${g.example.kind ? ` (${g.example.kind} fixture)` : ""}`);
    lines.push(`    example: ${g.example.id}${g.example.detail ? ` [${g.example.detail}]` : ""}`);
    if (g.example.body) lines.push(`    draft: ${g.example.body.slice(0, 220)}`);
    lines.push(`    suspected cause: ${g.cause}`);
  }
  return lines.join("\n");
}

export { INJECTIONS, SENSITIVE, type Injection };
export { OUTREACH_PERSONAS };
