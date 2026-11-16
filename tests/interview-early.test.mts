// The first drafts can be taken early (audit P11): once one real piece of work is told, not before.
import { test } from "node:test";
import assert from "node:assert/strict";
import { canDraftEarly, FIRST_PROOF_QID, type Answer } from "../lib/interview/engine";

const a = (qid: string, status: Answer["status"], text: string, attempt = 0) => ({ qid, attempt, status, text }) as Answer;

test("the first drafts are offered once one real piece of work is told, not before, and not for a skipped answer", () => {
  assert.equal(canDraftEarly([]), false);
  assert.equal(canDraftEarly([a("A1", "answered", "Final-year B.Com"), a("B4", "answered", "Data analyst")]), false);
  assert.equal(canDraftEarly([a(FIRST_PROOF_QID, "skipped", "")]), false);
  assert.equal(canDraftEarly([a(FIRST_PROOF_QID, "answered", "   ")]), false);
  assert.equal(canDraftEarly([a(FIRST_PROOF_QID, "answered", "follow-up only", 1)]), false);
  assert.equal(canDraftEarly([a(FIRST_PROOF_QID, "answered", "I cleaned two years of fest survey data in Excel.")]), true);
});
