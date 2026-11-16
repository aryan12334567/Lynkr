import { callStructured, isMock } from "../llm";
import { textProblems, type Problem } from "./checks";
import type { PostType } from "./db";
import { mockRefine } from "./mock";
import { POST_REFINE_SYSTEM, postRefineUser } from "./prompt";
import { PostRefineModel, type Evidence } from "./types";

/**
 * Refine one version by instruction (posts plan U5, R15): "shorter", "more direct", or free text up to 300 characters.
 * The revised text goes through the same guard as a first draft, so an instruction cannot add a fact. The caller stores
 * a refine as a new version, so nothing is overwritten.
 */

export const INSTRUCTION_MAX = 300;
/** A refine may shorten a post, so its floor is lower than a first draft's. The ceiling is the same. */
export const REFINE_LENGTH: [number, number] = [40, 180];
export const RETRY_WITHIN_MS = 25_000;
export const REFINE_TIMEOUT_MS = 50_000;

export type RefineInput = { body: string; instruction: string; type: PostType; evidence: Evidence };
export type RefineResult =
  | { kind: "refined"; body: string; why: string }
  | { kind: "rejected"; problems: Problem[]; message: string }
  | { kind: "invalid"; message: string };

export type RefineDeps = { call: typeof callStructured; mock: () => boolean; now: () => number };
const defaultDeps: RefineDeps = { call: callStructured, mock: isMock, now: () => Date.now() };

const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
const REJECTED = "I couldn't make that change using only what you've told me. Try wording it differently, or answer one more question first.";

export async function refineBody(input: RefineInput, deps: RefineDeps = defaultDeps): Promise<RefineResult> {
  const instruction = input.instruction.trim();
  if (!instruction) return { kind: "invalid", message: "Tell me what to change, for example: shorter." };
  if (instruction.length > INSTRUCTION_MAX) return { kind: "invalid", message: `Keep the instruction under ${INSTRUCTION_MAX} characters.` };

  const accept = (r: PostRefineModel): RefineResult | Problem[] => {
    const body = r.body.trim();
    if (same(body, input.body)) return [{ code: "unchanged", message: "The text did not change." }];
    const problems = textProblems(body, input.evidence, { length: REFINE_LENGTH });
    return problems.length ? problems : { kind: "refined", body, why: r.why.trim() };
  };

  if (deps.mock()) {
    const m = mockRefine(input.body, instruction);
    if (!m) return { kind: "rejected", problems: [], message: "In demo mode I can only make a post shorter or more direct." };
    const out = accept(m);
    return Array.isArray(out) ? { kind: "rejected", problems: out, message: REJECTED } : out;
  }

  let problems: Problem[] = [];
  const started = deps.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0 && deps.now() - started > RETRY_WITHIN_MS) break;
    const r = await deps.call({
      system: POST_REFINE_SYSTEM,
      user: postRefineUser({ type: input.type, brief: input.evidence.brief, facts: input.evidence.facts, answers: input.evidence.answers, body: input.body, instruction, retry: attempt > 0 }),
      schema: PostRefineModel,
      effort: "low",
      maxTokens: 2500,
      timeoutMs: REFINE_TIMEOUT_MS,
    });
    const out = accept(r);
    if (!Array.isArray(out)) return out;
    problems = out;
  }
  return { kind: "rejected", problems, message: REJECTED };
}
