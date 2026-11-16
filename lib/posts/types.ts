import { z } from "zod";
import type { FactRef } from "../schemas";

/** One answer of the per-post interview as the writer sees it. `id` is "A1", "A2" ... (the turn), so a version can cite it. */
export type AnswerIn = { id: string; key: string; question: string; text: string };

/** Everything a version may rest on: the person's confirmed facts, this post's answers, and its brief. */
export type Evidence = { facts: FactRef[]; answers: AnswerIn[]; brief: string };

export const PostVersionsModel = z.object({
  versions: z.array(
    z.object({
      angle: z.string().max(60),
      body: z.string().max(4000),
      why: z.string().max(300),
      factRefs: z.array(z.string().max(12)).max(6),
      answerRefs: z.array(z.string().max(6)).max(8),
    }),
  ).max(6),
});
export type PostVersionsModel = z.infer<typeof PostVersionsModel>;
export type WrittenVersion = PostVersionsModel["versions"][number];

export const PostRefineModel = z.object({ body: z.string().max(4000), why: z.string().max(300) });
export type PostRefineModel = z.infer<typeof PostRefineModel>;

export const PostQuestionModel = z.object({ question: z.string().max(400) });
export type PostQuestionModel = z.infer<typeof PostQuestionModel>;
