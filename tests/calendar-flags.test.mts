// Calendar plan U10, KTD9: the LYNKR_CALENDAR switch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarVersion } from "../lib/calendar/flags";

function withEnv(env: Record<string, string | undefined>, run: () => void) {
  const keys = ["LYNKR_CALENDAR", "VERCEL_ENV"];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  for (const [k, v] of Object.entries(env)) if (v !== undefined) process.env[k] = v;
  try { run(); } finally { for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } }
}

test("production and local runs are v1 until the switch is set", () => {
  withEnv({}, () => assert.equal(calendarVersion(), "v1"));
  withEnv({ VERCEL_ENV: "production" }, () => assert.equal(calendarVersion(), "v1"));
});

test("a preview is v2 by default", () => {
  withEnv({ VERCEL_ENV: "preview" }, () => assert.equal(calendarVersion(), "v2"));
});

test("the switch wins over the environment, and anything else is ignored", () => {
  withEnv({ LYNKR_CALENDAR: "v1", VERCEL_ENV: "preview" }, () => assert.equal(calendarVersion(), "v1"));
  withEnv({ LYNKR_CALENDAR: "v2" }, () => assert.equal(calendarVersion(), "v2"));
  withEnv({ LYNKR_CALENDAR: " v2 " }, () => assert.equal(calendarVersion(), "v2"));
  for (const bad of ["", "2", "V2", "on", "true"]) withEnv({ LYNKR_CALENDAR: bad }, () => assert.equal(calendarVersion(), "v1", bad));
});
