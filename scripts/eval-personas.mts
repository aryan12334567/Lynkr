/**
 * Real-model evaluation: replays the five fixed personas (tests/fixtures/personas.ts) against a running
 * server's POST /api/interview2, so reflections, vagueness judgements and follow-up wording come from the
 * configured model (OpenAI gpt-5-mini in production). Re-run whenever a prompt changes.
 *
 *   node --no-warnings --import ./tests/register.mjs scripts/eval-personas.mts
 *   LYNKR_URL=http://localhost:3000   server to use (default)
 *   LYNKR_COOKIE="..."                a signed-in session cookie, when the server requires an account
 *
 * Prints a table and appends a dated section to research/eval-personas-results.md.
 * Never prints answer text from the server, cookies or keys.
 *
 *   ... scripts/eval-personas.mts --demo
 * Demo mode: no server and no model. Runs the same steps as the route in-process (validate, judge in
 * demo mode, apply, next step) and prints a detailed table (asked, follow-ups, parked, skipped, later,
 * core filled, facts traced to an answer, example leaks). Nothing is appended.
 */
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { BANK } from "../lib/interview/bank";
import { reflectionOk, type Answer, type CandidateFact, type NextStep } from "../lib/interview/engine";
import { chooser, expectedFound, PERSONAS, secsFor, type Persona } from "../tests/fixtures/personas";

