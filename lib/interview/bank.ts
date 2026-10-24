import type { Bucket, FactKind } from "../schemas";

/**
 * The interview v2 question bank as typed data (build plan Part 1), from
 * research/interview-questions-draft.md. The server picks questions from here; the model
 * never chooses topics. Wording and examples can differ by bucket. Add the career switcher
 * and founder buckets later by giving questions those bucket ids.
 */

export type Tag = "core" | "sensitive" | "enrichment";

export const SECTIONS = ["now", "want", "proof", "people", "voice"] as const;
export type Section = (typeof SECTIONS)[number];
export const SECTION_LABEL: Record<Section, string> = {
  now: "Where you are now",
  want: "What you want",
  proof: "Your proof",
  people: "People you want to meet",
  voice: "How you sound and your time",
};

/** Which drafts an answer feeds. Questions that feed nothing aren't asked (design rule 7). */
export type Feed = "headline" | "about" | "profile_fix" | "outreach" | "referral" | "targets" | "connect" | "posts" | "tone" | "plan" | "privacy";

/** Structured fields in the context brief (chips or short text), as opposed to Story Vault facts. */
export type BriefField =
  | "currentRole"
  | "stageChip"
  | "field"
  | "goals"
  | "targetRoles"
  | "targetCompanies"
  | "mustHaves"
  | "privateSearch"
  | "whyNow"
  | "comfort"
  | "tone"
  | "weeklyTime"
  | "voiceSamples";

/** What makes an answer need a follow-up. "vague" is also judged by the model when one is configured. */
export type Trigger = "vague" | "we" | "no_number";

export type FollowUp = { when: Trigger; text: string };

type ByBucket<T> = T | Partial<Record<Bucket, T>> & { default: T };

export type Chips = { options: readonly string[]; multi?: boolean; /** Free text alongside the chips. */ withText?: boolean };

export type Question = {
  id: string;
  buckets: readonly Bucket[];
  section: Section;
  tag: Tag;
  text: ByBucket<string>;
  /** A labelled example answer. Inserting it means it must be edited before it can be saved. */
  example: ByBucket<string>;
  /** Stuck ladder, step 1: the same question asked a simpler way. */
  rephrase: ByBucket<string>;
  /** Stuck ladder, step 2: a few more examples to react to. */
  examples: ByBucket<readonly string[]>;
  feeds: readonly Feed[];
  brief?: BriefField;
  /** Free-text answers become Story Vault facts of this kind. */
  factKind?: FactKind;
  chips?: ByBucket<Chips>;
  followUps: readonly FollowUp[];
  /** Asked only when another answer sets it off (B4: a goal that sounds like a "should"). */
  triggeredBy?: "should";
  /** Filled from the profile import, so the question becomes "confirm or fix". */
  prefill?: "currentRole";
  /** Rough seconds to answer, for the time estimate and the 15-minute budget. */
  secs: number;
};

const ALL = ["fresher", "experienced", "networker"] as const satisfies readonly Bucket[];
const JOB = ["fresher", "experienced"] as const satisfies readonly Bucket[];

export const FIELD_CHIPS = [
  "Sales",
  "Marketing",
  "Software",
  "Data and analytics",
  "Finance",
  "Design",
  "Operations",
  "HR and recruiting",
  "Education",
  "Healthcare",
  "Other",
] as const;

export const WANT_CHIPS = ["A new job", "An internship", "Referrals", "Meeting people in my field", "A mentor", "Clients"] as const;
export const TIME_CHIPS = ["15 minutes", "30 minutes", "1 hour", "2 hours or more"] as const;

