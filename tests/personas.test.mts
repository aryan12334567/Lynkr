// I21: five personas run the interview v2 engine end to end in demo mode (pure functions, no model).
// The fixed regression set: re-run whenever the bank, engine or a prompt changes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK, pick, questionsFor } from "../lib/interview/bank";
import { applyAnswer, briefFrom, factsFromAnswer, nextStep, validateAnswer, type Answer, type CandidateFact } from "../lib/interview/engine";
import { chooser, expectedFound, PERSONAS, secsFor, type Persona } from "./fixtures/personas";

type Run = { steps: number; secs: number; facts: CandidateFact[]; answers: Answer[]; asked: string[]; followUps: string[]; later: string[]; unresolved: string[] };

function run(p: Persona): Run {
  const choose = chooser(p);
  let answers: Answer[] = [];
  let secs = 0;
  const asked: string[] = [];
  const followUps: string[] = [];
  for (let steps = 0; steps < 60; steps++) {
    const s = nextStep(p.bucket, answers, { elapsedSecs: secs });
    if (s.type === "done") {
      // Facts from every answer that's still saved (edits replace, so this is the final set).
      const facts = answers.flatMap((a) => factsFromAnswer(p.bucket, a));
      return { steps, secs, facts, answers, asked, followUps, later: s.later, unresolved: s.unresolved };
    }
    const input = choose(s);
    const err = validateAnswer(p.bucket, answers, input);
    assert.equal(err, null, `${p.id} ${s.qid}/${s.attempt}: ${err}`);
    asked.push(s.attempt > 0 ? `${s.qid}.${s.attempt}` : s.revisit ? `${s.qid}(revisit)` : s.qid);
    if (s.attempt > 0) followUps.push(`${s.qid}:${s.trigger}`);
    secs += secsFor(BANK.find((q) => q.id === s.qid)!.secs, s, input);
    answers = applyAnswer(answers, input);
  }
  assert.fail(`${p.id}: did not finish within 60 steps`);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

test("I21: five personas cover every built bucket", () => {
  assert.equal(PERSONAS.length, 5);
  for (const b of ["fresher", "experienced", "networker"] as const) assert.ok(PERSONAS.some((p) => p.bucket === b), b);
  assert.ok(PERSONAS.some((p) => Object.values(p.answers).some((v) => Array.isArray(v) && v[0] === "__PARK__")), "a parked core question");
});

for (const p of PERSONAS) {
  test(`I21 persona ${p.id}: finishes with the expected facts and brief, under 15 minutes`, () => {
    const r = run(p);
    assert.deepEqual(r.unresolved, [], "no unresolved core questions");
    // Every core question that applies was answered.
    const core = questionsFor(p.bucket).filter((q) => q.tag === "core" && (!q.triggeredBy || r.asked.some((a) => a.startsWith(q.id))));
    for (const q of core) assert.ok(r.answers.some((a) => a.qid === q.id && a.attempt === 0 && a.status === "answered"), `${q.id} answered`);
    const { missing } = expectedFound(p, r.facts);
    assert.deepEqual(missing, [], "expected facts");
    const brief = briefFrom(p.bucket, r.answers);
    for (const [k, v] of Object.entries(p.expectBrief)) assert.deepEqual(brief[k as keyof typeof brief], v, `brief.${k}`);
    // No fact is a bank example, word for word.
    const examples = new Set(BANK.flatMap((q) => [pick(q.example, p.bucket), ...pick(q.examples, p.bucket)]).map(norm));
    for (const f of r.facts) assert.ok(!examples.has(norm(f.text)), `fact is an example: ${f.text}`);
    assert.ok(r.secs < 15 * 60, `estimated ${Math.round(r.secs / 60)} min`);
    console.log(
      `persona ${p.id}: steps ${r.steps}, ~${(r.secs / 60).toFixed(1)} min, facts ${r.facts.length}, follow-ups ${r.followUps.length}, later ${r.later.length}, expected facts ${p.expectFacts.length}/${p.expectFacts.length}`,
    );
  });
}

test("I21: the 'should' goal triggers B4 only for that persona", () => {
  for (const p of PERSONAS) {
    const r = run(p);
    assert.equal(r.asked.includes("B4"), p.id === "fresher-hyd-engineer", p.id);
  }
});

test("I21: the sales lead gets the 'we' and estimate follow-ups, and the estimate is labelled", () => {
  const r = run(PERSONAS.find((p) => p.id === "exp-chennai-sales")!);
  assert.deepEqual(r.followUps, ["C1:we", "C1:no_number"]);
  const est = r.facts.filter((f) => f.kind === "evidence" && f.sourceQid === "C1");
  assert.equal(est.length, 1);
  assert.match(est[0].text, /\(estimate\)$/);
  assert.equal(est[0].confidence.number, "estimate");
});

test("I21: parked questions come back once and are answered; skipped sensitive questions keep the search private", () => {
  const eng = run(PERSONAS.find((p) => p.id === "fresher-hyd-engineer")!);
  assert.ok(eng.asked.includes("D2") && eng.asked.includes("D2(revisit)"));
  assert.ok(eng.answers.some((a) => a.qid === "D2" && a.status === "answered"));
  const des = run(PERSONAS.find((p) => p.id === "exp-blr-designer")!);
  assert.ok(des.asked.includes("D3(revisit)"));
  assert.equal(des.answers.find((a) => a.qid === "B7")?.status, "skipped");
  assert.equal(briefFrom("experienced", des.answers).privateSearch, true);
});
