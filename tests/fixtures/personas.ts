// Five made-up personas: the fixed regression set for interview v2 (build plan gap 9).
// Re-run tests/personas.test.mts (demo mode) and scripts/eval-personas.mts (real model) whenever a prompt changes.
// No real people: names are invented; companies, colleges and communities are only context.
import type { FactKind } from "../../lib/schemas";
import type { AnswerInput, AskStep, Brief } from "../../lib/interview/engine";

export type Persona = {
  id: string;
  bucket: "fresher" | "experienced" | "networker";
  name: string;
  summary: string;
  /**
   * Answers by question id. A string answers the main question. An array is used in order,
   * one element each time the engine asks that question: [main, follow-up 1, follow-up 2], or
   * ["__PARK__", answer on the revisit, ...].
   */
  answers: Record<string, string | string[]>;
  expectFacts: { kind: FactKind; includes: string }[];
  expectBrief: Partial<Brief>;
};

export const PARK = "__PARK__";
export const SKIP = "__SKIP__";
export const LATER = "__LATER__";

export const PERSONAS: Persona[] = [
  {
    id: "fresher-pune-analyst",
    bucket: "fresher",
    name: "Meera (made up)",
    summary: "Final-year B.Com in Pune aiming for a data analyst internship; skips the sensitive gaps question.",
    answers: {
      A1: "Final year, B.Com (Honours) at Symbiosis College Pune, graduating in May 2027",
      A2: "Cleaning up messy attendance and marks sheets in Excel for our class committee",
      A3: "Data and analytics",
      B1: "An internship, Referrals. Mainly analytics teams in Pune",
      B2: "Junior data analyst or analytics intern, entry level",
      B3: "Fractal Analytics, ZS Associates, or analytics teams at Bajaj Finserv in Pune",
      B6: "Pune only for now, can start full time in June 2027",
      C1: "For our commerce fest I built an Excel and Power BI tracker for 25 stall sponsors and wrote all the formulas myself",
      C1b: LATER,
      C4: "The Power BI file is on my GitHub, and I finished the Google Data Analytics certificate in 2026",
      C6: "Sponsor totals looked wrong until I found duplicate rows, so now I always check row counts before charting",
      C5: SKIP,
      D1: "Alumni, People in my target role. Especially analysts at Fractal",
      D2: "My college alumni group on LinkedIn and two seniors now working at ZS Associates",
      D3: "A student's view of their dashboards, and a list of free Power BI practice datasets I collected",
      D4: "Don't know what to say, Fear of being ignored",
      E1: "How small college clubs can use basic dashboards to track their money",
      E3: "Plain and direct",
      E4: "30 minutes",
    },
    expectFacts: [
      { kind: "contribution", includes: "attendance" },
      { kind: "goal", includes: "data analyst" },
      { kind: "target_company", includes: "Fractal" },
      { kind: "must_have", includes: "Pune" },
      { kind: "project", includes: "Power BI tracker" },
      { kind: "learning", includes: "duplicate rows" },
      { kind: "warm_path", includes: "alumni group" },
      { kind: "offer", includes: "practice datasets" },
    ],
    expectBrief: { field: "data_ai", goals: ["internship", "referral"], weeklyTime: "30m", privateSearch: true },
  },
  {
    id: "fresher-hyd-engineer",
    bucket: "fresher",
    name: "Karthik (made up)",
    summary: "CS graduate in Hyderabad; a 'should' goal triggers B4; parks D2 and answers it on the revisit.",
    answers: {
      A1: "B.Tech computer science at CBIT Hyderabad, graduated in 2026",
      A2: "Friends ask me to debug their Java and Python assignments before deadlines",
      A3: "Software",
      B1: "A new job, Referrals. Backend roles",
      B2: "I should go for a stable MNC job like a software engineer role at a service company",
      B3: "TCS or Infosys because my family likes them, but also startups like Swiggy",
      B4: "Honestly I want to build backend systems at a product startup where I can learn fast",
      B6: "Hyderabad or Bengaluru, can join immediately",
      C1: "I built a hostel mess feedback app in Flutter and Firebase that about 300 students used each week",
      C1b: "In my internship at a logistics startup I wrote the API that lets drivers upload delivery photos",
      C4: LATER,
      C6: "Students only give feedback when it takes under ten seconds, so I cut the form to two taps",
      C5: "A one-semester backlog in Data Structures that I cleared in 2025",
      D1: "Founders, People in my target role. Backend engineers at Hyderabad startups",
      D2: [PARK, "Two seniors from my college coding club who now work at Swiggy and Zepto"],
      D3: "Honest feedback on their app from a real student user, and help testing new features",
      D4: LATER,
      E1: "Why most student apps die after the first month",
      E3: "A little witty",
      E4: "1 hour",
    },
    expectFacts: [
      { kind: "goal", includes: "product startup" },
      { kind: "target_company", includes: "Swiggy" },
      { kind: "constraint", includes: "backlog" },
      { kind: "warm_path", includes: "coding club" },
      { kind: "project", includes: "feedback app" },
      { kind: "offer", includes: "student user" },
    ],
    expectBrief: { field: "software", goals: ["job", "referral"], weeklyTime: "1h", privateSearch: true },
  },
  {
    id: "exp-chennai-sales",
    bucket: "experienced",
    name: "Lakshmi (made up)",
    summary: "Inside sales lead, 6 years, Chennai; C1 says 'we' with no number, so both follow-ups run, including an estimate.",
    answers: {
      A1: "Inside sales lead at a SaaS company in Chennai, 6 years in B2B sales",
      A2: "Rewriting cold call scripts when reps keep getting stuck on the same objection",
      A3: "Sales",
      B1: "A new job, Referrals. Sales leadership roles in SaaS",
      B2: "Sales manager at a B2B SaaS company, leading a team of eight reps",
      B3: "Freshworks, Chargebee, Kissflow, or a Series B SaaS company in Chennai",
      B5: "Growth",
      B6: "Chennai or remote, 60-day notice period",
      B7: "Yes, it's public",
      C1: [
        "We rebuilt the renewal call script for the inside sales team and changed how the team handled pricing objections",
        "I wrote the pricing objection section and coached the reps through role plays",
        "About 40 renewal calls a week used the new script",
      ],
      C1b: "I started a Friday pipeline review that helped two junior reps close their first enterprise deals",
      C3: "My director wrote that my renewal playbook was the first one the whole region adopted",
      C4: LATER,
      C5: SKIP,
      D1: "Hiring managers at my target companies, Seniors in my field. VP Sales at Chennai SaaS firms",
      D2: "Ex-colleagues from Zoho and the SaaSBoomi Chennai community",
      D3: "Feedback on outbound scripts and objection handling from six years on the phones",
      D4: "Feel like I'm bothering them",
      E1: "Why renewal calls fail when reps lead with discounts",
      E2: LATER,
      E3: "Plain and direct",
      E4: "30 minutes",
    },
    expectFacts: [
      { kind: "project", includes: "renewal call script" },
      { kind: "contribution", includes: "pricing objection" },
      { kind: "evidence", includes: "(estimate)" },
      { kind: "target_company", includes: "Freshworks" },
      { kind: "must_have", includes: "Chennai" },
      { kind: "warm_path", includes: "Zoho" },
      { kind: "offer", includes: "outbound scripts" },
      { kind: "evidence", includes: "renewal playbook" },
    ],
    expectBrief: { field: "business", goals: ["job", "referral"], privateSearch: false, whyNow: "Growth", weeklyTime: "30m" },
  },
  {
    id: "exp-blr-designer",
    bucket: "experienced",
    name: "Arjun (made up)",
    summary: "Senior product designer in Bengaluru; skips the sensitive B5 and B7 (search stays private); parks D3, then answers it.",
    answers: {
      A1: "Senior product designer at a fintech in Bengaluru, 5 years in product design",
      A2: "Turning messy research notes into clear flows the engineers can build from",
      A3: "Design",
      B1: "A new job. Design lead roles at consumer apps",
      B2: "Lead product designer at a consumer fintech or health app",
      B3: "CRED, Zerodha, or Practo, mostly design-led teams in Bengaluru",
      B5: SKIP,
      B6: "Bengaluru or hybrid, 90-day notice period",
      B7: SKIP,
      C1: "I redesigned the loan application flow and ran the usability tests myself, and drop-offs fell by 18 percent",
      C1b: "I built the team's first design system in Figma with 60 components",
      C3: LATER,
      C4: "A public case study on Medium about the loan flow redesign",
      C5: SKIP,
      D1: "People in my target role, Seniors in my field. Design leads at consumer apps",
      D2: "My NID alumni network and the Bangalore UX meetup group",
      D3: [PARK, "Portfolio reviews for junior designers; I have mentored four of them through their first job"],
      D4: "Don't know who to contact",
      E1: "Why fintech onboarding asks for too much too early",
      E2: "Last week I posted about cutting a 9-screen form to 4 screens and what we learned from it",
      E3: "Warm",
      E4: "1 hour",
    },
    expectFacts: [
      { kind: "project", includes: "loan application flow" },
      { kind: "project", includes: "design system" },
      { kind: "evidence", includes: "case study" },
      { kind: "offer", includes: "Portfolio reviews" },
      { kind: "warm_path", includes: "NID" },
      { kind: "target_company", includes: "Zerodha" },
    ],
    expectBrief: { field: "product_design", goals: ["job"], privateSearch: true, whyNow: "", weeklyTime: "1h" },
  },
  {
    id: "net-data-engineer",
    bucket: "networker",
    name: "Farah (made up)",
    summary: "Data engineer in Gurugram, not job hunting; wants a mentor and a community.",
    answers: {
      A1: "Data engineer at a logistics company in Gurugram, 4 years building pipelines",
      A2: "Fixing broken Airflow jobs at night when the reports don't refresh",
      A3: "Data and analytics",
      B1: "Meeting people in my field, A mentor. Also the dbt community",
      B2: "A mentor who has led a data platform team, and peers to compare notes with",
      B3: "Data platform leads at Indian startups, and the dbt and DataTalks communities",
      C1: "I moved our nightly batch from cron scripts to Airflow and cut failed runs from about 20 a month to 3",
      C1b: LATER,
      C3: "Our CTO called my pipeline runbook the clearest document on the team",
      C4: "A GitHub repo with my Airflow testing templates",
      D1: "Seniors in my field, Founders. Data platform leads",
      D2: "The dbt India Slack and my ex-manager who now runs data at a fintech",
      D3: "Practical Airflow testing tips and templates that save on-call time",
      D4: "Fear of being ignored",
      E1: "How to make data pipelines boring and reliable",
      E2: LATER,
      E3: "Plain and direct",
      E4: "15 minutes",
    },
    expectFacts: [
      { kind: "goal", includes: "mentor" },
      { kind: "target_company", includes: "dbt" },
      { kind: "project", includes: "Airflow" },
      { kind: "warm_path", includes: "dbt India Slack" },
      { kind: "offer", includes: "Airflow testing" },
      { kind: "evidence", includes: "runbook" },
    ],
    expectBrief: { field: "data_ai", goals: ["network", "mentor"], weeklyTime: "15m", privateSearch: true },
  },
];

