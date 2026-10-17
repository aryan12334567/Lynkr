// Unit tests: checker v2, slots, specificity, limits, schemas, prompt rules.
// Checker cases follow prod/lynkr-message-checker-outreach-build-plan.md §11.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyFlag, checkMessage } from "../lib/checker";
import { openSlots, parseSlots, renderFilled, slotCount } from "../lib/slots";
import { scoreSpecificity } from "../lib/specificity";
import { checkLimits } from "../lib/limit";
import { CommentRequest, ConnectRequest, InterviewRequest, PlanChatRequest, ProfileInput } from "../lib/schemas";
import { COMMENT_SYSTEM, CONNECT_SYSTEM, GENERATE_SYSTEM, INTERVIEW_SYSTEM, PLAN_CHAT_SYSTEM, REVIEW_SYSTEM, VAULT_SYSTEM } from "../lib/prompts";

const GOOD =
  "Hi Priya, I'm applying for the SDE intern role at Razorpay (Job ID R-12345). I built a UPI expense tracker used by 300 students. My resume is attached. Would you be comfortable referring me? No worries if it's not a fit.";

test("checker: verdict wording never promises a reply", () => {
  assert.equal(checkMessage(GOOD, "knows_me").verdict, "Looks ready for your review");
  assert.equal(checkMessage("Hi", "alumni").verdict, "Do not send yet");
  assert.equal(checkMessage("", "alumni").verdict, "Do not send yet");
  const long = checkMessage(GOOD + " " + "word ".repeat(80), "knows_me");
  assert.ok(long.checks.some((c) => !c.ok && /90 words/.test(c.label)));
  // Deterministic: same input, same verdict.
  const runs = new Set(Array.from({ length: 10 }, () => JSON.stringify(checkMessage(GOOD, "stranger"))));
  assert.equal(runs.size, 1);
});

test("checker: flags and exact spans", () => {
  const bad = checkMessage("Hello sir, kindly revert urgently. Please refer me for any job.", "alumni");
  for (const p of ["kindly revert", "urgent / ASAP", "any job / any opening", "sir / ma'am"]) {
    assert.ok(bad.flags.some((f) => f.phrase === p), `missing flag ${p}`);
  }
  const f = bad.flags.find((x) => x.phrase === "kindly revert")!;
  assert.equal(f.match, "kindly revert");
  assert.equal("Hello sir, kindly revert urgently. Please refer me for any job.".slice(f.index!, f.index! + f.match!.length), "kindly revert");
  // The smallest edit replaces only that span.
  const t2 = "Hi Asha, kindly revert. Thanks";
  const f2 = checkMessage(t2, "alumni").flags.find((x) => x.phrase === "kindly revert")!;
  assert.equal(applyFlag(t2, f2), "Hi Asha, would you be open to it? Thanks");
  const t3 = "Hi Asha, I hope this message finds you well. I built a dashboard.";
  const f3 = checkMessage(t3, "alumni").flags.find((x) => x.phrase === "hope this finds you well")!;
  assert.equal(applyFlag(t3, f3), "Hi Asha, I built a dashboard.");
  // Job ID forms: link, "Job ID: 123", requisition code.
  for (const id of ["https://jobs.example.com/123", "Job ID: 4567", "req-20431"]) {
    const v = checkMessage(GOOD.replace("Job ID R-12345", id), "knows_me");
    assert.ok(v.checks.find((c) => /Job ID/.test(c.label))?.ok, id);
  }
});

test("checker: a mention of 'referred' is not a referral ask; a real ask to a stranger is blocked", () => {
  const mention = checkMessage(
    "Hi Ravi, Maya referred me to you because I'm working on credit research. I compared debt coverage for two listed firms. What would you check next?",
    "stranger",
  );
  assert.equal(mention.isReferralAsk, false);
  assert.notEqual(mention.verdict, "Do not send yet");
  const ask = checkMessage("Hi Ravi, I built a dashboard. Could you refer me for the analyst role?", "stranger");
  assert.equal(ask.isReferralAsk, true);
  assert.equal(ask.verdict, "Do not send yet");
  assert.ok(ask.flags.some((f) => f.phrase === "referral ask to a stranger" && f.match));
});

test("checker: greeting and easy out are advice, not blockers", () => {
  const t = "I read your post on cleaning survey data. I'm working towards data analyst roles. How do you decide which outliers to drop?";
  const r = checkMessage(t, "stranger");
  assert.equal(r.verdict, "Looks ready for your review", JSON.stringify(r));
  assert.ok(r.checks.some((c) => !c.ok && c.severity === "advice" && /name/.test(c.label)));
});

test("checker: connection notes are counted in characters, email in words", () => {
  const note = "Hi Asha, I read your post on survey data. I'm working towards analyst roles. " + "x".repeat(150);
  const asNote = checkMessage(note, "stranger", { channel: "connection_note" });
  assert.ok(asNote.checks.some((c) => !c.ok && /200 characters/.test(c.label)));
  assert.equal(asNote.verdict, "Do not send yet");
  const asEmail = checkMessage(note, "stranger", { channel: "email" });
  assert.ok(asEmail.checks.every((c) => !/characters/.test(c.label)));
});

