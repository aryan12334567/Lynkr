// Reliability (audit dimension 3): a slow or dead provider must end in a plain answer, never in a request that hangs.
// No network: `fetch` is replaced by one that never answers and only ends when its signal aborts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { callStructured, LlmError } from "../lib/llm";
import { sendEmail } from "../lib/email";
import { poolOptions } from "../lib/dbUrl";

const realFetch = globalThis.fetch;
/** A provider that accepts the request and never answers. It honours an abort signal, as a real socket does. */
const hang = () => {
  let signalled = false;
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
    const s = init?.signal;
    if (!s) return; // no signal: this promise never settles, which is the bug
    const fail = () => { signalled = true; reject(s.reason ?? new DOMException("aborted", "AbortError")); };
    if (s.aborted) fail(); else s.addEventListener("abort", fail);
  })) as typeof fetch;
  return { restore: () => { globalThis.fetch = realFetch; }, signalled: () => signalled };
};
const within = <T,>(p: Promise<T>, ms: number): Promise<T | "HUNG"> => Promise.race([p, new Promise<"HUNG">((r) => setTimeout(() => r("HUNG"), ms))]);
const env = (vars: Record<string, string | undefined>) => {
  const old: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { old[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  return () => { for (const k of Object.keys(old)) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; } };
};

test("a model that never answers ends in 'took too long' (504), not a hung request", async () => {
  const restoreEnv = env({ OPENAI_API_KEY: "test-key-not-real", LLM_BASE_URL: undefined, LLM_MODEL: "gpt-test", LYNKR_MOCK: undefined });
  const h = hang();
  try {
    const out = await within(callStructured({ system: "s", user: "u", schema: z.object({ a: z.string() }), effort: "low", maxTokens: 100, timeoutMs: 60 }).then(() => "ANSWERED", (e) => e), 1500);
    assert.notEqual(out, "HUNG", "the call never ended");
    assert.ok(out instanceof LlmError, String(out));
    assert.equal((out as LlmError).status, 504);
    assert.match((out as LlmError).message, /too long/i);
    assert.equal(h.signalled(), true, "the request was cancelled, not left running");
  } finally { h.restore(); restoreEnv(); }
});

test("an email provider that never answers fails the send in time, so sign-in shows an error instead of spinning", async () => {
  const restoreEnv = env({ RESEND_API_KEY: "test-key-not-real", LYNKR_EMAIL_TIMEOUT_MS: "60" });
  const h = hang();
  try {
    const out = await within(sendEmail("someone@example.com", "code", "123456").then(() => "SENT", (e) => e), 1500);
    assert.notEqual(out, "HUNG", "the send never ended");
    assert.ok(out instanceof Error, String(out));
    assert.doesNotMatch((out as Error).message, /someone@example\.com|123456|test-key/, "the error names no address, code or key");
  } finally { h.restore(); restoreEnv(); }
});

test("the database pools give up on a connection and on a statement instead of waiting for ever", () => {
  const o = poolOptions("postgres://u:p@localhost:5432/db");
  assert.equal(o.max, 3);
  assert.ok(o.connectionTimeoutMillis > 0 && o.connectionTimeoutMillis <= 15_000);
  // query_timeout is a timer in the client. statement_timeout would be a startup parameter, which Neon's pooler refuses.
  assert.ok(o.query_timeout > 0 && o.query_timeout <= 30_000);
  assert.equal("statement_timeout" in o, false);
  assert.ok(o.idleTimeoutMillis > 0);
});

test("a comment is not asked for a second time when the first answer was slow and failed its checks", async () => {
  const { writeComments, RETRY_WITHIN_MS } = await import("../lib/comment/write");
  const POST = "Priya Shah\nData Lead at Swiggy\n2d •\nMost teams skip cleaning the survey data and then wonder why the dashboard is wrong.\nWe fixed the inputs first, and the report time dropped.";
  const bad = { status: "options" as const, skipWhy: "", options: [{ angle: "experience" as const, body: "too short", postAnchor: "Most teams skip cleaning the survey data", factRefs: [], why: "x" }] };
  const realNow = Date.now;
  try {
    for (const [slowBy, expected] of [[0, 2], [RETRY_WITHIN_MS + 1000, 1]] as const) {
      let calls = 0, clock = 1_000_000;
      Date.now = () => clock;
      const deps = { mock: () => false, call: (async () => { calls++; clock += slowBy; return bad; }) as never };
      const r = await writeComments({ selection: POST, goal: "job_seeker", reaction: "I check inputs first.", targetRole: "Data analyst", facts: [] }, deps);
      assert.equal(r.kind, "skip");
      assert.equal(calls, expected, slowBy ? "slow first answer: no second call" : "quick first answer: one more try");
    }
  } finally { Date.now = realNow; }
});
