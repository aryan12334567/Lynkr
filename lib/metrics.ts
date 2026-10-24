import { z } from "zod";
import { bumpMetric, cloudReady, getDb } from "./db";
import { BUCKETS } from "./schemas";

/**
 * Count-only measurement (build plan Part 7): interviews started and finished, time taken,
 * core fields filled, how often the import was used, and the summary rating. No user id,
 * no answer text, no free text of any kind: the schema is strict, so extra fields are refused.
 */
export const EVENTS = ["interview_started", "interview_finished", "import_used", "summary_rated", "first_win_shown"] as const;
export type MetricEvent = (typeof EVENTS)[number];

export const SOURCES = ["pdf", "paste", "archive", "linkedin", "skip"] as const;

export const MetricInput = z
  .object({
    event: z.enum(EVENTS),
    bucket: z.enum(BUCKETS).optional(),
    /** Duration in seconds, core fields filled, or a 1 to 5 rating, depending on the event. */
    value: z.number().int().min(0).max(100_000).optional(),
    source: z.enum(SOURCES).optional(),
  })
  .strict();
export type MetricInput = z.infer<typeof MetricInput>;

/** Minutes, bucketed, so a median can be estimated from counts alone. */
export function durationLabel(seconds: number): string {
  const m = seconds / 60;
  if (m < 5) return "dur_0_5";
  if (m < 10) return "dur_5_10";
  if (m < 15) return "dur_10_15";
  if (m < 20) return "dur_15_20";
  return "dur_20_plus";
}

/** Writes one count to the logs and, when account storage is set up, to metric_counts. Never throws. */
export async function recordMetric(m: MetricInput): Promise<void> {
  const clean: MetricInput = MetricInput.parse(m);
  console.info(JSON.stringify({ lynkr_metric: { ...clean } }));
  try {
    if (!(await cloudReady())) return;
    const db = getDb();
    const label = clean.bucket ?? clean.source ?? "";
    await bumpMetric(db, clean.event, label, clean.value ?? 0);
    if (clean.event === "interview_finished" && typeof clean.value === "number") await bumpMetric(db, "interview_duration", durationLabel(clean.value), clean.value);
  } catch {
    // Measurement must never break the app.
  }
}
