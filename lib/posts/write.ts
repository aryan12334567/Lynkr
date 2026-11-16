import { callStructured, isMock } from "../llm";
import type { FactRef } from "../schemas";
import { versionProblem } from "./checks";
import type { PostType } from "./db";
import { mockVersions } from "./mock";
import { POST_VERSIONS_SYSTEM, postVersionsUser } from "./prompt";
import { PostVersionsModel, type AnswerIn, type WrittenVersion } from "./types";

/**
 * Up to three complete versions of one post, or a plain "answer one more question" (posts plan U4, KTD7, KD2).
 * The model writes; the guard in checks.ts decides what the person sees. A version that fails is dropped, never shown.
 */

export type WriteInput = { type: PostType; brief: string; answers: AnswerIn[]; facts: FactRef[] };

export type WriteResult =
  | { kind: "versions"; versions: WrittenVersion[]; /** Versions the guard dropped. */ dropped: number; /** Set when fewer than three passed. */ note: string | null }
  | { kind: "need_more"; reason: "no_input" | "failed" };

export type WriteDeps = {
  call: typeof callStructured;
  mock: () => boolean;
  /** The clock in milliseconds, so the retry rule can be tested. */
  now: () => number;
};
const defaultDeps: WriteDeps = { call: callStructured, mock: isMock, now: () => Date.now() };

/** The model is asked again after a failed check only if the first answer came back this fast. */
export const RETRY_WITHIN_MS = 25_000;
export const WRITE_TIMEOUT_MS = 50_000;

const key = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function keep(model: PostVersionsModel, input: WriteInput): { kept: WrittenVersion[]; dropped: number } {
  const ev = { facts: input.facts, answers: input.answers, brief: input.brief };
  const seen = new Set<string>();
  const kept: WrittenVersion[] = [];
  let dropped = 0;
  for (const v of model.versions.slice(0, 6)) {
    const body = v.body.trim();
    if (seen.has(key(body))) continue;
    if (versionProblem({ ...v, body }, ev)) { dropped++; continue; }
    seen.add(key(body));
    kept.push({ ...v, body, why: v.why.trim() });
  }
  return { kept: kept.slice(0, 3), dropped };
}

const noteFor = (n: number) => (n >= 3 ? null : `${n} of 3 versions passed the checks. The others used something you did not tell me, so they were left out.`);

export async function writePosts(input: WriteInput, deps: WriteDeps = defaultDeps): Promise<WriteResult> {
  // Nothing to write from: no model call.
  if (input.answers.length === 0 && input.facts.length === 0) return { kind: "need_more", reason: "no_input" };
  const ev = { facts: input.facts, answers: input.answers, brief: input.brief };

  if (deps.mock()) {
    const k = keep(mockVersions(ev, input.type), input);
    return k.kept.length ? { kind: "versions", versions: k.kept, dropped: k.dropped, note: noteFor(k.kept.length) } : { kind: "need_more", reason: "failed" };
  }

  let dropped = 0;
  const started = deps.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    // A second try after a slow first one would keep the person waiting past a minute.
    if (attempt > 0 && deps.now() - started > RETRY_WITHIN_MS) break;
    const model = await deps.call({
      system: POST_VERSIONS_SYSTEM,
      user: postVersionsUser({ type: input.type, brief: input.brief, facts: input.facts, answers: input.answers, retry: attempt > 0 }),
      schema: PostVersionsModel,
      effort: "low",
      maxTokens: 3500,
      timeoutMs: WRITE_TIMEOUT_MS,
    });
    const k = keep(model, input);
    dropped += k.dropped;
    if (k.kept.length) return { kind: "versions", versions: k.kept, dropped, note: noteFor(k.kept.length) };
  }
  return { kind: "need_more", reason: "failed" };
}
