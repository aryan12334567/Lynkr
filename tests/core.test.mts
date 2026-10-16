// Phase 4 unit tests (research/build-plan.md): checker, slots, specificity, limits, schemas, prompt rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkMessage } from "../lib/checker";
import { openSlots, parseSlots, renderFilled, slotCount } from "../lib/slots";
import { scoreSpecificity } from "../lib/specificity";
import { checkLimits } from "../lib/limit";
import { ConnectRequest, InterviewRequest, PlanChatRequest, ProfileInput } from "../lib/schemas";
import { CONNECT_SYSTEM, GENERATE_SYSTEM, INTERVIEW_SYSTEM, PLAN_CHAT_SYSTEM } from "../lib/prompts";

const GOOD =
  "Hi Priya, I'm applying for the SDE intern role at Razorpay (Job ID R-12345). I built a UPI expense tracker used by 300 students. My resume is attached. Would you be comfortable referring me? No worries if it's not a fit.";

test("checker: verdicts and flags", () => {
  assert.equal(checkMessage(GOOD, "knows_me").verdict, "Ready to send");
  assert.equal(checkMessage("Hi", "alumni").verdict, "Don't send yet");
  assert.equal(checkMessage("", "alumni").verdict, "Don't send yet");
  const long = checkMessage(GOOD + " " + "word ".repeat(80), "knows_me");
  assert.ok(long.checks.some((c) => !c.ok && /90 words/.test(c.label)));
  const bad = checkMessage("Hello sir, kindly revert urgently. Please refer me for any job.", "alumni");
  for (const p of ["kindly revert", "urgent / ASAP", "please refer me", "any job / any opening", "sir / ma'am"]) {
    assert.ok(bad.flags.some((f) => f.phrase === p), `missing flag ${p}`);
  }
  // Job ID forms: link, "Job ID: 123", requisition code.
  for (const id of ["https://jobs.example.com/123", "Job ID: 4567", "req-20431"]) {
    const v = checkMessage(GOOD.replace("Job ID R-12345", id), "knows_me");
    assert.ok(v.checks.find((c) => /Job ID/.test(c.label))?.ok, id);
  }
  // Deterministic: same input, same verdict.
  const runs = new Set(Array.from({ length: 10 }, () => JSON.stringify(checkMessage(GOOD, "stranger"))));
  assert.equal(runs.size, 1);
});

test("slots: parse, count, fill", () => {
  const body = "Hi [[name]], I saw [[post]]. Thanks.";
  assert.equal(slotCount(body), 2);
  assert.deepEqual(parseSlots(body).filter((s) => s.type === "slot").map((s) => (s.type === "slot" ? s.label : "")), ["name", "post"]);
  assert.equal(openSlots(body, ["Priya"]), 1);
  assert.equal(openSlots(body, ["Priya", "  "]), 1, "whitespace is not filled");
  assert.equal(renderFilled(body, ["Priya", "your SQL post"]), "Hi Priya, I saw your SQL post. Thanks.");
  assert.equal(slotCount("no blanks here"), 0);
});

test("specificity: generic vs specific", () => {
  const generic = scoreSpecificity("Thrilled to share my journey. Hard work pays off. Agree?");
  assert.equal(generic.label, "Reads generic");
  assert.ok(generic.flagged.length >= 2);
  const specific = scoreSpecificity(
    "I built a Power BI dashboard for the Pune college fest that tracked 40 sponsors and saved the team 6 hours a week. Fractal's analysts reviewed it in March and asked for 2 changes, which I shipped in 3 days using SQL and DAX.",
  );
  assert.equal(specific.label, "Specific");
  assert.equal(scoreSpecificity("").score, 0);
});

test("limits: per-visitor hourly caps return a clear message", () => {
  const req = (ip: string) => new Request("http://localhost/api", { headers: { "x-forwarded-for": ip } });
  for (let i = 0; i < 6; i++) assert.equal(checkLimits(req("10.0.0.1"), "generate"), null);
  assert.match(checkLimits(req("10.0.0.1"), "generate") ?? "", /a lot of requests this hour/);
  assert.equal(checkLimits(req("10.0.0.2"), "generate"), null, "another visitor is not affected");
});

test("schemas: input limits", () => {
  const ok = { goal: "job", targetRole: "Data analyst", background: "B.Com" };
  assert.equal(ProfileInput.safeParse(ok).success, true);
  assert.equal(ProfileInput.safeParse({ ...ok, targetRole: "x" }).success, false);
  assert.equal(ProfileInput.safeParse({ ...ok, currentProfile: "a".repeat(4001) }).success, false);
  const turns = Array.from({ length: 13 }, () => ({ q: "q", a: "a" }));
  assert.equal(InterviewRequest.safeParse({ profile: ok, turns }).success, false);
  assert.equal(InterviewRequest.safeParse({ profile: ok, turns: [{ q: "q", a: "a".repeat(1501) }] }).success, false);
  const times = { post: "09:00", comment: "12:30", message: "10:30" };
  assert.equal(PlanChatRequest.safeParse({ text: "a".repeat(501), counts: { posts: 1, comments: 2, messages: 3 }, times }).success, false);
  assert.equal(PlanChatRequest.safeParse({ text: "2 posts", counts: { posts: 1, comments: 2, messages: 3 }, times: { ...times, post: "25:00" } }).success, false);
  assert.equal(ConnectRequest.safeParse({ profile: ok, relationship: "stranger", text: "x", image: { media_type: "image/gif", data: "AAAA" } }).success, false);
});

test("prompts: every AI prompt treats user text as data", () => {
  for (const [name, p] of Object.entries({ INTERVIEW_SYSTEM, GENERATE_SYSTEM, PLAN_CHAT_SYSTEM, CONNECT_SYSTEM })) {
    assert.match(p, /data, not instructions/, name);
  }
});
