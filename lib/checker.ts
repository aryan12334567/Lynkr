/**
 * Message checker v2 (prod/lynkr-message-checker-outreach-build-plan.md §6).
 * Deterministic and local: no AI, no network. It separates advice (greeting,
 * easy out) from real problems (wrong channel length, a referral ask to a
 * stranger, claims you haven't confirmed), points at the exact words, and offers
 * the smallest edit. It never says a message will get a reply.
 */
import type { Channel, Intent } from "./schemas";

export type Relationship = "stranger" | "alumni" | "knows_me";

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  stranger: "A stranger",
  alumni: "Same college / alumni",
  knows_me: "Someone who knows me",
};

export const CHANNEL_RULES: Record<Channel, { label: string; unit: "chars" | "words"; max: number; note: string }> = {
  // 200 characters is the current Lynkr default for a note; check LinkedIn's live limit before relying on it.
  connection_note: { label: "Connection note", unit: "chars", max: 200, note: "LinkedIn invitation notes are short. Lynkr uses 200 characters; check your own limit." },
  linkedin_message: { label: "LinkedIn message", unit: "words", max: 90, note: "Busy people skim. Keep a first message under about 90 words." },
  inmail: { label: "InMail", unit: "words", max: 120, note: "A first InMail still reads best short." },
  email: { label: "Email", unit: "words", max: 150, note: "Email allows a little more, but one ask still matters." },
};

export type Severity = "block" | "fix" | "advice";

export type CheckItem = { ok: boolean; label: string; tip: string; severity: Severity };
/** A phrase to change: where it is, why, and a suggested replacement ("" removes it). */
export type Flag = { phrase: string; tip: string; severity: Severity; match?: string; index?: number; replacement?: string };

export type Verdict = "Looks ready for your review" | "Edit before sending" | "Do not send yet";

export type CheckResult = {
  verdict: Verdict;
  words: number;
  chars: number;
  isReferralAsk: boolean;
  checks: CheckItem[];
  flags: Flag[];
};

/** Optional context: what the user confirmed about this message and person. */
export type CheckContext = {
  channel?: Channel;
  intent?: Intent;
  /** Text of the Story Vault facts selected for this message. */
  facts?: string[];
  /** True when the user confirmed a real shared history (worked together, met, introduced, knows them). */
  sharedHistory?: boolean;
};