/**
 * Answers the engine's questions from a persona, strictly: each array element is used once, and a
 * question asked more often than the persona planned for throws, so an unexpected follow-up shows up.
 */
export function chooser(p: Persona): (step: AskStep) => AnswerInput {
  const used: Record<string, number> = {};
  return (step) => {
    const v = p.answers[step.qid];
    if (v === undefined) throw new Error(`${p.id}: no answer for ${step.qid} (attempt ${step.attempt})`);
    const i = used[step.qid] ?? 0;
    used[step.qid] = i + 1;
    const raw = Array.isArray(v) ? v[i] : i === 0 ? v : undefined;
    if (raw === undefined) throw new Error(`${p.id}: ${step.qid} asked again (attempt ${step.attempt}, trigger ${step.trigger ?? "none"}, revisit ${step.revisit}) with no answer planned`);
    if (raw === PARK) return { qid: step.qid, attempt: step.attempt, status: "parked", text: "", round: step.revisit ? 2 : 1 };
    if (raw === SKIP) return { qid: step.qid, attempt: step.attempt, status: "skipped", text: "" };
    if (raw === LATER) return { qid: step.qid, attempt: step.attempt, status: "later", text: "" };
    return { qid: step.qid, attempt: step.attempt, status: "answered", text: raw, ...(step.trigger ? { trigger: step.trigger } : {}) };
  };
}

/** Rough seconds an ask takes: the question's estimate, half for a follow-up, 5 for skip, park or later. */
export function secsFor(qSecs: number, step: AskStep, input: AnswerInput): number {
  if (input.status !== "answered") return 5;
  return step.attempt > 0 ? Math.round(qSecs / 2) : qSecs;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Same matching in the unit test and the real-model eval: a fact of that kind whose text includes the string. */
export function expectedFound(p: Persona, facts: { kind: FactKind; text: string }[]): { found: number; missing: string[] } {
  const missing = p.expectFacts.filter((e) => !facts.some((f) => f.kind === e.kind && norm(f.text).includes(norm(e.includes)))).map((e) => `${e.kind}:${e.includes}`);
  return { found: p.expectFacts.length - missing.length, missing };
}
