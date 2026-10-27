// Read-back and first win (build plan Part 5): sections, fixing and removing lines, and that only
// confirmed facts switched on for drafts reach the first-win request.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyBrief } from "../lib/interview/engine";
import type { ProfileInput, StoryFact } from "../lib/schemas";
import {
  briefLines,
  draftFacts,
  factsBySection,
  firstWinBody,
  fixFact,
  isPrivateKind,
  removeFact,
  restoreFact,
  sectionOf,
  usedFacts,
} from "../components/v2/readbackLogic";

const fact = (id: string, kind: StoryFact["kind"], extra: Partial<StoryFact> = {}): StoryFact => ({
  id,
  kind,
  text: `${kind} text ${id}`,
  sourceTurnIds: [],
  reviewStatus: "candidate",
  useInDrafts: false,
  ...extra,
});

test("facts land in the right section", () => {
  assert.equal(sectionOf(fact("F1", "project")), "wins");
  assert.equal(sectionOf(fact("F2", "goal")), "want");
  assert.equal(sectionOf(fact("F3", "warm_path")), "people");
  assert.equal(sectionOf(fact("F4", "must_have")), "constraints");
  assert.equal(sectionOf(fact("F5", "contribution", { sourceQid: "A2" })), "who");
  assert.equal(sectionOf(fact("F6", "project", { reviewStatus: "excluded" })), "out");
  const g = factsBySection([fact("F1", "project"), fact("F2", "evidence"), fact("F3", "goal")]);
  assert.deepEqual(g.wins.map((f) => f.id), ["F1", "F2"]);
  assert.deepEqual(g.want.map((f) => f.id), ["F3"]);
  assert.equal(g.out.length, 0);
});

test("private kinds are marked", () => {
  for (const k of ["target", "goal", "target_company", "warm_path", "must_have"] as const) assert.ok(isPrivateKind(k), k);
  assert.ok(!isPrivateKind("offer"), "what you can offer may appear in public drafts");
  assert.ok(!isPrivateKind("project"));
});

test("fix changes the text and stamps it; empty text is refused", () => {
  const facts = [fact("F1", "project"), fact("F2", "evidence")];
  const fixed = fixFact(facts, "F1", "  I built   the dashboard ", "2026-10-24T00:00:00.000Z");
  assert.equal(fixed[0].text, "I built the dashboard");
  assert.equal(fixed[0].updatedAt, "2026-10-24T00:00:00.000Z");
  assert.equal(fixed[1], facts[1]);
  assert.equal(fixFact(facts, "F1", "   "), facts);
});

test("remove keeps a fact out of drafts, put back makes it a candidate again", () => {
  const facts = [fact("F1", "project", { reviewStatus: "confirmed", useInDrafts: true })];
  const removed = removeFact(facts, "F1");
  assert.equal(removed[0].reviewStatus, "excluded");
  assert.equal(removed[0].useInDrafts, false);
  assert.equal(sectionOf(removed[0]), "out");
  const back = restoreFact(removed, "F1");
  assert.equal(back[0].reviewStatus, "candidate");
  assert.equal(back[0].useInDrafts, false);
});

test("only confirmed facts switched on reach the first-win request", () => {
  const facts = [
    fact("F1", "project", { reviewStatus: "confirmed", useInDrafts: true }),
    fact("F2", "evidence", { reviewStatus: "candidate" }),
    fact("F3", "goal", { reviewStatus: "excluded" }),
    fact("F4", "learning", { reviewStatus: "confirmed", useInDrafts: false }),
  ];
  assert.deepEqual(draftFacts(facts).map((f) => f.id), ["F1"]);
  const many = Array.from({ length: 30 }, (_, i) => fact(`F${i + 1}`, "project", { reviewStatus: "confirmed", useInDrafts: true }));
  assert.equal(draftFacts(many).length, 20);
  const profile = { targetRole: "Data analyst" } as ProfileInput;
  assert.equal(firstWinBody(profile, facts).profile, profile);
  assert.deepEqual(Object.keys(firstWinBody(profile, facts).facts[0]).sort(), ["id", "kind", "text"]);
});

test("brief lines fill gaps but don't repeat a fact", () => {
  const b = { ...emptyBrief("experienced"), currentRole: "Analyst at a bank", targetRoles: "Product analyst", targetCompanies: "Razorpay", mustHaves: "Remote" };
  const none = briefLines(b, []);
  assert.ok(none.some((l) => l.section === "who" && l.text === "Analyst at a bank"));
  assert.ok(none.some((l) => l.label === "Roles"));
  assert.ok(none.some((l) => l.label === "Companies"));
  assert.ok(none.some((l) => l.section === "constraints" && l.label === "Search"));
  const withFacts = briefLines(b, [fact("F1", "goal"), fact("F2", "target_company"), fact("F3", "must_have")]);
  assert.ok(!withFacts.some((l) => ["Roles", "Companies", "Must-haves"].includes(l.label)));
});

test("used facts follow the draft's refs and skip unknown ids", () => {
  const facts = [fact("F1", "project"), fact("F2", "evidence")];
  assert.deepEqual(usedFacts(["F2", "F9", "F1"], facts).map((f) => f.id), ["F2", "F1"]);
});
