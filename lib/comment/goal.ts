import type { CommentGoal } from "../schemas";

/** One person's generations a day, Regenerate included (Commenter plan R20, D-C3). */
export const DAILY_COMMENTS = 10;

/** The goal chip's default comes from the interview bucket (R7). Freelancer is only ever chosen by hand. */
export function defaultGoal(bucket: string | undefined): CommentGoal {
  return bucket === "networker" ? "visibility" : "job_seeker";
}
