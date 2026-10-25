// Demo drafts (lib/mock.ts) for interview v2: a private search never reaches a public draft,
// outreach-only facts stay out of public drafts, and headlines are whole phrases, never cut mid-sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { currentRolePhrase, headlinePhrase, mockGenerate } from "../lib/mock";
import { ProfileInput, type FactRef } from "../lib/schemas";

const TARGET = "Design lead at a consumer fintech company, leading two or three designers";
const base = {
  goal: "job",
  targetRole: TARGET,
  background: "5 to 8 years, Senior Product Designer at Paylane, a fintech app for small merchants. People come to me for: checkout flows",
  bucket: "experienced",
} as const;
const facts: FactRef[] = [
  { id: "F1", kind: "target", text: TARGET },
  { id: "F2", kind: "target_company", text: "Razorpay, CRED, Jupiter" },
  { id: "F3", kind: "project", text: "Merchants were abandoning sign-up at the bank details step, so we redesigned the whole onboarding flow and shipped it last year." },
  { id: "F4", kind: "evidence", text: "Our head of product said my onboarding redesign was the cleanest flow we have shipped." },
];

const publicText = (r: ReturnType<typeof mockGenerate>) => [...r.profile.headlines, r.profile.about, ...r.posts.map((p) => p.body)].join("\n");

test("private search: no target role, target company or outreach-only fact in any public draft", () => {
  const r = mockGenerate(ProfileInput.parse({ ...base, privateSearch: true }), facts);
  const pub = publicText(r);
  assert.ok(!pub.includes("Design lead"), pub);
  assert.ok(!/Razorpay|CRED|Jupiter/.test(pub), pub);
  assert.match(r.profile.headlines[0], /^Senior Product Designer at Paylane \| /);
});

test("headlines are whole phrases: no '…' or '...' fragments", () => {
  for (const privateSearch of [true, false]) {
    const r = mockGenerate(ProfileInput.parse({ ...base, privateSearch }), facts);
    for (const h of r.profile.headlines) assert.ok(!/…|\.\.\./.test(h), h);
  }
});

test("public search may name the target role; outreach may always use it", () => {
  const pub = mockGenerate(ProfileInput.parse({ ...base, privateSearch: false }), facts);
  assert.ok(pub.profile.headlines.some((h) => h.includes("Design lead")));
  const priv = mockGenerate(ProfileInput.parse({ ...base, privateSearch: true }), facts);
  assert.ok(priv.outreach.stranger.body.includes("Design lead"), "outreach is private and may mention the target");
});

test("v1 profiles (fresher bucket by default) keep their target-role headlines", () => {
  const r = mockGenerate(ProfileInput.parse({ goal: "job", targetRole: "Data analyst", background: "Final-year B.Com, Pune" }), [
    { id: "F1", kind: "project", text: "I built a Power BI dashboard for 40 sponsors." },
  ]);
  assert.match(r.profile.headlines[0], /^Data analyst \| I built a Power BI dashboard for 40 sponsors$/);
  assert.match(r.profile.about, /working towards Data analyst roles/);
});

test("currentRolePhrase and headlinePhrase", () => {
  assert.equal(currentRolePhrase(ProfileInput.parse({ ...base })), "Senior Product Designer at Paylane");
  assert.equal(currentRolePhrase(ProfileInput.parse({ ...base, background: "Not given yet" })), "");
  assert.equal(headlinePhrase(facts[2], 60), "Merchants were abandoning sign-up at the bank details step");
  assert.equal(headlinePhrase({ id: "F9", kind: "project", text: "x ".repeat(80) }, 40), null);
});
