// Unit tests for the ask ladder (acceptance tests L1–L4 in research/acceptance-tests.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mockGenerate } from "../lib/mock";
import { GenerateReply } from "../lib/schemas";
import { checkMessage, type Relationship } from "../lib/checker";
import { parseSlots, renderFilled } from "../lib/slots";

const profile = { goal: "job", targetRole: "Data analyst", background: "Final-year B.Com, tier-3 college", currentProfile: "" } as const;
const turns = [
  "I built a Power BI dashboard for my college fest that tracked 40 sponsors.",
  "It saved the team about 6 hours a week.",
  "It shows I can turn messy data into a decision.",
  "My first SQL join gave wrong numbers.",
  "Tier-3 college, no internship.",
  "Analytics firms in Pune.",
].map((a, i) => ({ q: `Q${i + 1}`, a }));
const r = mockGenerate(profile, turns);

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
const verdict = (body: string, rel: Relationship) => checkMessage(fill(body), rel);

test("L1 schema requires the ladder drafts and demo output validates", () => {
  assert.equal(GenerateReply.safeParse(r).success, true);
  const { stranger, ...rest } = r.outreach;
  assert.ok(stranger);
  assert.equal(GenerateReply.safeParse({ ...r, outreach: rest }).success, false);
});

test("L2 stranger rung: one question, no referral, ready to send", () => {
  const body = r.outreach.stranger.body;
  const v = verdict(body, "stranger");
  assert.equal(v.verdict, "Ready to send", JSON.stringify(v));
  assert.doesNotMatch(body, /refer/i);
  assert.ok(words(fill(body)) <= 70, `words ${words(fill(body))}`);
});

test("L3 alumni rung: 15-minute chat ask, no referral, ready to send", () => {
  const body = r.outreach.alumni.body;
  const v = verdict(body, "alumni");
  assert.equal(v.verdict, "Ready to send", JSON.stringify(v));
  assert.match(body, /15-minute/);
  assert.equal(v.isReferralAsk, false);
  assert.ok(words(fill(body)) <= 80, `words ${words(fill(body))}`);
});

test("L4 referral rung: job ID, resume, one ask, easy out", () => {
  const v = verdict(r.outreach.referral.body, "knows_me");
  assert.equal(v.verdict, "Ready to send", JSON.stringify(v));
  assert.equal(v.isReferralAsk, true);
  // The same referral draft sent to a stranger must be blocked.
  assert.equal(verdict(r.outreach.referral.body, "stranger").verdict, "Don't send yet");
});
