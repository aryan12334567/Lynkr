import { z } from "zod";

export const GOALS = ["job", "internship", "referral", "network"] as const;
export type Goal = (typeof GOALS)[number];

export const GOAL_LABEL: Record<Goal, string> = {
  job: "A full-time job",
  internship: "An internship",
  referral: "A referral at a specific company",
  network: "To meet people in my field",
};

// ---- request bodies (validated on the server) ----
export const ProfileInput = z.object({
  goal: z.enum(GOALS),
  targetRole: z.string().trim().min(2).max(120),
  background: z.string().trim().min(2).max(400),
  currentProfile: z.string().trim().max(4000).default(""),
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

export const GenerateRequest = z.object({
  profile: ProfileInput,
  turns: z.array(Turn).min(1).max(12),
});

// ---- model output (structured outputs) ----
export const InterviewReply = z.object({
  done: z.boolean(),
  question: z.string(),
  why: z.string(),
});
export type InterviewReply = z.infer<typeof InterviewReply>;

export const VaultItem = z.object({
  kind: z.enum(["story", "number", "proof", "skill", "opinion", "constraint", "target"]),
  text: z.string(),
});
export type VaultItem = z.infer<typeof VaultItem>;

export const Draft = z.object({
  title: z.string(),
  body: z.string(),
  why: z.string(),
});
export type Draft = z.infer<typeof Draft>;

export const GenerateReply = z.object({
  vault: z.array(VaultItem),
  profile: z.object({
    headlines: z.array(z.string()),
    about: z.string(),
    gaps: z.array(z.string()),
  }),
  outreach: z.object({
    referral: Draft,
    hiring_manager: Draft,
    follow_up: Draft,
  }),
  posts: z.array(Draft),
  comments: z.array(Draft),
});
export type GenerateReply = z.infer<typeof GenerateReply>;
