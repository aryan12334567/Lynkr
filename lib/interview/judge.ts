import { overlap, plainDashes } from "../clean";
import { looksHinglish } from "../grounding";
import { callStructured, isMock } from "../llm";
import { judgeSystem, judgeUser } from "../prompts";
import { JudgeReply, type Bucket, type FactKind } from "../schemas";
import { BANK, pick } from "./bank";
import { demoReflection, factsFromAnswer, confidenceOf, isExampleText, reflectionOk, type Answer, type CandidateFact } from "./engine";

/**
 * One answer through the model (when configured): a reflection, a vagueness and "should" judgement,
 * a phrased follow-up, and candidate facts. Every model output is checked; anything unusable falls
 * back to the deterministic version, so the interview never stalls on the model.
 */
export type Judged = { reflection: string; vague?: boolean; should?: boolean; followUpText?: string; facts: CandidateFact[] };

function allowedKinds(qid: string, attempt: number, trigger?: string): FactKind[] {
  const q = BANK.find((x) => x.id === qid);
  if (!q?.factKind) return attempt > 0 ? [trigger === "we" ? "contribution" : "evidence"] : [];
  if (attempt === 0) return q.factKind === "project" ? ["project", "contribution", "evidence", "challenge"] : [q.factKind];
  return [trigger === "we" ? "contribution" : trigger === "no_number" ? "evidence" : q.factKind];
}

/**
 * A Hinglish answer is stored as an English fact so every draft and check downstream can use it (audit P1). Words cannot
 * be matched across the two, so the check is on what survives translation: every number and every name in the fact must
 * be in the answer, the fact must not be Hinglish itself, and it cannot be much longer than what was said. The person
 * still confirms or edits each fact on the read-back screen before anything is written from it.
 */
export function translationHolds(fact: string, answer: string): boolean {
  if (!fact.trim() || looksHinglish(fact)) return false;
  const said = answer.toLowerCase();
  for (const n of fact.match(/\d[\d,.]*/g) ?? []) if (!said.includes(n.replace(/[,.]$/, ""))) return false;
  const names = [...fact.matchAll(/\b[A-Z][\p{L}\p{N}'-]+\b/gu)].filter((m) => !/(^|[.!?]\s+)$/.test(fact.slice(0, m.index))).map((m) => m[0]);
  for (const name of names) if (name !== "I" && !said.includes(name.toLowerCase())) return false;
  const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
  return words(fact) <= Math.max(12, Math.ceil(words(answer) * 1.6));
}

export async function judgeAnswer(bucket: Bucket, answers: Answer[], a: Answer): Promise<Judged> {
  const fallback: Judged = { reflection: demoReflection(a.qid, a.text), facts: factsFromAnswer(bucket, a) };
  if (a.status !== "answered" || isMock()) return fallback;
  const q = BANK.find((x) => x.id === a.qid);
  if (!q) return fallback;
  const kinds = allowedKinds(a.qid, a.attempt, a.trigger);
  const earlier = answers
    .filter((x) => x.qid === a.qid && x.attempt < a.attempt && x.status === "answered")
    .map((x) => x.text)
    .join("\n");
  try {
    const r: JudgeReply = await callStructured({
      system: judgeSystem(bucket),
      user: judgeUser(a.attempt === 0 ? pick(q.text, bucket) : "(a follow-up to the question above)", a.text, kinds, earlier),
      schema: JudgeReply,
      effort: "low",
      maxTokens: 2000,
    });
    const source = [earlier, a.text].join(" ");
    const hinglish = looksHinglish(a.text);
    const facts: CandidateFact[] = r.facts
      .map((f) => ({ ...f, text: plainDashes(f.text.trim()).slice(0, 300) }))
      .filter((f) => f.text && kinds.includes(f.kind) && (hinglish ? translationHolds(f.text, source) : overlap(f.text, source) >= 0.3) && !isExampleText(q, bucket, f.text))
      .slice(0, 3)
      .map((f) => ({ kind: f.kind, text: f.text, sourceQid: a.qid, confidence: confidenceOf(f.text, a.trigger === "no_number") }));
    const reflection = reflectionOk(r.reflection, a.text) ? plainDashes(r.reflection.trim()) : fallback.reflection;
    const followUp = r.followUp.trim();
    return {
      reflection,
      vague: r.vague,
      should: r.should,
      ...(r.vague && followUp && followUp.length <= 200 && !/password|salary|ctc|aadhaar|pan\b|phone/i.test(followUp) ? { followUpText: plainDashes(followUp) } : {}),
      // Chip and brief-only questions have no facts; otherwise keep the model's facts only if any survived the checks.
      facts: kinds.length === 0 ? [] : facts.length ? facts : fallback.facts,
    };
  } catch {
    return fallback;
  }
}
