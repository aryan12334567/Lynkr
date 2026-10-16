/**
 * Rule-based check for an outreach or referral message. Deterministic, no AI:
 * it looks for what referrers say they need (job ID, resume, a stated fit,
 * one ask, an easy out) and flags phrases that get messages ignored.
 */
export type Relationship = "stranger" | "alumni" | "knows_me";

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  stranger: "A stranger",
  alumni: "Same college / alumni",
  knows_me: "Someone who knows me",
};

export type CheckItem = { ok: boolean; label: string; tip: string };
export type Flag = { phrase: string; tip: string };

export type CheckResult = {
  verdict: "Ready to send" | "Fix first" | "Don't send yet";
  words: number;
  isReferralAsk: boolean;
  checks: CheckItem[];
  flags: Flag[];
};

const MAX_WORDS = 90;

const BAD_PHRASES: { re: RegExp; phrase: string; tip: string }[] = [
  { re: /\bkindly revert\b/i, phrase: "kindly revert", tip: "Say what you want plainly, e.g. \"Would you be open to it?\"" },
  { re: /\burgent(ly)?\b|\basap\b/i, phrase: "urgent / ASAP", tip: "Your deadline is not their problem. Remove it." },
  { re: /\bplease do the needful\b/i, phrase: "do the needful", tip: "Name the exact thing you are asking for." },
  { re: /\bi (deserve|am entitled)\b/i, phrase: "I deserve", tip: "Entitled phrasing reads badly. Show fit instead." },
  { re: /\byou (must|have to|should) (refer|help)\b/i, phrase: "you must/should refer", tip: "Ask, don't instruct." },
  { re: /\bplease refer me\b/i, phrase: "please refer me", tip: "Give the job ID and why you fit, then ask if they'd be comfortable." },
  { re: /\bany (job|opening|role|vacancy|opportunity)\b/i, phrase: "any job / any opening", tip: "Name one role. \"Anything\" gives them work to do." },
  { re: /\b(i hope this (message|email) finds you well)\b/i, phrase: "hope this finds you well", tip: "Filler. Start with who you are." },
  { re: /\b(sir|ma'?am)\b/i, phrase: "sir / ma'am", tip: "Use their first name." },
  { re: /\b(thrilled|passionate|game[- ]changer|journey)\b/i, phrase: "stock words", tip: "Replace with a concrete fact." },
];

const JOB_ID = /\b(job|req|requisition|position)\s*(id|no\.?|number|#)\s*[:#-]?\s*\w+|\bhttps?:\/\/\S+|\b(jr|req|r)[-_]?\d{3,}\b/i;
const RESUME = /\b(resume|résumé|cv)\b/i;
const EASY_OUT = /\b(no worries|no pressure|totally fine|completely understand|if (it'?s|this is) not (a fit|possible)|if you('re| are) not comfortable|feel free to (say no|ignore)|understand if)\b/i;
const FIT = /\b(i (built|made|led|worked|shipped|wrote|ran|did|have|used|interned|scored|reduced|increased|grew)|my (project|internship|work)|because)\b/i;
const REFERRAL = /\brefer(ral|red|ring)?\b/i;
const ASK = /\?|\bwould you\b|\bcould you\b|\bcan you\b|\bopen to\b|\bwilling to\b/i;

function greeting(text: string): { named: boolean; bareHi: boolean } {
  const first = text.trim().split(/\n/)[0].trim();
  const bareHi = /^(hi|hello|hey|hii+)[\s,.!]*$/i.test(first) || /^(hi|hello|hey)[\s,.!]*$/i.test(text.trim());
  const named = /^(?:[Hh]i|[Hh]ello|[Hh]ey|[Dd]ear)\s+(?!(?:[Ss]ir|[Mm]a'?am|[Tt]here|[Aa]ll|[Tt]eam)\b)[A-Z[]/.test(first);
  return { named, bareHi };
}

export function checkMessage(text: string, rel: Relationship): CheckResult {
  const t = text.trim();
  const words = t ? t.split(/\s+/).length : 0;
  const isReferralAsk = REFERRAL.test(t);
  const g = greeting(t);
  // Count sentences that ask something, so "Would you ...?" is one ask, not two.
  const asks = t.split(/(?<=[.?!])\s+/).filter((s) => ASK.test(s)).length;

  const checks: CheckItem[] = [
    { ok: g.named, label: "Greets them by name", tip: "Start with \"Hi <first name>,\" not just \"Hi\"." },
    { ok: FIT.test(t), label: "Gives a specific reason you fit", tip: "Add one thing you built or did, with a number if you have one." },
    { ok: words > 0 && words <= MAX_WORDS, label: `${MAX_WORDS} words or fewer (${words})`, tip: "Cut it down. Busy people skim." },
    { ok: asks === 1, label: "One clear ask", tip: asks === 0 ? "End with one question they can answer yes or no." : "Keep only your most important ask." },
    { ok: EASY_OUT.test(t), label: "Gives them an easy way to say no", tip: "Add \"No worries if it's not a fit.\"" },
  ];
  if (isReferralAsk) {
    checks.push(
      { ok: JOB_ID.test(t), label: "Job ID or link included", tip: "Referrers need the exact job ID or link to submit you." },
      { ok: RESUME.test(t), label: "Mentions your resume", tip: "Say the resume is attached, or offer to send it." },
    );
  }

  const flags: Flag[] = BAD_PHRASES.filter((b) => b.re.test(t)).map(({ phrase, tip }) => ({ phrase, tip }));
  if (g.bareHi) flags.push({ phrase: "\"Hi\" on its own", tip: "Never send a bare greeting and wait. Put the whole message in one go." });
  if (isReferralAsk && rel === "stranger") {
    flags.push({
      phrase: "referral ask to a stranger",
      tip: "A referral spends their reputation. Ask a stranger one specific question first.",
    });
  }

  const failed = checks.filter((c) => !c.ok).length;
  const blocking = (isReferralAsk && rel === "stranger") || g.bareHi || words === 0;
  const verdict: CheckResult["verdict"] = blocking
    ? "Don't send yet"
    : failed === 0 && flags.length === 0
      ? "Ready to send"
      : "Fix first";

  return { verdict, words, isReferralAsk, checks, flags };
}