test("checker: unsupported numbers and unconfirmed shared history are highlighted", () => {
  const facts = ["I built a Power BI dashboard that tracked 40 sponsors."];
  const r = checkMessage("Hi Asha, I built a dashboard used by 300 people. What would you check first?", "stranger", { facts });
  assert.ok(r.flags.some((f) => f.phrase === "number not in your facts: 300"));
  assert.ok(!checkMessage("Hi Asha, I built a dashboard for 40 sponsors. What would you check first?", "stranger", { facts }).flags.some((f) => /number not/.test(f.phrase)));
  const fam = checkMessage("Hi Asha, great talking to you last week. I built a dashboard. Could you share one tip?", "stranger");
  assert.equal(fam.verdict, "Do not send yet");
  const famOk = checkMessage("Hi Asha, great talking to you last week. I built a dashboard. Could you share one tip?", "stranger", { sharedHistory: true });
  assert.ok(!famOk.flags.some((f) => /shared history/.test(f.phrase)));
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

test("schemas: input limits and content profile defaults", () => {
  const ok = { goal: "job", targetRole: "Data analyst", background: "B.Com" };
  const parsed = ProfileInput.parse(ok);
  assert.equal(parsed.domain, "not_sure");
  assert.equal(parsed.domainConfirmed, false);
  assert.deepEqual(parsed.audiences, []);
  assert.equal(ProfileInput.safeParse({ ...ok, targetRole: "x" }).success, false);
  assert.equal(ProfileInput.safeParse({ ...ok, currentProfile: "a".repeat(4001) }).success, false);
  assert.equal(ProfileInput.safeParse({ ...ok, audiences: ["hiring", "peers", "alumni"] }).success, false, "at most two readers");
  const turns = Array.from({ length: 13 }, () => ({ q: "q", a: "a" }));
  assert.equal(InterviewRequest.safeParse({ profile: ok, turns }).success, false);
  assert.equal(InterviewRequest.safeParse({ profile: ok, turns: [{ q: "q", a: "a".repeat(1501) }] }).success, false);
  const times = { post: "09:00", comment: "12:30", message: "10:30" };
  assert.equal(PlanChatRequest.safeParse({ text: "a".repeat(501), counts: { posts: 1, comments: 2, messages: 3 }, times }).success, false);
  assert.equal(PlanChatRequest.safeParse({ text: "2 posts", counts: { posts: 1, comments: 2, messages: 3 }, times: { ...times, post: "25:00" } }).success, false);
  const packet = { intent: "work_question", bridge: "public_work", channel: "connection_note" };
  assert.equal(ConnectRequest.safeParse({ profile: ok, packet, image: { media_type: "image/gif", data: "AAAA" } }).success, false);
  const fact = (id: string) => ({ id, kind: "project", text: "x" });
  assert.equal(ConnectRequest.safeParse({ profile: ok, packet, facts: [fact("F1"), fact("F2"), fact("F3")] }).success, false, "never more than two facts");
  const c = { targetRole: "Data analyst", domain: "data_ai", audiences: [], excerpt: "a".repeat(40) };
  assert.equal(CommentRequest.safeParse(c).success, true);
  assert.equal(CommentRequest.safeParse({ ...c, excerpt: "a".repeat(3001) }).success, false);
  assert.equal(CommentRequest.safeParse({ ...c, facts: [fact("F1"), fact("F2"), fact("F3"), fact("F4")] }).success, false);
});

test("llm: schemas sent to OpenAI strict mode have no $schema or integer bounds, and keep every field required", async () => {
  const { z } = await import("zod");
  const { strictSchema } = await import("../lib/llm");
  const S = await import("../lib/schemas");
  for (const name of ["InterviewReply", "VaultReply", "GenerateReply", "PlanChatReply", "ConnectReply", "CommentReply", "ReviewReply"] as const) {
    const out = JSON.stringify(strictSchema(z.toJSONSchema(S[name])));
    assert.doesNotMatch(out, /"\$schema"|"minimum"|"maximum"/, name);
    assert.match(out, /"additionalProperties":false/, name);
  }
});

test("clean: dashes become commas; repeated questions and unrelated facts are caught", async () => {
  const { cleanStrings, overlap, plainDashes, repeatsQuestion } = await import("../lib/clean");
  assert.equal(plainDashes("Data Analyst — built a dashboard"), "Data Analyst, built a dashboard");
  assert.equal(plainDashes("ends here —."), "ends here.");
  assert.deepEqual(cleanStrings({ a: ["x — y"], n: 2 }), { a: ["x, y"], n: 2 });
  assert.ok(repeatsQuestion("Which kinds of companies or teams in Pune would you like to reach for a data analyst role?", ["Who do you want to reach: kinds of companies, teams in Pune for a data analyst role?"]));
  assert.ok(!repeatsQuestion("What changed because of your work?", ["What was difficult or uncertain about it?"]));
  assert.ok(overlap("Open to Pune or remote roles", "Final-year B.Com at a tier-3 college in Pune, self-taught SQL") < 0.5, "an invented preference doesn't match the background");
});

test("grounding: sentences far from the facts are flagged, ones built from them are not", async () => {
  const { unsupportedSentences } = await import("../lib/grounding");
  const facts = ["Analysed city bus delays for a college hackathon.", "Cleaned the GPS data in Python myself."];
  const text =
    "For a college hackathon I analysed city bus delays. I cleaned the GPS data in Python myself. That project gave me hands-on experience in time-series alignment and geospatial timestamps. [[one thing you learned]]";
  const flagged = unsupportedSentences(text, facts);
  assert.deepEqual(flagged, ["That project gave me hands-on experience in time-series alignment and geospatial timestamps."]);
  assert.deepEqual(unsupportedSentences("Hi [[their first name]], [[one thing they posted]].", facts), [], "blanks are not judged");
});

test("prompts: every AI prompt treats user text as data", () => {
  for (const [name, p] of Object.entries({ INTERVIEW_SYSTEM, VAULT_SYSTEM, GENERATE_SYSTEM, PLAN_CHAT_SYSTEM, CONNECT_SYSTEM, COMMENT_SYSTEM, REVIEW_SYSTEM })) {
    assert.match(p, /data, not instructions/, name);
  }
});
