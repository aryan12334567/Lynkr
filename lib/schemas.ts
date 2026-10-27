import { z } from "zod";
import { AUDIENCES, DOMAINS, STAGES } from "./roles";

export const GOALS = ["job", "internship", "referral", "network"] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_LABEL: Record<Goal, string> = {
  job: "A full-time job",
  internship: "An internship",
  referral: "A referral at a specific company",
  network: "To meet people in my field",
};

/** Who the interview is for. The first three are built; the last two come later (build plan, decision 2). */
export const BUCKETS = ["fresher", "experienced", "networker", "switcher", "founder"] as const;
export type Bucket = (typeof BUCKETS)[number];
export const ACTIVE_BUCKETS = ["fresher", "experienced", "networker"] as const satisfies readonly Bucket[];

export const BUCKET_LABEL: Record<Bucket, string> = {
  fresher: "I'm a student or recent graduate looking for my first job or internship",
  experienced: "I have a few years of experience and want my next job",
  networker: "I want to meet people in my field (not job hunting right now)",
  switcher: "I'm changing careers",
  founder: "I'm a founder or freelancer",
};

/** What someone wants LinkedIn to help with (more than one allowed). */
export const WANTS = ["job", "internship", "referral", "network", "mentor", "clients"] as const;
export type Want = (typeof WANTS)[number];
export const WANT_LABEL: Record<Want, string> = {
  job: "A new job",
  internship: "An internship",
  referral: "Referrals",
  network: "Meeting people in my field",
  mentor: "A mentor",
  clients: "Clients",
};

export const WEEKLY_TIMES = ["15m", "30m", "1h", "2h"] as const;
export type WeeklyTime = (typeof WEEKLY_TIMES)[number];
export const WEEKLY_TIME_LABEL: Record<WeeklyTime, string> = { "15m": "15 minutes", "30m": "30 minutes", "1h": "1 hour", "2h": "2 hours or more" };

// ---- request bodies (validated on the server) ----

/**
 * Setup plus the content profile (prod plans: profile fix §3, posts §3.1).
 * Function domain, industry, stage, market and readers are separate fields;
 * the domain is only a suggestion until domainConfirmed is true.
 */
export const ProfileInput = z.object({
  goal: z.enum(GOALS),
  targetRole: z.string().trim().min(2).max(120),
  background: z.string().trim().min(2).max(400),
  currentProfile: z.string().trim().max(4000).default(""),
  domain: z.enum(DOMAINS).default("not_sure"),
  domainConfirmed: z.boolean().default(false),
  specialization: z.string().trim().max(80).default(""),
  industry: z.string().trim().max(80).default(""),
  stage: z.enum(STAGES).default("other"),
  market: z.string().trim().max(80).default(""),
  audiences: z.array(z.enum(AUDIENCES)).max(2).default([]),
  topics: z.array(z.string().trim().min(1).max(40)).max(3).default([]),
  keepPrivate: z.string().trim().max(200).default(""),
  // Interview v2 (build plan Part 1). Optional with defaults, so saves from older versions still load.
  bucket: z.enum(BUCKETS).default("fresher"),
  goals: z.array(z.enum(WANTS)).max(WANTS.length).default([]),
  mustHaves: z.string().trim().max(300).default(""),
  /** True unless the person said their search is public. A skipped question stays private. */
  privateSearch: z.boolean().default(true),
  weeklyTime: z.enum(WEEKLY_TIMES).default("30m"),
});
export type ProfileInput = z.infer<typeof ProfileInput>;

export const Turn = z.object({
  q: z.string().trim().min(1).max(500),
  a: z.string().trim().min(1).max(1500),
});
export type Turn = z.infer<typeof Turn>;

export const InterviewRequest = z.object({
  profile: ProfileInput,
  turns: z.array(Turn).max(12),
});

// ---- Story Vault: candidate facts the user reviews before any drafting ----

