// Part 4: the question screen's pure logic. Mirrors the server's validateAnswer so Save is only
// enabled for answers the server will accept, and the stuck ladder and way-out buttons follow the tags.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BANK, pick } from "../lib/interview/bank";
import { validateAnswer } from "../lib/interview/engine";
import type { StoryFact } from "../lib/schemas";
import { actionsFor, chipsFor, composeAnswer, confidenceHints, groupFacts, saveState, stuckPress, toggleChip } from "../components/v2/questionLogic";

const q = (id: string) => BANK.find((x) => x.id === id)!;

test("Skip only on sensitive, Later only on enrichment, Not sure yet otherwise", () => {
  assert.deepEqual(actionsFor("sensitive"), { skip: true, notSure: true, later: false });
  assert.deepEqual(actionsFor("core"), { skip: false, notSure: true, later: false });
  assert.deepEqual(actionsFor("enrichment"), { skip: false, notSure: false, later: true });
});

test("stuck ladder: rephrase, then examples, then park", () => {
  assert.deepEqual(stuckPress(0), { level: 1, park: false });
  assert.deepEqual(stuckPress(1), { level: 2, park: false });
  assert.deepEqual(stuckPress(2), { level: 2, park: true });
});

test("the unedited example can't be saved; an edit can", () => {
  const a1 = q("A1");
  const ex = pick(a1.example, "experienced");
  assert.equal(saveState(a1, "experienced", 0, [], ex).ok, false);
  assert.match(saveState(a1, "experienced", 0, [], ex).hint, /example/);
  assert.equal(saveState(a1, "experienced", 0, [], `${ex} I also lead hiring.`).ok, true);
  assert.equal(saveState(a1, "experienced", 0, [], "   ").ok, false);
});

test("every question: what Save allows, the server accepts", () => {
  for (const question of BANK) {
    for (const bucket of question.buckets) {
      const chips = chipsFor(question, bucket, 0);
      const picked = chips ? chips.options.slice(0, chips.multi ? 2 : 1) : [];
      const text = !chips || chips.withText ? "I set up the weekly sales review for 12 people myself." : "";
      assert.equal(saveState(question, bucket, 0, picked, text).ok, true, `${question.id} ${bucket}`);
      const answer = composeAnswer(chips, picked, text);
      assert.equal(validateAnswer(bucket, [], { qid: question.id, attempt: 0, status: "answered", text: answer }), null, `${question.id} ${bucket}: ${answer}`);
    }
  }
});

test("chips: multi toggles a set, single replaces; answers keep option order", () => {
  const c = { options: ["A", "B", "C"], multi: true };
  assert.deepEqual(toggleChip(c, ["A"], "C"), ["A", "C"]);
  assert.deepEqual(toggleChip(c, ["A", "C"], "A"), ["C"]);
  assert.deepEqual(toggleChip({ options: ["A", "B"] }, ["A"], "B"), ["B"]);
  assert.equal(composeAnswer(c, ["C", "A"], "  plus this "), "A, C, plus this");
  assert.equal(chipsFor(q("B1"), "fresher", 1), null, "follow-ups are free text");
});

test("chip-only questions need a pick", () => {
  const only = BANK.find((x) => x.chips && !pick(x.chips, x.buckets[0]).withText)!;
  assert.equal(saveState(only, only.buckets[0], 0, [], "").ok, false);
});

test("vault grouping hides excluded facts; confidence hints read plainly", () => {
  const f = (id: string, kind: StoryFact["kind"], reviewStatus: StoryFact["reviewStatus"]): StoryFact => ({ id, kind, text: id, sourceTurnIds: [], reviewStatus, useInDrafts: false });
  const g = groupFacts([f("F1", "project", "candidate"), f("F2", "project", "excluded"), f("F3", "goal", "confirmed")]);
  assert.deepEqual(g.map((x) => [x.kind, x.facts.map((y) => y.id)]), [["project", ["F1"]], ["goal", ["F3"]]].sort((a, b) => (a[0] === "project" ? -1 : b[0] === "project" ? 1 : 0)));
  assert.deepEqual(confidenceHints({ example: true, number: "estimate", iDid: true }), ["specific example", "estimate", "your own work"]);
  assert.deepEqual(confidenceHints(undefined), []);
});
