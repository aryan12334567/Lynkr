// Time to first value (audit dimension 2). Demo mode only. Walks the same path the outreach browser test walks, from the
// landing page to the first screen with usable drafts, and counts what a person has to do on the way: taps, fields typed
// into, and distinct questions or screens. The seconds are a script's, not a person's: read the counts, not the clock.
//   LYNKR_URL=http://localhost:3001 node scripts/measure-first-value.mjs
import { chromium } from "playwright-core";
import { reachResults } from "../tests/e2e-outreach-helpers.mjs";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome" });
const out = [];
for (const early of [false, true]) for (const width of [375, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 780 : 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__m = { taps: 0, fields: new Set(), headings: new Set(), chars: 0 };
    addEventListener("click", () => { window.__m.taps++; }, true);
    addEventListener("input", (e) => { const t = e.target; window.__m.fields.add(t.name || t.id || t.getAttribute("aria-label") || t.placeholder || "field"); }, true);
    setInterval(() => { const h = document.querySelector("main h1, main h2"); if (h?.textContent) window.__m.headings.add(h.textContent.trim().slice(0, 80)); }, 100);
  });
  const t0 = Date.now();
  await reachResults(page, BASE, { early });
  const m = await page.evaluate(() => ({ taps: window.__m.taps, fields: window.__m.fields.size, screens: [...window.__m.headings] }));
  out.push({ path: early ? "first drafts as soon as offered" : "every question first", width, taps: m.taps, fieldsTypedInto: m.fields, questionsOrScreens: m.screens.length, scriptSeconds: Math.round((Date.now() - t0) / 1000) });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify({ mode: "demo only; a script, not a person", runs: out }, null, 1));