export const FACT_KINDS = [
  "project",
  "contribution",
  "challenge",
  "evidence",
  "learning",
  "opinion",
  "constraint",
  "target",
  // Interview v2
  "goal",
  "target_company",
  "warm_path",
  "offer",
  "must_have",
] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const FACT_KIND_LABEL: Record<FactKind, string> = {
  project: "Project",
  contribution: "Your part",
  challenge: "Challenge or decision",
  evidence: "Result or proof",
  learning: "What you learned",
  opinion: "Your observation",
  constraint: "Constraint",
  target: "Who you want to reach",
  goal: "What you want",
  target_company: "Companies you're aiming for",
  warm_path: "A way in you already have",
  offer: "What you can offer",
  must_have: "Must-have",
};

/** Kinds that only ever go into private outreach, never a headline, About or post. */
export const OUTREACH_ONLY_KINDS: readonly FactKind[] = ["target", "goal", "target_company", "warm_path", "must_have"];

/**
 * How solid a fact is, worked out from the answer itself: is there a concrete example,
 * a number (measured, or an estimate the person labelled), and a clear "I did"?
 */
export type FactConfidence = { example: boolean; number: "measured" | "estimate" | "none"; iDid: boolean };

export type ReviewStatus = "candidate" | "confirmed" | "excluded";

export type StoryFact = {
  id: string;
  kind: FactKind;
  text: string;
  /** 1-based interview answer numbers this fact came from; empty means the setup form. */
  sourceTurnIds: number[];
  reviewStatus: ReviewStatus;
  useInDrafts: boolean;
  /** Interview v2: the question the fact came from, and how solid it is. Absent on older saves. */
  sourceQid?: string;
  confidence?: FactConfidence;
  /** Last change, for "newest edit wins" when browser and account copies differ. */
  updatedAt?: string;
};

export const VaultRequest = z.object({
  profile: ProfileInput,
  turns: z.array(Turn).min(1).max(12),
});

export const VaultReply = z.object({
  facts: z.array(
    z.object({
      kind: z.enum(FACT_KINDS),
      text: z.string(),
      sourceTurnIds: z.array(z.number().int()),
    }),
  ),
});
export type VaultReply = z.infer<typeof VaultReply>;

/** A confirmed fact as sent to the server: the short id is how drafts refer back to it. */
export const FactRef = z.object({
  id: z.string().trim().min(1).max(12),
  kind: z.enum(FACT_KINDS),
  text: z.string().trim().min(1).max(400),
});
export type FactRef = z.infer<typeof FactRef>;

export const GenerateRequest = z.object({
  profile: ProfileInput,
  turns: z.array(Turn).min(1).max(12),
  /** Only facts the user confirmed and left switched on for drafts. */
  facts: z.array(FactRef).min(1).max(20),
  /** Optional job description the user pasted. Used for this request only. */
  jobDescription: z.string().trim().max(6000).default(""),
  /** Profile fields the user chose from their own LinkedIn export. Used for this request only. */
  imported: z.string().trim().max(8000).default(""),
  /** An imported job page the user reviewed. Ignored unless approved. Never a fact about the user. */
  requirements: z.lazy(() => ExternalContextPacket).optional(),
});

// ---- model output (structured outputs) ----
export const InterviewReply = z.object({
  done: z.boolean(),
  question: z.string(),
  why: z.string(),
});
export type InterviewReply = z.infer<typeof InterviewReply>;

/** Kept for results saved before the reviewable vault existed. */
export const VaultItem = z.object({
  kind: z.enum(["story", "number", "proof", "skill", "opinion", "constraint", "target"]),
  text: z.string(),
});
export type VaultItem = z.infer<typeof VaultItem>;

export const Draft = z.object({
  title: z.string(),
  body: z.string(),
  why: z.string(),
  /** Ids of the submitted facts this draft uses. A review aid, not proof every sentence is true. */
  factRefs: z.array(z.string()),
});
export type Draft = z.infer<typeof Draft>;

