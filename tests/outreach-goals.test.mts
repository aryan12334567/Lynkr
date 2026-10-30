import { test } from "node:test";
import assert from "node:assert/strict";
import { GOALS, preselectGoals } from "../lib/outreach/goals";
import { PLAYBOOKS, playbookFor } from "../lib/outreach/playbooks";
import { composeDrafts } from "../lib/outreach/draft";

test("goals and playbooks cover all goals and relationships", () => {
 assert.equal(GOALS.length,10); assert.equal(PLAYBOOKS.length,30);
 assert.ok(GOALS.every(g => g.details.length <= 3));
 assert.deepEqual(preselectGoals(["job","clients"]),["job","clients"]);
 assert.notEqual(playbookFor("referral","stranger").intent,"referral");
});
test("offline drafts have no placeholders or fabricated shared history and fit a note", () => {
 for (const book of PLAYBOOKS) {
  const out = composeDrafts({ goal:book.goal,relationship:book.relationship,channel:"connection_note",name:"Asha",company:"Example",facts:[] });
  assert.equal(out.versions.length,2);
  for (const v of out.versions) { assert.ok(v.body.length <= 200); assert.doesNotMatch(v.body,/\[|\]|\{\{/); assert.doesNotMatch(v.body,/we met|our conversation/i); }
 }
});
