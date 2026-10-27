// Part 7: count-only metrics. Valid events pass, anything that could carry personal data is refused,
// durations are bucketed for a median, and the log line has no personal data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { durationLabel, EVENTS, MetricInput, recordMetric } from "../lib/metrics";

test("valid events pass", () => {
  for (const event of EVENTS) assert.ok(MetricInput.safeParse({ event }).success, event);
  assert.ok(MetricInput.safeParse({ event: "interview_finished", bucket: "fresher", value: 780 }).success);
  assert.ok(MetricInput.safeParse({ event: "import_used", source: "pdf" }).success);
  assert.ok(MetricInput.safeParse({ event: "summary_rated", value: 4 }).success);
});

test("extra fields and free text are refused", () => {
  for (const extra of [{ answer: "I built a dashboard" }, { email: "a@example.test" }, { userId: "u1" }, { name: "Ananya" }]) {
    assert.equal(MetricInput.safeParse({ event: "interview_started", ...extra }).success, false, JSON.stringify(extra));
  }
  assert.equal(MetricInput.safeParse({ event: "made_up" }).success, false);
  assert.equal(MetricInput.safeParse({ event: "import_used", source: "my notes" }).success, false);
  assert.equal(MetricInput.safeParse({ event: "summary_rated", value: 2.5 }).success, false);
  assert.equal(MetricInput.safeParse({ event: "summary_rated", value: -1 }).success, false);
  assert.equal(MetricInput.safeParse({ event: "interview_started", bucket: "astronaut" }).success, false);
});

test("duration buckets", () => {
  assert.equal(durationLabel(0), "dur_0_5");
  assert.equal(durationLabel(299), "dur_0_5");
  assert.equal(durationLabel(300), "dur_5_10");
  assert.equal(durationLabel(14 * 60 + 59), "dur_10_15");
  assert.equal(durationLabel(15 * 60), "dur_15_20");
  assert.equal(durationLabel(20 * 60), "dur_20_plus");
});

test("recordMetric logs counts only", async () => {
  const prev = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const lines: string[] = [];
  const orig = console.info;
  console.info = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
  try {
    await recordMetric({ event: "interview_finished", bucket: "experienced", value: 812 });
  } finally {
    console.info = orig;
    if (prev !== undefined) process.env.DATABASE_URL = prev;
  }
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), { lynkr_metric: { event: "interview_finished", bucket: "experienced", value: 812 } });
  await assert.rejects(() => recordMetric({ event: "interview_started", answer: "secret" } as never));
});
