"use client";

import type { MetricEvent } from "./metrics";
import type { Bucket } from "./schemas";

/**
 * Send one count-only event (see lib/metrics.ts). Fire and forget: never throws, never waits,
 * and survives the page closing (keepalive). Only the fields below are accepted by the server.
 */
export function track(event: MetricEvent, props: { bucket?: Bucket; value?: number; source?: "pdf" | "paste" | "archive" | "linkedin" | "skip" } = {}): void {
  try {
    const body = JSON.stringify({ event, ...props, ...(typeof props.value === "number" ? { value: Math.max(0, Math.round(props.value)) } : {}) });
    void fetch("/api/metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // Measurement must never break the app.
  }
}
