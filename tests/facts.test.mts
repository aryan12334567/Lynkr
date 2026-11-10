import { test } from "node:test";
import assert from "node:assert/strict";
import { factsFor } from "../lib/facts";
import { OUTREACH_ONLY_KINDS, FACT_KINDS, type StoryFact } from "../lib/schemas";

// One fact per kind, all confirmed and switched on for drafts.
const at = (n: number) => new Date(Date.UTC(2026, 9, n)).toISOString();
const fact = (id: string, kind: StoryFact["kind"], text: string, extra: Partial<StoryFact> = {}): StoryFact => ({
  id, kind, text, sourceTurnIds: [], reviewStatus: "confirmed", useInDrafts: true, updatedAt: at(1), ...extra,
});
const everyKind = FACT_KINDS.map((k, i) => fact(`K${i}`, k, `A ${k} fact about my work ${i}.`, { updatedAt: at(i + 1) }));
const kinds = (rows: { kind: string }[]) => rows.map(r => r.kind);

test("every use drops facts that are not confirmed or are switched off, whatever their kind", () => {
  const rows = [
    fact("A", "project", "I built a booking site for a studio."),
    fact("B", "project", "A candidate that is still under review.", { reviewStatus: "candidate" }),
    fact("C", "project", "Something the person excluded.", { reviewStatus: "excluded" }),
    fact("D", "project", "Confirmed but switched off for drafts.", { useInDrafts: false }),
  ];
  for (const use of ["post", "comment", "outreach", "first_win"] as const) assert.deepEqual(factsFor(use, rows).map(f => f.id), ["A"], use);
});

test("factsFor('post') never returns an outreach-only kind (Posts R12)", () => {
  const out = factsFor("post", everyKind);
  assert.ok(out.length > 0);
  for (const k of OUTREACH_ONLY_KINDS) assert.ok(!kinds(out).includes(k), `${k} must not reach a post`);
  assert.deepEqual(kinds(out).sort(), FACT_KINDS.filter(k => !OUTREACH_ONLY_KINDS.includes(k)).sort());
});

test("factsFor('post') returns the shape drafts use: id, kind and text only", () => {
  const [one] = factsFor("post", [fact("A", "project", "I built a booking site.", { confidence: { example: true, number: "none", iDid: true } })]);
  assert.deepEqual(one, { id: "A", kind: "project", text: "I built a booking site." });
});

test("factsFor('comment') keeps only public-safe kinds, newest first, at most 12 (Commenter KTD4)", () => {
  const many = Array.from({ length: 15 }, (_, i) => fact(`P${i}`, "project", `Project number ${i} that I shipped.`, { updatedAt: at(i + 1) }));
  const out = factsFor("comment", [...many, ...everyKind.filter(f => OUTREACH_ONLY_KINDS.includes(f.kind))]);
  assert.equal(out.length, 12);
  assert.deepEqual(out.slice(0, 3).map(f => f.id), ["P14", "P13", "P12"]);
  assert.ok(out.every(f => !OUTREACH_ONLY_KINDS.includes(f.kind)));
});

test("factsFor('comment') drops facts that mention something tied to a private job search", () => {
  const rows = [fact("A", "project", "I rebuilt the pricing page for Razorpay as a freelancer."), fact("B", "learning", "I learned that small tests catch most bugs.")];
  assert.deepEqual(factsFor("comment", rows, { avoid: ["razorpay", "  "] }).map(f => f.id), ["B"]);
  assert.deepEqual(factsFor("comment", rows).map(f => f.id).sort(), ["A", "B"]);
});

test("factsFor('outreach') allows private kinds, puts proof first, and holds at most 2", () => {
  const rows = [
    fact("L", "learning", "I learned to read a query plan."),
    fact("T", "target", "I want to work on data products."),
    fact("P", "project", "I built a sponsor tracker."),
    fact("E", "evidence", "It cut manual updates from two hours to ten minutes."),
  ];
  const out = factsFor("outreach", rows, { proof: ["project", "evidence"] });
  assert.deepEqual(out.map(f => f.id), ["P", "E"]);
  // Private kinds are allowed here, not filtered out, when nothing better exists.
  assert.deepEqual(factsFor("outreach", [rows[1]], { proof: ["project"] }).map(f => f.id), ["T"]);
});

test("factsFor('outreach') keeps this goal's answered detail in the second slot and ignores other goals' answers", () => {
  const rows = [
    fact("P", "project", "I built a sponsor tracker."),
    fact("E", "evidence", "It cut manual updates from two hours to ten minutes."),
    fact("D80", "goal_detail", "What kind of business? Software", { sourceQid: "goal_detail:buy_business:kind" }),
    fact("D00", "goal_detail", "What kind of role are you looking for? Internship", { sourceQid: "goal_detail:job:role" }),
  ];
  const out = factsFor("outreach", rows, { goal: "buy_business", proof: ["project", "evidence"] });
  assert.deepEqual(out.map(f => f.id), ["P", "D80"]);
  assert.ok(!out.some(f => f.id === "D00"), "an answer for another goal never reaches this draft");
  assert.deepEqual(factsFor("outreach", rows, { goal: "clients", proof: ["project", "evidence"] }).map(f => f.id), ["P", "E"]);
});

test("factsFor('first_win') returns proof kinds first, strongest first, and never a private kind", () => {
  const rows = [
    fact("L", "learning", "I learned to read a query plan."),
    fact("P1", "project", "I built a sponsor tracker.", { confidence: { example: true, number: "none", iDid: false } }),
    fact("T", "target", "I want to work on data products."),
    fact("E", "evidence", "It cut updates from two hours to ten minutes.", { confidence: { example: true, number: "measured", iDid: true } }),
    fact("O", "offer", "I can set up reporting for a small team.", { confidence: { example: false, number: "none", iDid: true } }),
  ];
  const out = factsFor("first_win", rows);
  assert.deepEqual(out.map(f => f.id), ["E", "P1"]);
  assert.ok(!factsFor("first_win", rows, { limit: 5 }).some(f => f.kind === "target"));
});

test("factsFor('first_win') uses other public kinds only when fewer than two proof facts exist", () => {
  const rows = [fact("L", "learning", "I learned to read a query plan."), fact("P", "project", "I built a sponsor tracker."), fact("T", "target", "A private target.")];
  assert.deepEqual(factsFor("first_win", rows).map(f => f.id), ["P", "L"]);
  assert.deepEqual(factsFor("first_win", [rows[0]]).map(f => f.id), ["L"]);
  assert.deepEqual(factsFor("first_win", []), []);
});

test("facts without a review status are treated as already confirmed (the browser sends only those)", () => {
  const sent = [{ id: "F1", kind: "project" as const, text: "I built a tracker." }, { id: "F2", kind: "target" as const, text: "A private target." }];
  assert.deepEqual(factsFor("post", sent).map(f => f.id), ["F1"]);
  assert.deepEqual(factsFor("outreach", sent).map(f => f.id).sort(), ["F1", "F2"]);
});
