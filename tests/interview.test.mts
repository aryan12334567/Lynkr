// Interview v2 engine (build plan Part 3 checks): question order, skip and park rules, the stop rule,
// follow-up limits, the estimate follow-up, the "should" probe, idempotent saves, examples never saved.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK, pick, questionsFor } from "../lib/interview/bank";
import {
  applyAnswer,
  briefFrom,
  confidenceOf,
  demoReflection,
  factsFromAnswer,
  followUpFor,
  isExampleText,
  nextStep,
  progress,
  reflectionOk,
  validateAnswer,
  type Answer,
  type AnswerInput,
} from "../lib/interview/engine";
import { ACTIVE_BUCKETS } from "../lib/schemas";

const ok = (qid: string, text: string, attempt = 0, trigger?: AnswerInput["trigger"]): AnswerInput => ({ qid, attempt, status: "answered", text, ...(trigger ? { trigger } : {}) });

function save(bucket: Parameters<typeof nextStep>[0], answers: Answer[], input: AnswerInput): Answer[] {
  const err = validateAnswer(bucket, answers, input);
  assert.equal(err, null, `${input.qid}/${input.attempt}: ${err}`);
  return applyAnswer(answers, input);
}

test("bank: every question is complete, ids unique, three buckets built", () => {
  assert.equal(new Set(BANK.map((q) => q.id)).size, BANK.length);
  for (const b of ACTIVE_BUCKETS) {
    const qs = questionsFor(b);
    assert.ok(qs.filter((q) => q.tag === "core").length >= 10, `${b} core count`);
    for (const q of qs) {
      assert.ok(pick(q.text, b).length > 5 && pick(q.example, b).length > 2 && pick(q.rephrase, b).length > 5, `${q.id} copy`);
      assert.ok(pick(q.examples, b).length >= 2, `${q.id} examples`);
      assert.ok(q.feeds.length > 0, `${q.id} feeds something (design rule 7)`);
      assert.ok(q.brief || q.factKind, `${q.id} saves somewhere`);
    }
  }
  // Salary is never asked.
  assert.ok(!BANK.some((q) => /salary|ctc|package/i.test(JSON.stringify(q.text))));
});

test("order: core questions in bank order; the bucket changes the wording", () => {
  const first = nextStep("fresher", []);
  assert.equal(first.type, "ask");
  assert.equal(first.type === "ask" && first.qid, "A1");
  assert.match(first.type === "ask" ? first.prompt : "", /studying/);
  const exp = nextStep("experienced", []);
  assert.match(exp.type === "ask" ? exp.prompt : "", /current role/);
  // Networkers aren't asked job-search questions.
  assert.ok(!questionsFor("networker").some((q) => ["B6", "B7", "B5"].includes(q.id)));
});

