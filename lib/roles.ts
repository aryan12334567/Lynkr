/**
 * Role and domain knowledge pack (prod/lynkr-profile-fix-intelligence-plan.md §6,
 * prod/lynkr-outreach-intelligence-plan.md §8). A small, hand-curated, versioned
 * list of role patterns: no people, no scraped profiles. Every suggestion made from
 * it is shown to the user to confirm or change.
 */

export const DOMAINS = [
  "software",
  "data_ai",
  "product_design",
  "business",
  "finance",
  "core_engineering",
  "healthcare",
  "education_policy",
  "media_creative",
  "other",
  "mixed",
  "not_sure",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const DOMAIN_LABEL: Record<Domain, string> = {
  software: "Software and IT",
  data_ai: "Data, AI and analytics",
  product_design: "Product, design and research",
  business: "Business, sales and marketing",
  finance: "Finance, consulting and operations",
  core_engineering: "Core engineering and supply chain",
  healthcare: "Healthcare and life sciences",
  education_policy: "Education, policy and social impact",
  media_creative: "Media and creative work",
  other: "Other",
  mixed: "Mixed",
  not_sure: "Not sure yet",
};

export const STAGES = ["final_year", "recent_grad", "early_career", "switching", "other"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  final_year: "Final-year student",
  recent_grad: "Recent graduate",
  early_career: "0 to 2 years' experience",
  switching: "Changing fields",
  other: "Other / prefer not to say",
};
/** How the stage reads inside a sentence ("I'm a final-year student ..."). */
export const STAGE_PHRASE: Record<Stage, string> = {
  final_year: "a final-year student",
  recent_grad: "a recent graduate",
  early_career: "early in my career",
  switching: "moving into this field",
  other: "",
};

export const AUDIENCES = ["practitioners", "hiring", "peers", "alumni", "not_sure"] as const;
export type Audience = (typeof AUDIENCES)[number];
export const AUDIENCE_LABEL: Record<Audience, string> = {
  practitioners: "Practitioners in the field",
  hiring: "Hiring teams and recruiters",
  peers: "Peers and learners",
  alumni: "Alumni and community",
  not_sure: "Not sure",
};

/** What a role pattern says to look for on a profile, and who is worth reaching. */
export type RolePattern = {
  id: string;
  title: string;
  aliases: string[];
  domain: Domain;
  /** Skills and terms a recruiter for this role searches for. Starting points, not requirements. */
  terms: string[];
  /** The kind of proof that matters most for an early-career person in this role. */
  evidence: string;
  /** Kinds of people worth looking for, best bridge first. Never named individuals. */
  lookFor: { who: string; why: string; query: string }[];
};

export const PACK = {
  id: "lynkr-roles",
  version: "0.1",
  checkedAt: "2026-10-17",
  note:
    "Hand-curated starter set written for Lynkr. Role names were compared against public occupation references; they are not mapped code by code yet.",
  sources: [
    { name: "National Classification of Occupations 2015 (India)", url: "https://www.ncs.gov.in/documents/national%20classification%20of%20occupations%20_vol%20i-%202015.pdf" },
    { name: "NSDC National Occupational Standards", url: "https://www.nsdcindia.org/national-occupational-standards" },
    { name: "ESCO occupations and skills", url: "https://esco.ec.europa.eu/en/use-esco/use-esco-services-api" },
    { name: "O*NET database (US context)", url: "https://www.onetcenter.org/database.html" },
  ],
} as const;

export const ROLES: RolePattern[] = [
  {
    id: "data-analyst",
    title: "Data analyst",
    aliases: ["data analyst", "business analyst", "analytics", "bi analyst", "mis", "reporting analyst", "product analyst"],
    domain: "data_ai",
    terms: ["SQL", "Excel", "Power BI", "Tableau", "Python", "dashboards", "data cleaning", "statistics"],
    evidence: "A dashboard, analysis or report someone used, with the question it answered.",
    lookFor: [
      { who: "Analysts who joined in the last two years", why: "They remember the first-job hunt and can tell you what the work is really like.", query: "data analyst" },
      { who: "Analytics team leads", why: "They decide what a fresher's first project looks like.", query: "analytics manager" },
      { who: "People who post about SQL, dashboards or analysis", why: "Their posts give you a real, specific reason to write.", query: "data analyst SQL dashboard" },
    ],
  },
  {
    id: "data-scientist",
    title: "Data scientist / ML engineer",
    aliases: ["data scientist", "machine learning", "ml engineer", "ai engineer", "nlp", "computer vision", "deep learning"],
    domain: "data_ai",
    terms: ["Python", "machine learning", "statistics", "PyTorch", "scikit-learn", "model evaluation", "SQL", "experiments"],
    evidence: "A model or experiment with how you evaluated it, and what you would change.",
    lookFor: [
      { who: "ML engineers a year or two into the job", why: "They can say which projects actually helped them get hired.", query: "machine learning engineer" },
      { who: "People who write about model evaluation or deployment", why: "A specific post gives you a specific question.", query: "machine learning model evaluation" },
      { who: "Applied research or data science leads", why: "They know what the team needs from a junior hire.", query: "data science lead" },
    ],
  },
  {
    id: "platform-engineer",
    title: "Platform / AI infrastructure engineer",
    aliases: ["platform engineer", "devops", "sre", "site reliability", "infrastructure", "cloud engineer", "mlops", "ai infrastructure", "inference"],
    domain: "software",
    terms: ["Kubernetes", "Docker", "Linux", "CI/CD", "observability", "AWS", "GCP", "Terraform", "reliability"],
    evidence: "Something you deployed or kept running, and one trade-off you made.",
    lookFor: [
      { who: "Platform or infrastructure engineers", why: "They work on the systems you want to work on and can name what to learn next.", query: "platform engineer Kubernetes" },
      { who: "Maintainers of open-source tools you have used", why: "Using their project gives you a real, technical reason to write.", query: "open source maintainer infrastructure" },
      { who: "Speakers at cloud or DevOps meetups", why: "A talk you watched is a concrete thing to ask about.", query: "DevOps meetup speaker" },
    ],
  },
  {
    id: "software-engineer",
    title: "Software engineer",
    aliases: ["software engineer", "sde", "developer", "frontend", "backend", "full stack", "web developer", "android", "ios", "programmer"],
    domain: "software",
    terms: ["data structures", "JavaScript", "TypeScript", "React", "Java", "Python", "APIs", "Git", "testing"],
    evidence: "Something you built that runs, with a link and the part you wrote yourself.",
    lookFor: [
      { who: "Engineers who joined as freshers in the last two years", why: "They know which projects and prep actually mattered.", query: "software engineer" },
      { who: "Engineering managers on teams you want to join", why: "They decide what the team needs from a new hire.", query: "engineering manager" },
      { who: "People who write about the stack you use", why: "Their post gives you a specific technical question.", query: "software engineer React" },
    ],
  },
  {
    id: "product",
    title: "Product manager / analyst",
    aliases: ["product manager", "apm", "associate product manager", "product analyst", "product owner"],
    domain: "product_design",
    terms: ["user research", "metrics", "roadmap", "SQL", "experiments", "PRD", "prioritisation"],
    evidence: "A product decision you made or influenced, the user problem behind it, and what changed.",
    lookFor: [
      { who: "Associate product managers", why: "They took the same entry path you are trying.", query: "associate product manager" },
      { who: "Product leads at companies you use", why: "Your own use of their product is a real reason to write.", query: "product manager" },
      { who: "People who write product teardowns or case studies", why: "A case study gives you something concrete to respond to.", query: "product manager case study" },
    ],
  },
  {
    id: "designer",
    title: "UX / product designer",
    aliases: ["ux", "ui", "product designer", "interaction designer", "visual designer", "ux researcher"],
    domain: "product_design",
    terms: ["Figma", "user research", "prototyping", "usability testing", "design systems", "case studies"],
    evidence: "A case study: the problem, what you tried, what users did, what you changed.",
    lookFor: [
      { who: "Designers a year or two into the job", why: "They can say what made their portfolio work.", query: "product designer" },
      { who: "Design leads who review portfolios", why: "They know what a junior case study needs.", query: "design lead" },
      { who: "People who share design critiques", why: "A critique post gives you a specific question.", query: "UX case study" },
    ],
  },
  {
    id: "equity-research",
    title: "Equity research analyst",
    aliases: ["equity research", "research analyst", "investment research", "buy side", "sell side", "investment analyst"],
    domain: "finance",
    terms: ["financial modelling", "valuation", "Excel", "industry analysis", "earnings", "DCF", "report writing"],
    evidence: "A company or sector you analysed, the call you made, and how you checked it.",
    lookFor: [
      { who: "Equity research associates covering a sector you follow", why: "Their published notes give you a specific question.", query: "equity research associate" },
      { who: "Alumni working in research", why: "A shared college is a real reason for a short chat.", query: "equity research analyst alumni" },
      { who: "Early-career analysts who talk about the work", why: "They can describe the first year honestly.", query: "research analyst" },
    ],
  },
  {
    id: "fpa",
    title: "Finance / FP&A analyst",
    aliases: ["fp&a", "financial analyst", "finance analyst", "corporate finance", "accounting", "audit", "chartered accountant", "ca", "commerce", "b.com", "investment banking", "consulting", "operations"],
    domain: "finance",
    terms: ["Excel", "financial modelling", "budgeting", "forecasting", "variance analysis", "accounting", "PowerPoint"],
    evidence: "A model, budget or analysis you built, and the decision it supported.",
    lookFor: [
      { who: "FP&A or finance analysts at companies you want to join", why: "They do the exact work you are applying for.", query: "FP&A analyst" },
      { who: "Finance managers who hire juniors", why: "They know what the first-year work needs.", query: "finance manager" },
      { who: "Alumni in finance roles", why: "A shared college makes a short chat easy to say yes to.", query: "financial analyst alumni" },
    ],
  },
  {
    id: "credit-risk",
    title: "Credit / risk analyst",
    aliases: ["credit", "risk analyst", "credit research", "credit analyst", "underwriting", "risk"],
    domain: "finance",
    terms: ["credit analysis", "financial statements", "ratios", "Excel", "risk models", "industry research"],
    evidence: "A credit or risk assessment you did, with the ratios you checked and why.",
    lookFor: [
      { who: "Credit analysts who write about analysis", why: "Their posts give you a narrow question to ask.", query: "credit analyst" },
      { who: "Alumni in credit or risk teams", why: "A shared college is a real bridge.", query: "credit research alumni" },
      { who: "Recruiters for credit and risk roles", why: "They can tell you which openings are live.", query: "recruiter credit risk" },
    ],
  },
  {
    id: "sales-marketing",
    title: "Sales / marketing",
    aliases: ["sdr", "bdr", "sales", "business development", "marketing", "digital marketing", "growth", "content", "seo", "brand"],
    domain: "business",
    terms: ["outreach", "CRM", "campaigns", "SEO", "copywriting", "analytics", "lead generation", "communication"],
    evidence: "A campaign or outreach you ran, how many people it reached, and what you changed after.",
    lookFor: [
      { who: "SDRs and marketers who started in the last two years", why: "They can say what the first quarter is really like.", query: "sales development representative" },
      { who: "Sales or marketing managers who hire juniors", why: "They know what they look for in a fresher.", query: "marketing manager" },
      { who: "People who share campaign breakdowns", why: "A breakdown gives you something specific to ask about.", query: "growth marketing" },
    ],
  },
  {
    id: "core-engineering",
    title: "Core engineering",
    aliases: ["mechanical", "civil", "electrical", "electronics", "chemical", "production", "manufacturing", "supply chain", "design engineer", "embedded"],
    domain: "core_engineering",
    terms: ["CAD", "SolidWorks", "AutoCAD", "MATLAB", "quality", "lean", "testing", "project work"],
    evidence: "A project or internship task with a measurement: tolerances, cost, time or output.",
    lookFor: [
      { who: "Graduate engineer trainees from the last two years", why: "They went through the same campus or off-campus path.", query: "graduate engineer trainee" },
      { who: "Plant or design engineers in your branch", why: "They can describe what the work needs.", query: "design engineer" },
      { who: "Alumni in core companies", why: "A shared college is a real reason to write.", query: "engineer alumni" },
    ],
  },
  {
    id: "healthcare",
    title: "Healthcare / life sciences",
    aliases: ["pharma", "clinical", "biotech", "healthcare", "public health", "medical", "life sciences", "nursing", "lab"],
    domain: "healthcare",
    terms: ["clinical research", "GCP", "lab techniques", "data analysis", "regulatory", "documentation"],
    evidence: "A study, lab work or project and your part in it.",
    lookFor: [
      { who: "Clinical research associates early in their career", why: "They can explain the entry path.", query: "clinical research associate" },
      { who: "Alumni in pharma or healthcare companies", why: "A shared college is a real bridge.", query: "pharma alumni" },
      { who: "People who write about the field's work", why: "Their posts give you a specific question.", query: "life sciences" },
    ],
  },
];

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9&+./ ]/g, " ");