export const BANK: readonly Question[] = [
  // ---- A. Where you are now ----
  {
    id: "A1",
    buckets: ALL,
    section: "now",
    tag: "core",
    text: {
      default: "What's your current role, and roughly how many years have you done this kind of work?",
      fresher: "What are you studying, or what did you just finish, and when do you graduate?",
    },
    example: {
      default: "Inside sales lead at a SaaS company, about 6 years in sales.",
      fresher: "Final-year B.Com at a college in Pune, graduating in May 2027.",
    },
    rephrase: { default: "What's your job title today, and how long have you done this work?", fresher: "Which course and year are you in?" },
    examples: {
      default: ["Senior accountant, 4 years in audit and tax.", "Product designer at a fintech, 5 years."],
      fresher: ["B.Tech computer science, graduated in 2026.", "MBA marketing, final year, 2027."],
    },
    chips: { default: { options: ["3 to 5 years", "5 to 8 years", "8 to 12 years", "12 or more years"], withText: true }, fresher: { options: ["Final year", "Graduated in the last 2 years"], withText: true } },
    feeds: ["headline", "profile_fix", "outreach"],
    brief: "currentRole",
    prefill: "currentRole",
    followUps: [{ when: "vague", text: "What's the job title or course name, as it would appear on your profile?" }],
    secs: 40,
  },
  {
    id: "A2",
    buckets: ALL,
    section: "now",
    tag: "core",
    text: { default: "What do people at work come to you for?", fresher: "What do classmates or teammates come to you for?" },
    example: { default: "Untangling messy pipeline data before the Monday forecast call.", fresher: "Fixing everyone's Excel formulas before a submission." },
    rephrase: { default: "When a colleague is stuck, what do they ask you to help with?", fresher: "When a friend is stuck on a project, what do they ask you to help with?" },
    examples: { default: ["Writing the client email nobody else wants to write.", "Setting up dashboards for new managers."], fresher: ["Making the slides look clean before a presentation.", "Debugging Python assignments."] },
    feeds: ["headline", "about"],
    factKind: "contribution",
    followUps: [{ when: "vague", text: "Give me one example from the last few months." }],
    secs: 60,
  },
  {
    id: "A3",
    buckets: ALL,
    section: "now",
    tag: "core",
    text: "Which field best describes your work?",
    example: "Data and analytics",
    rephrase: "Pick the closest one. You can change it later.",
    examples: ["Software", "Marketing"],
    chips: { options: FIELD_CHIPS },
    feeds: ["profile_fix", "posts", "connect"],
    brief: "field",
    followUps: [],
    secs: 15,
  },

  // ---- B. What you want ----
  {
    id: "B1",
    buckets: ALL,
    section: "want",
    tag: "core",
    text: "What do you want LinkedIn to help with in the next 3 months?",
    example: { default: "A new job, and meeting a few people in fintech.", fresher: "An internship, and referrals at two or three companies.", networker: "Meeting people in my field, and maybe a mentor." },
    rephrase: "Pick what matters most right now. You can pick more than one.",
    examples: ["A new job and referrals.", "A mentor."],
    chips: { options: WANT_CHIPS, multi: true, withText: true },
    feeds: ["plan", "outreach"],
    brief: "goals",
    factKind: "goal",
    followUps: [],
    secs: 30,
  },
  {
    id: "B2",
    buckets: ALL,
    section: "want",
    tag: "core",
    text: {
      default: "What role are you aiming for next, and at what level?",
      fresher: "What role are you aiming for first?",
      networker: "What do you want to get out of meeting people: learning, a mentor, clients, or a future move?",
    },
    example: {
      default: "Sales manager at a B2B SaaS company, leading a small team.",
      fresher: "Data analyst, entry level.",
      networker: "Learn how other product teams run research, and find a mentor.",
    },
    rephrase: { default: "If you got an offer tomorrow, what would the job title say?", networker: "After a month of meeting people, what would make it worth it?" },
    examples: { default: ["Senior product designer.", "Finance manager at a startup."], fresher: ["Software engineer intern.", "Marketing associate."], networker: ["Two people I can ask for honest feedback.", "A couple of client leads."] },
    feeds: ["headline", "profile_fix", "outreach"],
    brief: "targetRoles",
    factKind: "goal",
    followUps: [{ when: "vague", text: "If you got an offer tomorrow, what would the job title say?" }],
    secs: 45,
  },
  {
    id: "B3",
    buckets: ALL,
    section: "want",
    tag: "core",
    text: {
      default: "Name 3 to 5 companies, or the kind of company, you'd like to work at.",
      networker: "Which companies, communities or kinds of people do you want to meet?",
    },
    example: { default: "Freshworks, Chargebee, or any Series B SaaS in Chennai.", fresher: "Fractal, Mu Sigma, or analytics teams at banks in Pune.", networker: "Product researchers at Bengaluru startups, and the Mixpanel community." },
    rephrase: { default: "Which company would you be happiest to hear from?", networker: "Whose work do you follow and wish you could talk to?" },
    examples: { default: ["Razorpay or any fintech in Bengaluru.", "Big 4 audit teams in Mumbai."], networker: ["Founders of D2C brands.", "Data leads at healthcare companies."] },
    feeds: ["referral", "targets", "connect"],
    brief: "targetCompanies",
    factKind: "target_company",
    followUps: [{ when: "vague", text: "What draws you to them?" }],
    secs: 60,
  },
  {
    id: "B4",
    buckets: ALL,
    section: "want",
    tag: "core",
    triggeredBy: "should",
    text: "If you didn't have to justify it to anyone, what would you actually want from your next move?",
    example: "Honestly, a smaller team where I can own a product end to end.",
    rephrase: "Forget what looks good on paper. What would make you happy to go to work?",
    examples: ["More time with customers, less time in spreadsheets.", "Working on something my family has heard of matters less than learning fast."],
    feeds: ["outreach", "targets"],
    factKind: "goal",
    followUps: [],
    secs: 60,
  },
  {
    id: "B5",
    buckets: ["experienced"],
    section: "want",
    tag: "sensitive",
    text: "What's making you look now?",
    example: "Growth: I've stopped learning in my current role.",
    rephrase: "Pick the closest reason, or skip.",
    examples: ["Relocation to Hyderabad.", "A layoff in my team."],
    chips: { options: ["Growth", "Pay", "Layoff", "Relocation", "Manager or team", "Prefer not to say"] },
    feeds: ["tone"],
    brief: "whyNow",
    followUps: [],
    secs: 15,
  },
  {
    id: "B6",
    buckets: JOB,
    section: "want",
    tag: "core",
    text: { default: "Any must-haves? Location, remote work, notice period.", fresher: "Any must-haves? Location, remote work, start date." },
    example: { default: "Bengaluru or remote, 60-day notice period.", fresher: "Pune or Mumbai, can start June 2027." },
    rephrase: "Anything that would make you say no to an offer?",
    examples: ["Remote only.", "Can't relocate before March."],
    feeds: ["targets", "referral"],
    brief: "mustHaves",
    factKind: "must_have",
    followUps: [],
    secs: 30,
  },
  {
    id: "B7",
    buckets: ["experienced"],
    section: "want",
    tag: "sensitive",
    text: "Does your current employer know you're looking?",
    example: "No, keep it private.",
    rephrase: "Should your posts avoid mentioning that you're looking?",
    examples: ["Yes, it's public.", "No, keep it private."],
    chips: { options: ["No, keep it private", "Yes, it's public"] },
    feeds: ["privacy", "posts"],
    brief: "privateSearch",
    followUps: [],
    secs: 10,
  },

  // ---- C. Your proof ----
  {
    id: "C1",
    buckets: ALL,
    section: "proof",
    tag: "core",
    text: {
      default: "Tell me about one piece of work you're proud of from the last 2 or 3 years. What was the situation, and what did you personally do?",
      fresher: "Tell me about one project, internship or task you're proud of. What was it, and what did you personally do?",
    },
    example: {
      default: "Our renewals were slipping, so I rebuilt the renewal call script and trained 4 reps on it.",
      fresher: "For our college fest I built a Power BI dashboard that tracked 40 sponsors, and I wrote the SQL myself.",
    },
    rephrase: "Pick one thing you did that you'd happily explain in an interview. What did you do?",
    examples: { default: ["I moved our month-end close from 8 days to 5 by automating two reconciliations.", "I redesigned the onboarding flow and ran the user tests myself."], fresher: ["I built a budgeting app for my hostel in Flutter.", "In my internship I cleaned 3 years of sales data for a report."] },
    feeds: ["headline", "about", "posts", "referral"],
    factKind: "project",
    followUps: [
      { when: "we", text: "Which part did you handle yourself?" },
      { when: "no_number", text: "Roughly how many people, hours or rupees did it touch? An estimate is fine, or say \"not measured\"." },
    ],
    secs: 120,
  },
  {
    id: "C1b",
    buckets: ALL,
    section: "proof",
    tag: "enrichment",
    text: "Another piece of work you're proud of? What did you do, and what changed?",
    example: { default: "I set up a weekly deal review that cut stalled deals by about a third.", fresher: "I led a team of 3 in a case competition and we reached the national round." },
    rephrase: "Any second example, even a small one?",
    examples: ["I wrote the team's first style guide.", "I mentored two interns through their first quarter."],
    feeds: ["posts", "about"],
    factKind: "project",
    followUps: [{ when: "we", text: "Which part did you handle yourself?" }],
    secs: 90,
  },
  {
    id: "C3",
    buckets: ["experienced", "networker"],
    section: "proof",
    tag: "enrichment",
    text: "Has anyone praised your work? A message, a review or an award.",
    example: "My manager wrote that my forecast model was the first one leadership trusted.",
    rephrase: "Any kind words from a manager, client or teammate you remember?",
    examples: ["Top performer award, Q2 2025.", "A client thanked us by name in their newsletter."],
    feeds: ["about", "profile_fix"],
    factKind: "evidence",
    followUps: [],
    secs: 45,
  },
  {
    id: "C4",
    buckets: ALL,
    section: "proof",
    tag: "enrichment",
    text: "Anything you can show publicly? A deck, case study, article, code or certificate.",
    example: { default: "A public case study on our website about the renewal project.", fresher: "My dashboard is on GitHub, and I have the Google Data Analytics certificate." },
    rephrase: "Is there a link someone could open to see your work?",
    examples: ["A Medium article on pricing tests.", "A Kaggle notebook."],
    feeds: ["profile_fix", "about"],
    factKind: "evidence",
    followUps: [],
    secs: 30,
  },
  {
    id: "C6",
    buckets: ["fresher"],
    section: "proof",
    tag: "enrichment",
    text: "What did you learn or notice doing that work that someone in your target field would care about?",
    example: "Check row counts before trusting any chart: two of our sponsor totals were double counted.",
    rephrase: "What would you tell a junior about to do the same project?",
    examples: ["Clean data takes longer than the analysis.", "Users never read the instructions page."],
    feeds: ["posts"],
    factKind: "learning",
    followUps: [],
    secs: 45,
  },
  {
    id: "C5",
    buckets: JOB,
    section: "proof",
    tag: "sensitive",
    text: { default: "Any gaps or changes in your career you'd like help explaining?", fresher: "Any gaps, backlogs or changes of course you'd like help explaining?" },
    example: { default: "A 1-year break in 2023 to care for a parent.", fresher: "A gap year in 2024 preparing for CAT." },
    rephrase: "Anything in your timeline you'd want to explain well? Skip if not.",
    examples: ["Switched from engineering to marketing.", "Two short jobs in a row."],
    feeds: ["profile_fix"],
    factKind: "constraint",
    followUps: [],
    secs: 30,
  },

  // ---- D. People you want to meet ----
  {
    id: "D1",
    buckets: ALL,
    section: "people",
    tag: "core",
    text: "Who would you most like to talk to in the next month?",
    example: { default: "Sales leaders at fintech companies in Bengaluru.", fresher: "Analysts who joined Fractal in the last two years.", networker: "Researchers at product startups in Bengaluru." },
    rephrase: "What kind of person, if they replied, would make your week?",
    examples: ["Hiring managers at my target companies.", "Alumni from my college in data roles.", "Founders of early-stage startups."],
    chips: { options: ["Hiring managers at my target companies", "People in my target role", "Alumni", "Seniors in my field", "Founders"], multi: true, withText: true },
    feeds: ["connect", "outreach"],
    factKind: "target",
    followUps: [],
    secs: 40,
  },
  {
    id: "D2",
    buckets: ALL,
    section: "people",
    tag: "core",
    text: "Where do you already have a way in? College, past companies, communities or groups.",
    example: { default: "Ex-colleagues from Zoho, and my IIM Indore alumni group.", fresher: "My college's alumni WhatsApp group and two seniors at Deloitte." },
    rephrase: "Who would recognise your name if you messaged them?",
    examples: ["A SaaS sales community on Slack.", "My old manager who moved to Freshworks."],
    feeds: ["outreach", "referral", "connect"],
    factKind: "warm_path",
    followUps: [{ when: "vague", text: "Name one group or person you could message this week." }],
    secs: 45,
  },
  {
    id: "D3",
    buckets: ALL,
    section: "people",
    tag: "core",
    text: "What could you offer someone you reach out to? A perspective, feedback, a resource, or a referral of your own.",
    example: { default: "Honest feedback on outbound scripts: I've reviewed hundreds.", fresher: "A fresher's view of their product: I've used it for two years as a student." },
    rephrase: "What do you know that someone two years behind you doesn't?",
    examples: ["A list of good free SQL courses.", "Feedback on their app from a real user."],
    feeds: ["outreach", "connect"],
    factKind: "offer",
    followUps: [{ when: "vague", text: "What do you know that someone two years behind you doesn't?" }],
    secs: 45,
  },
  {
    id: "D4",
    buckets: ALL,
    section: "people",
    tag: "enrichment",
    text: "How comfortable are you reaching out to strangers, and what usually stops you?",
    example: "About 2 out of 5. I don't know what to say.",
    rephrase: "Pick what usually stops you, if anything.",
    examples: ["Feel like I'm bothering them.", "Fear of being ignored."],
    chips: { options: ["Don't know what to say", "Feel like I'm bothering them", "Fear of being ignored", "Don't know who to contact"], multi: true, withText: true },
    feeds: ["tone", "connect"],
    brief: "comfort",
    followUps: [],
    secs: 20,
  },

  // ---- E. How you sound and how much time you have ----
  {
    id: "E1",
    buckets: ALL,
    section: "voice",
    tag: "enrichment",
    text: "What could you talk about for an hour without notes?",
    example: "Why most sales forecasts are wrong, and the three questions I ask to fix them.",
    rephrase: "What do friends get tired of hearing you talk about at work?",
    examples: ["Cricket analytics.", "Why onboarding emails don't work."],
    feeds: ["posts"],
    factKind: "opinion",
    followUps: [],
    secs: 40,
  },
  {
    id: "E2",
    buckets: ["experienced", "networker"],
    section: "voice",
    tag: "enrichment",
    text: "Paste 1 to 3 posts or messages you've written that sound like you.",
    example: "Paste a message or post you wrote here.",
    rephrase: "Any message you wrote recently that you were happy with?",
    examples: ["A Slack update to your team.", "A short LinkedIn post."],
    feeds: ["tone", "posts"],
    brief: "voiceSamples",
    followUps: [],
    secs: 45,
  },
  {
    id: "E3",
    buckets: ALL,
    section: "voice",
    tag: "enrichment",
    text: "How should your drafts sound?",
    example: "Plain and direct",
    rephrase: "Pick the closest tone.",
    examples: ["Warm", "A little witty"],
    chips: { options: ["Plain and direct", "Warm", "A little witty"] },
    feeds: ["tone"],
    brief: "tone",
    followUps: [],
    secs: 10,
  },
  {
    id: "E4",
    buckets: ALL,
    section: "voice",
    tag: "core",
    text: "How much time can you give this each week?",
    example: "30 minutes",
    rephrase: "Be honest: what fits a normal week?",
    examples: ["15 minutes", "1 hour"],
    chips: { options: TIME_CHIPS },
    feeds: ["plan"],
    brief: "weeklyTime",
    followUps: [],
    secs: 10,
  },
];

/** Resolve a per-bucket value. */
export function pick<T>(v: ByBucket<T>, bucket: Bucket): T {
  if (v !== null && typeof v === "object" && !Array.isArray(v) && "default" in (v as object)) {
    const m = v as Partial<Record<Bucket, T>> & { default: T };
    return m[bucket] ?? m.default;
  }
  return v as T;
}

export function questionsFor(bucket: Bucket): Question[] {
  return BANK.filter((q) => q.buckets.includes(bucket));
}

export function byId(id: string): Question | undefined {
  return BANK.find((q) => q.id === id);
}
