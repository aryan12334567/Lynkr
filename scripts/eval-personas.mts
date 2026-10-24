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