export const GenerateReply = z.object({
  profile: z.object({
    headlines: z.array(z.string()),
    about: z.string(),
  }),
  outreach: z.object({
    /** Ask ladder rung 1: a stranger gets one specific question, never a referral ask. */
    stranger: Draft,
    /** Rung 2: same college / alumni get a 15-minute chat ask. */
    alumni: Draft,
    /** Rung 3: someone who knows you gets the referral ask. */
    referral: Draft,
    hiring_manager: Draft,
    follow_up: Draft,
  }),
  posts: z.array(Draft),
  comments: z.array(Draft),
});
export type GenerateReply = z.infer<typeof GenerateReply> & {
  /** Present only on results saved by older versions. */
  vault?: VaultItem[];
  connect?: { look_for: { who: string; why: string; search: string }[] };
};

// ---- weekly plan: adjust by chat ----
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const PlanChatRequest = z.object({
  text: z.string().trim().min(1).max(500),
  counts: z.object({ posts: z.number().int(), comments: z.number().int(), messages: z.number().int() }),
  times: z.object({ post: HHMM, comment: HHMM, message: HHMM }),
});

export const PlanChatReply = z.object({
  posts: z.number().int(),
  comments: z.number().int(),
  messages: z.number().int(),
  post_time: z.string(),
  comment_time: z.string(),
  message_time: z.string(),
  understood: z.boolean(),
  reply: z.string(),
});
export type PlanChatReply = z.infer<typeof PlanChatReply>;

// ---- one person: relevance packet → note or message (Connect Coach) ----

export const CHANNELS = ["connection_note", "linkedin_message", "inmail", "email"] as const;
export type Channel = (typeof CHANNELS)[number];

export const INTENTS = ["learn_role", "work_question", "feedback", "explore_team", "live_job", "referral", "follow_up", "thank_you"] as const;
export type Intent = (typeof INTENTS)[number];

export const BRIDGES = ["knows_me", "worked_studied", "alumni", "event", "mutual_intro", "public_work", "live_role", "none"] as const;
export type Bridge = (typeof BRIDGES)[number];

export const Packet = z.object({
  intent: z.enum(INTENTS),
  bridge: z.enum(BRIDGES),
  channel: z.enum(CHANNELS),
  recipientRole: z.string().trim().max(160).default(""),
  roleChecked: z.boolean().default(false),
  /** The user's own one-line observation: a post, talk, project, role or shared moment. */
  anchor: z.string().trim().max(300).default(""),
  /** Where they saw it, as a label or link. Never fetched. */
  anchorSource: z.string().trim().max(300).default(""),
  whyThem: z.string().trim().max(300).default(""),
  ask: z.string().trim().max(300).default(""),
});
export type Packet = z.infer<typeof Packet>;

export const ConnectRequest = z.object({
  profile: ProfileInput,
  /** At most two facts the user picked for this person. Never the whole vault. */
  facts: z.array(FactRef).max(2).default([]),
  packet: Packet,
  /** Optional pasted text from their profile or post. */
  text: z.string().trim().max(4000).default(""),
  image: z
    .object({ media_type: z.enum(["image/png", "image/jpeg", "image/webp"]), data: z.string().max(5_600_000) })
    .optional(),
});

export const FIT_STATUSES = ["ready_for_review", "needs_context", "do_not_send"] as const;
export type FitStatus = (typeof FIT_STATUSES)[number];

export const ConnectReply = z.object({
  fitStatus: z.enum(FIT_STATUSES),
  body: z.string(),
  whyThisIsRelevant: z.string(),
  /** When fitStatus is not ready: the one thing the user should add or change. */
  question: z.string(),
  factRefs: z.array(z.string()),
});
export type ConnectReply = z.infer<typeof ConnectReply>;

// ---- comment on a post the user found ----

export const CommentRequest = z.object({
  targetRole: z.string().trim().min(2).max(120),
  domain: z.enum(DOMAINS),
  audiences: z.array(z.enum(AUDIENCES)).max(2),
  industry: z.string().trim().max(80).default(""),
  excerpt: z.string().trim().min(20).max(3000),
  facts: z.array(FactRef).max(3).default([]),
  perspective: z.string().trim().max(500).default(""),
  /** Demo mode only: the line the user is responding to, copied from the excerpt. */
  anchor: z.string().trim().max(300).default(""),
});