/** Best matching role pattern for a free-text target role, or null. */
export function matchRole(targetRole: string): RolePattern | null {
  const t = ` ${words(targetRole)} `;
  let best: { r: RolePattern; len: number } | null = null;
  for (const r of ROLES) {
    for (const a of r.aliases) {
      if (t.includes(` ${a} `)) {
        if (!best || a.length > best.len) best = { r, len: a.length };
      }
    }
  }
  return best?.r ?? null;
}

/** A suggestion only; the user confirms or changes it. Never inferred from anything but the role text. */
export function suggestDomain(targetRole: string): Domain {
  return matchRole(targetRole)?.domain ?? "not_sure";
}

/** Role terms (or, failing a match, the words of the role itself) used for keyword checks. */
export function roleTerms(targetRole: string): string[] {
  const r = matchRole(targetRole);
  return r ? r.terms : [];
}

/** Topic suggestions from the user's own confirmed facts: tools and named terms that also appear in the role pack. */
export function suggestTopics(targetRole: string, facts: string[]): string[] {
  const text = facts.join(" ").toLowerCase();
  const terms = [...roleTerms(targetRole), ...ROLES.flatMap((r) => r.terms)];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const k = term.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    if (new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) out.push(term);
    if (out.length >= 3) break;
  }
  return out;
}