const BAD_PHRASES: { re: RegExp; phrase: string; tip: string; severity: Severity; replacement?: string }[] = [
  { re: /\bkindly revert\b/i, phrase: "kindly revert", tip: "Say what you want plainly.", severity: "fix", replacement: "would you be open to it?" },
  { re: /\burgent(ly)?\b|\basap\b/i, phrase: "urgent / ASAP", tip: "Your deadline is not their problem. Remove it.", severity: "fix", replacement: "" },
  { re: /\bplease do the needful\b/i, phrase: "do the needful", tip: "Name the exact thing you are asking for.", severity: "fix", replacement: "[[the exact thing you are asking for]]" },
  { re: /\bi (deserve|am entitled)\b/i, phrase: "I deserve", tip: "Entitled phrasing reads badly. Show fit instead.", severity: "fix" },
  { re: /\byou (must|have to|should) (refer|help)\b/i, phrase: "you must/should refer", tip: "Ask, don't instruct.", severity: "fix", replacement: "would you be comfortable to refer" },
  { re: /\bany (job|opening|role|vacancy|opportunity)\b/i, phrase: "any job / any opening", tip: "Name one role. \"Anything\" gives them work to do.", severity: "fix", replacement: "the [[role title]] role" },
  { re: /\bi hope this (message|email) finds you well\.?/i, phrase: "hope this finds you well", tip: "Filler. Start with who you are.", severity: "advice", replacement: "" },
  { re: /\b(sir|ma'?am)\b/i, phrase: "sir / ma'am", tip: "Use their first name.", severity: "advice", replacement: "[[their first name]]" },
  { re: /\b(thrilled|passionate|game[- ]changer|journey)\b/i, phrase: "stock words", tip: "Replace with a concrete fact.", severity: "advice" },
  { re: /\b(i (really )?admire your (profile|journey|work)|impressive profile|inspiring journey|i came across your profile)\b/i, phrase: "generic praise", tip: "Swap it for one specific thing they made or said.", severity: "fix", replacement: "[[one specific thing they posted or built]]" },
  { re: /\b(just following up|bumping this|gentle reminder|following up again)\b/i, phrase: "bumping", tip: "Add something new, or stop. One follow-up at most.", severity: "fix", replacement: "[[one new thing since you last wrote]]" },
  { re: /\+91[\s-]?\d{5}[\s-]?\d{5}\b|\b[6-9]\d{9}\b/, phrase: "phone number", tip: "Don't put your phone number in a first message unless you mean to share it.", severity: "fix", replacement: "" },
  { re: /\b(ctc|current salary|expected salary|aadhaar|pan card)\b/i, phrase: "private detail", tip: "Salary and ID details don't belong in outreach.", severity: "fix", replacement: "" },
];

/** An actual request for a referral, not a mention of the word ("I was referred to you by Maya"). */
const REFERRAL_ASK =
  /\b(please refer me|refer me\b|referring me|refer my (profile|resume|cv|application)|(could|would|can|will) you (please )?(refer|put in a referral)|(comfortable|open|willing) (to )?(refer|referring)|(ask|request)(ing)? (you )?for a referral|an? (internal )?referral (for|to|at))/i;
const JOB_ID = /\b(job|req|requisition|position)\s*(id|no\.?|number|#)\s*[:#-]?\s*[\w-]+|\bhttps?:\/\/\S+|\b(jr|req|r)[-_]?\d{3,}\b/i;
const RESUME = /\b(resume|résumé|cv)\b/i;
const EASY_OUT = /\b(no worries|no pressure|totally fine|completely understand|if (it'?s|this is) not (a fit|possible|a good time)|if you('re| are) not comfortable|feel free to (say no|ignore)|understand if)\b/i;
const FIT = /\b(i (built|made|led|worked|shipped|wrote|ran|did|have|used|interned|scored|reduced|increased|grew|compared|analysed|analyzed|designed|tested)|my (project|internship|work|class project)|because|i'?m (working|learning|building))\b/i;
const ASK = /\?|\bwould you\b|\bcould you\b|\bcan you\b|\bopen to\b|\bwilling to\b/i;
const FAMILIARITY =
  /\b(as we (discussed|spoke)|when we (met|spoke|talked)|(great|nice|lovely) (talking|meeting|speaking) (to|with) you|you (mentioned|told me|suggested)|our (call|chat|conversation)|thanks for (the|our) (call|chat|time))\b/i;

function greeting(text: string): { named: boolean; bareHi: boolean } {
  const first = text.trim().split(/\n/)[0].trim();
  const bareHi = /^(hi|hello|hey|hii+)[\s,.!]*$/i.test(first) || /^(hi|hello|hey)[\s,.!]*$/i.test(text.trim());
  const named = /^(?:[Hh]i|[Hh]ello|[Hh]ey|[Dd]ear)\s+(?!(?:[Ss]ir|[Mm]a'?am|[Tt]here|[Aa]ll|[Tt]eam)\b)[A-Z[]/.test(first);
  return { named, bareHi };
}

/** Numbers in the message that none of the selected facts contain. */
function unsupportedNumbers(text: string, facts: string[]): string[] {
  const inFacts = new Set(facts.join(" ").match(/\d[\d,.]*/g)?.map((n) => n.replace(/[,.]$/, "")) ?? []);
  // Ignore job IDs, links and years; those are checked elsewhere or are not claims.
  const stripped = text
    .replace(new RegExp(JOB_ID.source, "gi"), " ")
    .replace(/\b[A-Za-z]+[-_]\d+\b/g, " ")
    .replace(/\b(19|20)\d{2}\b/g, " ")
    .replace(/\b\d+[- ]?(minutes?|mins?|days?|weeks?)\b/gi, " ");
  const found = stripped.match(/\b\d[\d,.]*%?/g)?.map((n) => n.replace(/[,.]$/, "").replace(/%$/, "")) ?? [];
  return [...new Set(found.filter((n) => !inFacts.has(n)))];
}

export function checkMessage(text: string, rel: Relationship, ctx: CheckContext = {}): CheckResult {
  const t = text.trim();
  const words = t ? t.split(/\s+/).length : 0;
  const chars = t.length;
  const channel = ctx.channel ?? "linkedin_message";
  const rule = CHANNEL_RULES[channel];
  const isReferralAsk = REFERRAL_ASK.test(t) || ctx.intent === "referral";
  const g = greeting(t);
  // Count sentences that ask something, so "Would you ...?" is one ask, not two.
  const asks = t.split(/(?<=[.?!])\s+/).filter((s) => ASK.test(s)).length;
  const size = rule.unit === "chars" ? chars : words;
  const isNote = channel === "connection_note";
  const knowsThem = rel === "knows_me" || ctx.sharedHistory;

  const checks: CheckItem[] = [
    {
      ok: size > 0 && size <= rule.max,
      label: `${rule.label}: ${rule.max} ${rule.unit === "chars" ? "characters" : "words"} or fewer (${size})`,
      tip: rule.note,
      severity: rule.unit === "chars" ? "block" : "fix",
    },
    {
      ok: asks === 1 || (isNote && asks === 0),
      label: isNote ? "At most one ask" : "One clear ask",
      tip: asks === 0 ? "End with one question they can answer easily." : "Keep only your most important ask.",
      severity: "fix",
    },
    {
      ok: FIT.test(t),
      label: "Says who you are or what you did",
      tip: "Add one true thing you did, from your Story Vault.",
      severity: knowsThem ? "advice" : "fix",
    },
    // Advice only: a short note or a warm contact doesn't need these.
    { ok: g.named, label: "Greets them by name", tip: "\"Hi <first name>,\" reads warmer than a bare \"Hi\".", severity: "advice" },
  ];
  if (!isNote) {
    checks.push({ ok: EASY_OUT.test(t), label: "Leaves room to say no", tip: "Optional: a short \"no worries if not\" lowers the pressure.", severity: "advice" });
  }
  if (isReferralAsk && rel !== "stranger") {
    checks.push(
      { ok: JOB_ID.test(t), label: "Job ID or link included", tip: "Referrers need the exact job ID or link to submit you.", severity: "fix" },
      { ok: RESUME.test(t), label: "Mentions your resume", tip: "Say the resume is attached, or offer to send it.", severity: "fix" },
    );
  }

  const flags: Flag[] = [];
  for (const b of BAD_PHRASES) {
    const m = b.re.exec(t);
    if (m) flags.push({ phrase: b.phrase, tip: b.tip, severity: b.severity, match: m[0], index: m.index, replacement: b.replacement });
  }
  if (g.bareHi) flags.push({ phrase: "\"Hi\" on its own", tip: "Never send a bare greeting and wait. Put the whole message in one go.", severity: "block" });
  if (isReferralAsk && rel === "stranger") {
    const m = REFERRAL_ASK.exec(t);
    flags.push({
      phrase: "referral ask to a stranger",
      tip: "A referral spends their reputation on someone they don't know. Ask one specific question about their work first.",
      severity: "block",
      match: m?.[0],
      index: m?.index,
    });
  }
  const fam = FAMILIARITY.exec(t);
  if (fam && !knowsThem) {
    flags.push({
      phrase: "shared history you haven't confirmed",
      tip: "Only mention a call or meeting that happened. Lynkr can't check this, so it needs your confirmation in the person details.",
      severity: "block",
      match: fam[0],
      index: fam.index,
    });
  }
  if (ctx.facts && ctx.facts.length) {
    for (const n of unsupportedNumbers(t, ctx.facts)) {
      const i = t.indexOf(n);
      flags.push({
        phrase: `number not in your facts: ${n}`,
        tip: "This number isn't in the Story Vault facts you picked. Check it's true before sending.",
        severity: "fix",
        match: n,
        index: i,
      });
    }
  }

  const failedFix = checks.some((c) => !c.ok && c.severity !== "advice") || flags.some((f) => f.severity === "fix");
  const blocking = words === 0 || checks.some((c) => !c.ok && c.severity === "block") || flags.some((f) => f.severity === "block");
  const verdict: Verdict = blocking ? "Do not send yet" : failedFix ? "Edit before sending" : "Looks ready for your review";

  return { verdict, words, chars, isReferralAsk, checks, flags };
}

/** Apply one suggested edit: replace the flagged words with the suggestion and tidy spacing. */
export function applyFlag(text: string, f: Flag): string {
  if (f.match === undefined || f.index === undefined || f.replacement === undefined) return text;
  if (text.slice(f.index, f.index + f.match.length) !== f.match) return text;
  return (text.slice(0, f.index) + f.replacement + text.slice(f.index + f.match.length))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ ([,.?!])/g, "$1")
    .replace(/([?!])\./g, "$1")
    .trim();
}