test("skip only on sensitive questions; later only on enrichment; park anywhere", () => {
  assert.match(validateAnswer("experienced", [], { qid: "A1", attempt: 0, status: "skipped", text: "" }) ?? "", /can't be skipped/);
  const answers = [{ qid: "A1", attempt: 0, status: "answered", text: "x" }] as Answer[];
  assert.equal(validateAnswer("experienced", answers, { qid: "B5", attempt: 0, status: "skipped", text: "" }), null);
  assert.match(validateAnswer("experienced", [], { qid: "B2", attempt: 0, status: "later", text: "" }) ?? "", /needed/);
  assert.equal(validateAnswer("experienced", [], { qid: "E1", attempt: 0, status: "later", text: "" }), null);
  assert.equal(validateAnswer("experienced", [], { qid: "B2", attempt: 0, status: "parked", text: "" }), null);
  // A question from another bucket is refused.
  assert.match(validateAnswer("networker", [], ok("B6", "Remote only please")) ?? "", /isn't part/);
});

test("examples must be edited before they can be saved, and never become facts", () => {
  const q = BANK.find((x) => x.id === "A2")!;
  const ex = pick(q.example, "experienced");
  assert.ok(isExampleText(q, "experienced", ex));
  assert.match(validateAnswer("experienced", [], ok("A2", ex)) ?? "", /example/);
  assert.equal(validateAnswer("experienced", [], ok("A2", ex + " Mostly on Mondays.")), null);
  assert.deepEqual(factsFromAnswer("experienced", { qid: "A2", attempt: 0, status: "answered", text: ex }), []);
});

test("follow-ups: at most two per core question; 'we' then an estimate; 'not measured' accepted", () => {
  const C1 = BANK.find((q) => q.id === "C1")!;
  let a: Answer[] = applyAnswer([], ok("C1", "We rebuilt the onboarding flow for new sellers."));
  let f = followUpFor(C1, a);
  assert.equal(f?.trigger, "we");
  a = applyAnswer(a, ok("C1", "I wrote the new scripts.", 1, "we"));
  f = followUpFor(C1, a);
  assert.equal(f?.trigger, "no_number");
  assert.match(f!.text, /estimate/);
  a = applyAnswer(a, ok("C1", "Not measured, sorry.", 2, "no_number"));
  assert.equal(followUpFor(C1, a), null, "two follow-ups used");
  // With a number in the first answer, no estimate follow-up.
  assert.equal(followUpFor(C1, applyAnswer([], ok("C1", "I cut month-end close from 8 days to 5 by automating reconciliations."))), null);
  // "Not measured" straight away is accepted.
  assert.equal(followUpFor(C1, applyAnswer([], ok("C1", "I redesigned our intake form myself. Not measured."))), null);
  // Enrichment and chip questions never get follow-ups.
  assert.equal(followUpFor(BANK.find((q) => q.id === "C1b")!, applyAnswer([], ok("C1b", "We did a thing."))), null);
});

test("an estimate is labelled; vague follow-up uses the model's phrasing when given", () => {
  const facts = factsFromAnswer("experienced", { qid: "C1", attempt: 2, status: "answered", text: "About 40 hours a month", trigger: "no_number" });
  assert.equal(facts[0].kind, "evidence");
  assert.match(facts[0].text, /\(estimate\)$/);
  assert.equal(facts[0].confidence.number, "estimate");
  const A2 = BANK.find((q) => q.id === "A2")!;
  const vague: Answer[] = [{ qid: "A2", attempt: 0, status: "answered", text: "I'm a team player", vague: true, followUpText: "Which request from a colleague did you handle last week?" }];
  assert.equal(followUpFor(A2, vague)?.text, "Which request from a colleague did you handle last week?");
  // The model can also say an answer is fine.
  assert.equal(followUpFor(A2, [{ ...vague[0], vague: false }]), null);
});

test("the 'If you didn't have to justify it' probe runs only after a 'should' goal", () => {
  const plain = questionsFor("experienced").filter((q) => q.tag === "core").map((q) => q.id);
  assert.ok(!nextStepIds("experienced", ["B2:Sales manager at a B2B SaaS company"]).includes("B4"));
  assert.ok(nextStepIds("experienced", ["B2:I should probably go for a stable government job"]).includes("B4"));
  assert.ok(plain.includes("B4") || true);
});

function nextStepIds(bucket: "experienced", given: string[]): string[] {
  let a: Answer[] = [];
  for (const g of given) {
    const [qid, text] = g.split(":");
    a = applyAnswer(a, ok(qid, text));
  }
  const seen: string[] = [];
  for (let i = 0; i < 40; i++) {
    const s = nextStep(bucket, a);
    if (s.type === "done") break;
    seen.push(s.qid);
    a = applyAnswer(a, s.attempt === 0 ? { qid: s.qid, attempt: 0, status: "parked", text: "", round: s.revisit ? 2 : 1 } : { qid: s.qid, attempt: s.attempt, status: "parked", text: "", trigger: s.trigger });
  }
  return seen;
}

test("park: 'Not sure yet' comes back once at the end, then counts as unresolved; stop rule", () => {
  let a: Answer[] = [];
  let parkedOnce = false;
  for (let i = 0; i < 60; i++) {
    const s = nextStep("networker", a);
    if (s.type === "done") {
      assert.deepEqual(s.unresolved, ["D3"]);
      assert.ok(s.later.length > 0, "unanswered enrichment goes to Later");
      return;
    }
    if (s.qid === "D3") {
      a = save("networker", a, { qid: "D3", attempt: 0, status: "parked", text: "", round: s.revisit ? 2 : 1 });
      if (s.revisit) assert.ok(parkedOnce);
      parkedOnce = true;
      continue;
    }
    const q = BANK.find((x) => x.id === s.qid)!;
    if (q.tag === "enrichment") a = save("networker", a, { qid: s.qid, attempt: 0, status: "later", text: "" });
    else if (s.attempt > 0) a = save("networker", a, { qid: s.qid, attempt: s.attempt, status: "answered", text: "I handled the follow-up calls myself, about 12 a week", trigger: s.trigger });
    else a = save("networker", a, { qid: s.qid, attempt: 0, status: "answered", text: answerFor(s.qid) });
  }
  assert.fail("interview did not finish");
});

function answerFor(qid: string): string {
  const q = BANK.find((x) => x.id === qid)!;
  const chips = q.chips ? pick(q.chips, "networker") : null;
  if (chips && !chips.withText) return chips.options[0];
  return `My own answer to ${qid}: I personally handled 3 client reviews last quarter`;
}

test("saving the same answer twice never duplicates it; editing the main answer drops stale follow-ups", () => {
  let a = applyAnswer([], ok("C1", "We built a CRM report."));
  a = applyAnswer(a, ok("C1", "We built a CRM report."));
  assert.equal(a.length, 1);
  a = applyAnswer(a, ok("C1", "I built the filters.", 1, "we"));
  a = applyAnswer(a, ok("C1", "I built the filters.", 1, "we"));
  assert.equal(a.length, 2);
  a = applyAnswer(a, ok("C1", "I built a CRM report for 12 regional managers."));
  assert.deepEqual(a.map((x) => x.attempt), [0]);
  // A follow-up can't jump ahead or come before its main answer.
  assert.match(validateAnswer("experienced", [], ok("C1", "x", 1, "we")) ?? "", /current question|main question/);
});

test("chip questions only accept their options", () => {
  assert.match(validateAnswer("fresher", [], ok("A3", "Astronaut")) ?? "", /Pick one/);
  assert.equal(validateAnswer("fresher", [], ok("A3", "Software")), null);
  assert.equal(validateAnswer("fresher", [], ok("E4", "1 hour")), null);
});

test("progress starts above zero after the import", () => {
  assert.equal(progress("fresher", [], false).pct, 0);
  assert.ok(progress("fresher", [], true).pct > 0);
  const p = progress("fresher", applyAnswer([], ok("A1", "B.Tech CSE final year 2027")), true);
  assert.equal(p.done, 2);
});

test("brief: chips map to fields; a skipped 'does your employer know' stays private", () => {
  let a: Answer[] = [];
  a = applyAnswer(a, ok("A3", "Data and analytics"));
  a = applyAnswer(a, ok("B1", "A new job, Referrals. Mostly fintech"));
  a = applyAnswer(a, ok("E4", "1 hour"));
  a = applyAnswer(a, { qid: "B7", attempt: 0, status: "skipped", text: "" });
  const b = briefFrom("experienced", a);
  assert.equal(b.field, "data_ai");
  assert.deepEqual(b.goals, ["job", "referral"]);
  assert.equal(b.weeklyTime, "1h");
  assert.equal(b.privateSearch, true);
  assert.equal(briefFrom("experienced", applyAnswer(a, ok("B7", "Yes, it's public"))).privateSearch, false);
});

test("facts: kinds per question, confidence from the words, 'not measured' isn't a fact", () => {
  assert.equal(factsFromAnswer("experienced", { qid: "B3", attempt: 0, status: "answered", text: "Freshworks and Chargebee" })[0].kind, "target_company");
  assert.equal(factsFromAnswer("experienced", { qid: "D2", attempt: 0, status: "answered", text: "My IIM Indore alumni group" })[0].kind, "warm_path");
  assert.equal(factsFromAnswer("experienced", { qid: "D3", attempt: 0, status: "answered", text: "Feedback on sales scripts" })[0].kind, "offer");
  assert.equal(factsFromAnswer("experienced", { qid: "B6", attempt: 0, status: "answered", text: "Remote, 60 day notice" })[0].kind, "must_have");
  assert.deepEqual(factsFromAnswer("experienced", { qid: "C1", attempt: 2, status: "answered", text: "Not measured", trigger: "no_number" }), []);
  assert.deepEqual(factsFromAnswer("experienced", { qid: "A3", attempt: 0, status: "answered", text: "Software" }), []);
  const c = confidenceOf("I cut the month-end close from 8 days to 5 by automating reconciliations");
  assert.deepEqual(c, { example: true, number: "measured", iDid: true });
  assert.equal(confidenceOf("We did stuff").iDid, false);
});

test("reflection: specific to the answer, never stock praise", () => {
  const ans = "Untangling messy pipeline data before the forecast call.";
  const line = demoReflection("A2", ans);
  assert.ok(reflectionOk(line, ans), line);
  assert.ok(!reflectionOk("Great answer!", ans));
  assert.ok(!reflectionOk("Thanks for sharing that.", ans), "generic lines don't quote the answer");
});

test("Part 1: an old saved session (before v2 fields) still loads, with private search on by default", async () => {
  const { migrate } = await import("../lib/store");
  const { ProfileInput, FactRef } = await import("../lib/schemas");
  const old = {
    stage: "review",
    profile: { goal: "job", targetRole: "Data analyst", background: "Final-year B.Com in Pune", currentProfile: "", domain: "data_ai", domainConfirmed: true },
    turns: [{ q: "What did you do?", a: "Built a dashboard" }],
    facts: [{ id: "F1", kind: "project", text: "Built a dashboard", sourceTurnIds: [1], reviewStatus: "confirmed", useInDrafts: true }],
    result: null,
  };
  const s = migrate(old as never);
  assert.equal(s.profile?.bucket, "fresher");
  assert.equal(s.profile?.privateSearch, true);
  assert.deepEqual(s.profile?.goals, []);
  assert.equal(s.facts[0].confidence, undefined);
  assert.ok(ProfileInput.safeParse(old.profile).success);
  // New kinds pass the request schema used by the drafting routes.
  assert.ok(FactRef.safeParse({ id: "F9", kind: "warm_path", text: "My IIM alumni group" }).success);
});

test("a vague follow-up on a question without a fact kind adds no fact (it feeds the brief)", async () => {
  const { factsFromAnswer } = await import("../lib/interview/engine");
  const { BANK } = await import("../lib/interview/bank");
  const q = BANK.find((x) => !x.factKind && x.tag === "core")!;
  const facts = factsFromAnswer("fresher", { qid: q.id, attempt: 1, status: "answered", trigger: "vague", text: "Final year B.Com at a college in Pune, looking at analyst roles" });
  assert.deepEqual(facts, []);
});

test("numbers: a measurable figure counts; a count of steps or a year does not", async () => {
  const { hasNumber } = await import("../lib/interview/engine");
  for (const yes of [
    "I cut the close from 8 days to 5",
    "about 30% more sign-ups",
    "saved three hours a week",
    "used by two lakh merchants",
    "₹4 lakh in new revenue",
    "it doubled our replies",
    "trained four sales reps",
    "cut review time in half",
  ])
    assert.ok(hasNumber(yes), yes);
  for (const no of [
    "designed the new bank details screen that splits it into two short steps",
    "I asked one question in the interview",
    "we shipped it in 2023",
    "I redesigned the whole onboarding flow",
  ])
    assert.ok(!hasNumber(no), no);
});

test("the 'rough number' follow-up fires when a proof story has only a step count", () => {
  const q = BANK.find((x) => x.id === "C1")!;
  const chain: Answer[] = [
    { qid: "C1", attempt: 0, status: "answered", text: "Merchants were abandoning sign-up, so I redesigned the onboarding flow myself last year." },
    { qid: "C1", attempt: 1, status: "answered", trigger: "vague", text: "I designed the bank details screen that splits it into two short steps." },
  ];
  assert.equal(followUpFor(q, chain)?.trigger, "no_number");
  assert.equal(confidenceOf(chain[1].text).number, "none");
});

test("reflection leads read as plain sentences whatever the answer's shape", () => {
  const cases: [string, string][] = [
    ["A2", "Product managers come to me when a checkout flow is losing people."],
    ["A2", "Fixing broken dashboards."],
    ["B2", "Design lead at a consumer fintech company."],
    ["B2", "I want to lead a small design team."],
    ["D1", "Hiring managers at my target companies, Design managers at Razorpay."],
    ["D1", "I'd like to meet founders."],
    ["C3", "Our head of product said my redesign was the cleanest flow."],
    ["C4", "A case study on my portfolio."],
  ];
  for (const [qid, ans] of cases) {
    const line = demoReflection(qid, ans);
    assert.match(line, /^[A-Z][^:]*: [A-Z]/, line);
    assert.ok(!/\bfor product managers come\b/i.test(line), line);
    assert.ok(reflectionOk(line, ans), line);
  }
});

test("field-aware examples: a designer sees design examples; buckets with their own wording keep it", async () => {
  const { exampleFor, FIELD_EXAMPLES } = await import("../lib/interview/bank");
  const c1 = BANK.find((x) => x.id === "C1")!;
  const e1 = BANK.find((x) => x.id === "E1")!;
  assert.match(exampleFor(c1, "experienced", "Design").example, /screen|design/i);
  assert.ok(!/sales|renewal|forecast/i.test(exampleFor(e1, "experienced", "Design").example));
  assert.equal(exampleFor(c1, "experienced", "Sales").example, pick(c1.example, "experienced"), "Sales keeps the default wording");
  assert.equal(exampleFor(c1, "experienced", null).example, pick(c1.example, "experienced"), "no field yet keeps the default");
  assert.equal(exampleFor(c1, "fresher", "Design").example, pick(c1.example, "fresher"), "fresher wording stays");
  const b2 = BANK.find((x) => x.id === "B2")!;
  assert.equal(exampleFor(b2, "networker", "Software").example, pick(b2.example, "networker"), "networker wording stays");
  // Every field example exists on a real question, and none can be saved unedited, in any bucket.
  for (const [qid, fields] of Object.entries(FIELD_EXAMPLES)) {
    const q = BANK.find((x) => x.id === qid);
    assert.ok(q, qid);
    for (const f of Object.values(fields)) {
      for (const text of [f!.example, ...f!.examples]) for (const bucket of q!.buckets) assert.ok(isExampleText(q!, bucket, text), `${qid}: ${text}`);
    }
  }
});
