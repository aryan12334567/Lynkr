// Ask ladder (acceptance tests L1–L4) on drafts built from confirmed facts only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mockGenerate } from "../lib/mock";
import { GenerateReply, ProfileInput, type FactRef } from "../lib/schemas";
import { checkMessage, type Relationship } from "../lib/checker";
import { parseSlots, renderFilled } from "../lib/slots";

const profile = ProfileInput.parse({ goal: "job", targetRole: "Data analyst", background: "Final-year B.Com, tier-3 college", stage: "final_year" });
const facts: FactRef[] = [
  { id: "F1", kind: "project", text: "I built a Power BI dashboard for my college fest that tracked 40 sponsors." },
  { id: "F2", kind: "evidence", text: "It saved the team about 6 hours a week." },
  { id: "F3", kind: "learning", text: "Messy data needs a row-count check before any chart." },
];
const r = mockGenerate(profile, facts);

/** Fill every blank with something plausible, as a user would. */
function fill(body: string): string {
  const values = parseSlots(body)
    .filter((s) => s.type === "slot")
    .map((s) => {
      const label = s.type === "slot" ? s.label : "";
      if (/name/.test(label)) return "Priya";
      if (/job ID/.test(label)) return "Job ID R-20431";
      if (/question/.test(label)) return "how did you pick your first dashboard metric";
      return "the Q3 churn analysis";
    });
  return renderFilled(body, values);
}
const words = (t: string) => t.trim().split(/\s+/).length;
const verdict = (body: string, rel: Relationship) => checkMessage(fill(body), rel, { facts: facts.map((f) => f.text) });

test("L1 schema requires the ladder drafts and demo output validates", () => {
  assert.equal(GenerateReply.safeParse(r).success, true);
  const { stranger, ...rest } = r.outreach;
  assert.ok(stranger);
  assert.equal(GenerateReply.safeParse({ ...r, outreach: rest }).success, false);
});

test("L2 stranger rung: one question, no referral, ready for review", () => {
  const body = r.outreach.stranger.body;
  const v = verdict(body, "stranger");
  assert.equal(v.verdict, "Looks ready for your review", JSON.stringify(v));
  assert.doesNotMatch(body, /refer/i);
  assert.ok(words(fill(body)) <= 70, `words ${words(fill(body))}`);
});

test("L3 alumni rung: 15-minute chat ask, no referral, ready for review", () => {
  const body = r.outreach.alumni.body;
  const v = verdict(body, "alumni");
  assert.equal(v.verdict, "Looks ready for your review", JSON.stringify(v));
  assert.match(body, /15-minute/);
  assert.equal(v.isReferralAsk, false);
  assert.ok(words(fill(body)) <= 80, `words ${words(fill(body))}`);
});

test("L4 referral rung: job ID, resume, one ask, easy out", () => {
  const v = verdict(r.outreach.referral.body, "knows_me");
  assert.equal(v.verdict, "Looks ready for your review", JSON.stringify(v));
  assert.equal(v.isReferralAsk, true);
  // The same referral draft sent to a stranger must be blocked.
  assert.equal(verdict(r.outreach.referral.body, "stranger").verdict, "Do not send yet");
});

test("drafts only reference submitted facts, and missing angles stay blank instead of generic", () => {
  const all = [...Object.values(r.outreach), ...r.posts, ...r.comments];
  for (const d of all) for (const id of d.factRefs) assert.ok(facts.some((f) => f.id === id), id);
  // No setback or observation fact was given: those posts are blanks, and say so.
  assert.match(r.posts[1].why, /no setback/i);
  assert.match(r.posts[2].why, /no first-hand observation/i);
  assert.ok(!/Agree\?|Thoughts\?/.test(r.posts.map((p) => p.body).join(" ")));
});