const BASE = (process.env.LYNKR_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT = "research/eval-personas-results.md";

type Reply = { next: NextStep; reflection: string; facts: CandidateFact[]; answers: Answer[]; progress: { done: number; total: number; pct: number } };

class Stop extends Error {}

async function call(body: unknown): Promise<Reply> {
  const res = await fetch(`${BASE}/api/interview2`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.LYNKR_COOKIE ? { cookie: process.env.LYNKR_COOKIE } : {}) },
    body: JSON.stringify(body),
  });
  if (res.status === 401) throw new Stop("401: the server needs a signed-in account. Sign in in a browser and pass its session cookie as LYNKR_COOKIE.");
  if (res.status === 402) throw new Stop("402: the server says a subscription is needed. The v2 interview should be free; check LYNKR_INTERVIEW and the paywall settings.");
  if (res.status === 429) throw new Stop("429: a rate limit or daily cap was hit. Wait, or raise the cap on a local server.");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${((await res.json().catch(() => ({}))) as { error?: string }).error ?? "no message"}`);
  return (await res.json()) as Reply;
}

type Result = {
  id: string;
  bucket: string;
  status: "done" | "stopped" | "error";
  note: string;
  steps: number;
  followUps: number;
  facts: number;
  expected: string;
  badReflections: number;
  estMinutes: number;
  wallSecs: number;
};

async function replay(p: Persona): Promise<Result> {
  const started = Date.now();
  const choose = chooser(p);
  const facts: CandidateFact[] = [];
  let steps = 0;
  let followUps = 0;
  let badReflections = 0;
  let secs = 0;
  const base = { id: p.id, bucket: p.bucket };
  try {
    let reply = await call({ bucket: p.bucket, answer: null, history: [], elapsedSecs: 0, imported: false });
    while (reply.next.type === "ask") {
      if (++steps > 80) throw new Error("did not finish within 80 steps");
      const step = reply.next;
      const input = choose(step);
      if (step.attempt > 0) followUps++;
      secs += secsFor(BANK.find((q) => q.id === step.qid)?.secs ?? 30, step, input);
      reply = await call({ bucket: p.bucket, answer: input, history: reply.answers, elapsedSecs: secs, imported: false });
      if (input.status === "answered" && reply.reflection && !reflectionOk(reply.reflection, input.text)) badReflections++;
      // The server returns the facts for this answer; keep the latest copy per question and attempt.
      for (const f of reply.facts) {
        const i = facts.findIndex((x) => x.sourceQid === f.sourceQid && x.kind === f.kind && x.text === f.text);
        if (i < 0) facts.push(f);
      }
    }
    const { found, missing } = expectedFound(p, facts);
    return {
      ...base,
      status: "done",
      note: missing.length ? `missing ${missing.join("; ")}` : "",
      steps,
      followUps,
      facts: facts.length,
      expected: `${found}/${p.expectFacts.length}`,
      badReflections,
      estMinutes: Math.round((secs / 60) * 10) / 10,
      wallSecs: Math.round((Date.now() - started) / 1000),
    };
  } catch (err) {
    const stopped = err instanceof Stop;
    return { ...base, status: stopped ? "stopped" : "error", note: (err as Error).message, steps, followUps, facts: facts.length, expected: "-", badReflections, estMinutes: Math.round((secs / 60) * 10) / 10, wallSecs: Math.round((Date.now() - started) / 1000) };
  }
}

if (process.argv.includes("--demo")) {
  await demo();
  process.exit(0);
}

/** Demo mode: the route's steps in-process, with the model switched off. */
async function demo() {
  process.env.LYNKR_MOCK = "1";
  const { judgeAnswer } = await import("../lib/interview/judge");
  const { applyAnswer, isExampleText, nextStep, validateAnswer } = await import("../lib/interview/engine");
  const { overlap } = await import("../lib/clean");
  const { pick } = await import("../lib/interview/bank");
  const rows: string[] = [];
  for (const p of PERSONAS) {
    const choose = chooser(p);
    let answers: Answer[] = [];
    let secs = 0;
    let asks = 0;
    let followUps = 0;
    const facts: CandidateFact[] = [];
    let badReflections = 0;
    // Facts per question attempt: a re-saved attempt replaces its own facts, as in the route.
    const byAttempt = new Map<string, CandidateFact[]>();
    const parked = new Set<string>();
    let step = nextStep(p.bucket, answers, { elapsedSecs: 0 });
    let note = "";
    try {
      while (step.type === "ask") {
        if (++asks > 80) throw new Error("did not finish within 80 steps");
        const input = choose(step);
        const err = validateAnswer(p.bucket, answers, input);
        if (err) throw new Error(`${step.qid}/${step.attempt} refused: ${err}`);
        if (step.attempt > 0) followUps++;
        if (input.status === "parked") parked.add(input.qid);
        secs += secsFor(BANK.find((x) => x.id === input.qid)!.secs, step, input);
        const judged = await judgeAnswer(p.bucket, answers, { ...input, text: input.status === "answered" ? input.text.trim() : "" });
        if (input.status === "answered" && !reflectionOk(judged.reflection, input.text)) badReflections++;
        answers = applyAnswer(answers, input);
        byAttempt.set(`${input.qid}.${input.attempt}`, judged.facts);
        step = nextStep(p.bucket, answers, { elapsedSecs: secs });
      }
    } catch (e) {
      note = (e as Error).message;
    }
    // Only facts from attempts that are still saved (editing a main answer drops stale follow-ups).
    for (const [k, fs] of byAttempt) if (answers.some((a) => `${a.qid}.${a.attempt}` === k)) facts.push(...fs);
    const main = (s: string) => answers.filter((a) => a.attempt === 0 && a.status === s).map((a) => a.qid);
    const core = BANK.filter((q) => q.tag === "core" && q.buckets.includes(p.bucket) && (!q.triggeredBy || answers.some((a) => a.qid === q.id)));
    const coreFilled = core.filter((q) => answers.some((a) => a.qid === q.id && a.attempt === 0 && a.status === "answered")).length;
    // Traceable: every fact shares most of its words with a saved answer to its own question.
    const untraced = facts.filter((f) => !answers.some((a) => a.qid === f.sourceQid && a.status === "answered" && overlap(f.text.replace(/ \(estimate\)$/, ""), a.text) >= 0.5));
    const leaks = facts.filter((f) => {
      const q = BANK.find((x) => x.id === f.sourceQid);
      return q && (isExampleText(q, p.bucket, f.text) || [pick(q.example, p.bucket), ...pick(q.examples, p.bucket)].some((e) => e.trim() === f.text.trim()));
    });
    const { found, missing } = expectedFound(p, facts);
    rows.push(
      `| ${p.id} | ${p.bucket} | ${step.type === "done" && !note ? "finished" : "stuck"} | ${asks} | ${followUps} | ${[...parked].map((q) => `${q}${main("parked").includes(q) ? " (unresolved)" : " (answered on revisit)"}`).join(", ") || "-"} | ${main("skipped").join(", ") || "-"} | ${step.type === "done" ? step.later.join(", ") || "-" : "-"} | ${(secs / 60).toFixed(1)} | ${coreFilled}/${core.length} | ${found}/${p.expectFacts.length}${missing.length ? ` (missing ${missing.join("; ")})` : ""} | ${leaks.length} | ${untraced.length} | ${badReflections} | ${note.replace(/\|/g, "/")} |`,
    );
  }
  console.log(
    [
      "| Persona | Bucket | Result | Asks | Follow-ups | Parked | Skipped | Later | Est. min | Core filled | Expected facts | Example leaks | Untraced facts | Bad reflections | Note |",
      "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
      ...rows,
    ].join("\n"),
  );
}

const results: Result[] = [];
for (const p of PERSONAS) {
  const r = await replay(p);
  results.push(r);
  console.log(`${r.id}: ${r.status}${r.note ? ` (${r.note})` : ""}`);
  // A missing account or subscription stops every persona the same way; don't repeat it five times.
  if (r.status === "stopped") break;
}

const header = "| Persona | Bucket | Status | Steps | Follow-ups | Facts | Expected facts | Bad reflections | Est. min | Wall s | Note |\n|---|---|---|---|---|---|---|---|---|---|---|";
const rows = results.map((r) => `| ${r.id} | ${r.bucket} | ${r.status} | ${r.steps} | ${r.followUps} | ${r.facts} | ${r.expected} | ${r.badReflections} | ${r.estMinutes} | ${r.wallSecs} | ${r.note.replace(/\|/g, "/")} |`);
const table = [header, ...rows].join("\n");
console.log(`\n${table}`);

const section = `\n## Run ${new Date().toISOString()} against ${BASE}\n\n${table}\n`;
if (!existsSync(OUT)) writeFileSync(OUT, "# Persona evaluation results (real model)\n\nProduced by `scripts/eval-personas.mts`. Re-run whenever a prompt changes.\n");
appendFileSync(OUT, section);
console.log(`\nAppended to ${OUT}`);
process.exit(results.every((r) => r.status === "done" && !r.note) ? 0 : 1);