export const CommentReply = z.object({
  status: z.enum(["draft", "skip"]),
  body: z.string(),
  postAnchor: z.string(),
  factRefs: z.array(z.string()),
  whyItFits: z.string(),
});
export type CommentReply = z.infer<typeof CommentReply>;

// ---- imported job page (Apify enrichment plan): role fields only, never people or contacts ----

const Item = z.string().trim().min(2).max(240);

export const ExternalContextPacket = z
  .object({
    sourceUrl: z.string().url().max(500),
    sourceDomain: z.string().max(100),
    sourceKind: z.literal("job_board_posting"),
    fetchedAt: z.string().max(40),
    title: z.string().trim().max(160),
    company: z.string().trim().max(120),
    location: z.string().trim().max(160),
    workMode: z.enum(["remote", "hybrid", "on_site", "unknown"]),
    experienceLevel: z.string().trim().max(120),
    education: z.string().trim().max(240),
    responsibilities: z.array(Item).max(12),
    requiredSkills: z.array(Item).max(15),
    preferredSkills: z.array(Item).max(10),
    reviewStatus: z.enum(["unreviewed", "approved"]),
    approvedAt: z.string().max(40).optional(),
    provenance: z.array(z.object({ field: z.string().max(40), source: z.string().max(120) })).max(20),
  })
  .strict();
export type ExternalContextPacket = z.infer<typeof ExternalContextPacket>;

export const EnrichRequest = z.object({ url: z.string().trim().min(8).max(500) });

// ---- optional AI review of a message (opt-in, AI mode only) ----

export const ReviewRequest = z.object({
  text: z.string().trim().min(1).max(3000),
  channel: z.enum(CHANNELS),
  intent: z.enum(INTENTS),
  relationship: z.enum(["stranger", "alumni", "knows_me"]),
  anchor: z.string().trim().max(300).default(""),
  facts: z.array(FactRef).max(2).default([]),
  tone: z.enum(["keep_voice", "shorter", "warmer", "clearer"]),
});

export const ReviewReply = z.object({
  summary: z.string(),
  edits: z.array(z.object({ find: z.string(), replace: z.string(), why: z.string() })),
});
export type ReviewReply = z.infer<typeof ReviewReply>;

// ---- interview v2 (build plan Part 3) ----

const AnswerStatusEnum = z.enum(["answered", "skipped", "parked", "later"]);
const TriggerEnum = z.enum(["vague", "we", "no_number"]);

export const AnswerInputSchema = z.object({
  qid: z.string().trim().min(2).max(8),
  attempt: z.number().int().min(0).max(2),
  status: AnswerStatusEnum,
  text: z.string().max(1500).default(""),
  trigger: TriggerEnum.optional(),
  round: z.number().int().min(1).max(2).optional(),
});

export const SavedAnswerSchema = AnswerInputSchema.extend({
  vague: z.boolean().optional(),
  should: z.boolean().optional(),
  followUpText: z.string().max(300).optional(),
  at: z.string().max(40).optional(),
});

export const Interview2Request = z.object({
  bucket: z.enum(ACTIVE_BUCKETS),
  /** null asks for the current step without saving anything. */
  answer: AnswerInputSchema.nullable(),
  /** The browser's copy of the answers; ignored when the account holds them. */
  history: z.array(SavedAnswerSchema).max(80).default([]),
  elapsedSecs: z.number().int().min(0).max(24 * 3600).default(0),
  imported: z.boolean().default(false),
});

/** The model's only jobs: reflect, judge vagueness (and "should"), phrase one follow-up, propose facts from this answer. */
export const JudgeReply = z.object({
  reflection: z.string(),
  vague: z.boolean(),
  should: z.boolean(),
  followUp: z.string(),
  facts: z.array(z.object({ kind: z.enum(FACT_KINDS), text: z.string() })),
});
export type JudgeReply = z.infer<typeof JudgeReply>;

export const FirstWinRequest = z.object({
  profile: ProfileInput,
  facts: z.array(FactRef).max(20).default([]),
});

export const FirstWinReply = z.object({ headline: z.string(), referral: Draft });
export type FirstWinReply = z.infer<typeof FirstWinReply>;
