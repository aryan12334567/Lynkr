// Interview v2 in the browser save (build plan Part 1 check): old saves still load, v2 state survives
// a reload, malformed v2 data falls back safely, and the per-question answering time is capped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY, migrate } from "../lib/store";
import { activeSecsFor, EMPTY_V2, MAX_SECS_PER_QUESTION, migrateV2 } from "../lib/interview/client";

test("S1 a save from before v2 loads with an empty v2 state and keeps its work", () => {
  const old = {
    stage: "results",
    profile: null,
    turns: [{ q: "What did you build?", a: "A dashboard" }],
    facts: [{ id: "F1", kind: "project", text: "I built a dashboard", sourceTurnIds: [0], reviewStatus: "confirmed", useInDrafts: true }],
    result: null,
  };
  const s = migrate(old as never);
  assert.deepEqual(s.v2, EMPTY_V2);
  assert.equal(s.facts.length, 1);
  assert.equal(s.turns.length, 1);
});

test("S2 a v2 save mid-interview round-trips through JSON", () => {
  const v2 = {
    ...EMPTY_V2,
    bucket: "experienced",
    phase: "interview",
    importSource: "pdf",
    importText: "Headline: Analyst",
    answers: [{ qid: "A1", attempt: 0, text: "Data analyst at a bank", status: "answered" }],
    activeSecs: 95,
    startedAt: "2026-10-24T10:00:00.000Z",
    factMap: { "A1.0": ["F1"] },
  };
  const s = migrate(JSON.parse(JSON.stringify({ ...EMPTY, v2 })));
  assert.equal(s.v2.bucket, "experienced");
  assert.equal(s.v2.phase, "interview");
  assert.equal(s.v2.answers.length, 1);
  assert.equal(s.v2.activeSecs, 95);
  assert.deepEqual(s.v2.factMap, { "A1.0": ["F1"] });
});

test("S3 malformed v2 data falls back field by field", () => {
  const v = migrateV2({ bucket: "astronaut", phase: "summary", answers: "nope", rating: 9, activeSecs: -4, factMap: [], importSource: "fax" });
  assert.equal(v.bucket, null);
  assert.equal(v.phase, "bucket", "without a bucket the flow starts at the first screen");
  assert.deepEqual(v.answers, []);
  assert.equal(v.rating, null);
  assert.equal(v.activeSecs, 0);
  assert.deepEqual(v.factMap, {});
  assert.equal(v.importSource, null);
  assert.deepEqual(migrateV2(null), EMPTY_V2);
  assert.deepEqual(migrateV2("x"), EMPTY_V2);
});

test("S4 buckets not offered yet are not resumed", () => {
  assert.equal(migrateV2({ bucket: "founder", phase: "interview" }).bucket, null);
  assert.equal(migrateV2({ bucket: "networker", phase: "firstwin" }).phase, "firstwin");
});

test("S5 answering time per question is capped so a break doesn't count", () => {
  assert.equal(activeSecsFor(0, 30_000), 30);
  assert.equal(activeSecsFor(0, 3_600_000), MAX_SECS_PER_QUESTION);
  assert.equal(activeSecsFor(10_000, 5_000), 0);
});
