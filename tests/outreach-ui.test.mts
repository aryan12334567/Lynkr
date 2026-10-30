import { test } from "node:test";
import assert from "node:assert/strict";
import { outreachVersion } from "../lib/outreach/flags";

test("outreach switch defaults to v1 except preview, and accepts overrides", () => {
 const env=process.env;
 try {
  process.env={...env}; delete process.env.LYNKR_OUTREACH; delete process.env.VERCEL_ENV;
  assert.equal(outreachVersion(),"v1"); process.env.VERCEL_ENV="preview"; assert.equal(outreachVersion(),"v2");
  process.env.LYNKR_OUTREACH="v1"; assert.equal(outreachVersion(),"v1");
  process.env.VERCEL_ENV="production"; process.env.LYNKR_OUTREACH="v2"; assert.equal(outreachVersion(),"v2");
 } finally {process.env=env;}
});
