// Calendar v2, Stage 1, in a real browser at 1280 and 375 px: the week screen shows why the week looks as it does, the
// progress moves when a slot is marked done, and a person without an account is told how to keep a streak.
// Needs the server in demo mode with the calendar on: LYNKR_MOCK=1 LYNKR_CALENDAR=v2 LYNKR_PAYWALL=0 (no database).
// A signed-in person's plan in the account needs a database; that path is covered by tests/calendar-plan-store.test.mts.
// Run: LYNKR_URL=http://localhost:3001 node tests/e2e-calendar.mjs   (W=375 for the phone width only)
//      LYNKR_EXPECT=v1 ... against a server with LYNKR_CALENDAR=v1 checks that the old screen is unchanged.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { reachResults } from "./e2e-outreach-helpers.mjs";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const V1 = process.env.LYNKR_EXPECT === "v1";
const WIDTHS = process.env.W ? [Number(process.env.W)] : [1280, 375];
const axeScript = readFileSync("node_modules/axe-core/axe.min.js", "utf-8");

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};

async function run(width) {
  const tag = width < 600 ? "375" : "1280";
  const id = (s) => `${tag} ${s}`;
  const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 900 }, timezoneId: "Asia/Kolkata", isMobile: width < 600, hasTouch: width < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(401|409|503)/.test(m.text()) && errors.push(m.text()));
  try {
    await reachResults(page, BASE);
    await page.getByRole("tab", { name: "This week" }).click();
    await page.getByRole("heading", { name: /^Week of / }).waitFor({ timeout: 20000 });
    const main = page.locator("main");

    if (V1) {
      const text = await main.innerText();
      check(id("C0 v1: the week screen has no why line, progress or streak"), !/a week:|so far|keep going|Your first week|Sign in to keep your plan/.test(text) && !/Job seeker|Visibility builder|Freelancer/.test(text));
    } else {
      // R10, R11: a student looking for a job. The interview helper picks the first weekly-time option, 15 minutes.
      const why = page.getByText(/^Job seeker, 15 minutes a week:/);
      await why.waitFor({ timeout: 15000 });
      const whyText = (await why.innerText()).trim();
      check(id("C1 the why line names the family, the time and the counts"), whyText === "Job seeker, 15 minutes a week: 2 messages (outreach first), 1 comment to warm your targets.", whyText);
      check(id("C2 the header counts agree with the why line"), /2 messages, 1 comment, 0 posts/.test(await page.getByRole("heading", { name: /^Week of / }).innerText()));

      // R18, AE4: progress moves when a slot is marked done, and never shames.
      const status = page.getByRole("status").filter({ hasText: /of 3/ });
      check(id("C3 progress starts at 0 of 3 and says keep going"), (await status.first().innerText()).trim() === "0 of 3 — keep going");
      await page.getByRole("button", { name: "Schedule", exact: true }).first().click();
      await page.getByRole("button", { name: /^Mark (sent|posted)/ }).first().click();
      check(id("C4 marking one slot done moves progress to 1 of 3"), (await status.first().innerText()).trim() === "1 of 3 — keep going");
      const shaming = /fail|miss|behind|lazy|only/i.test(await status.first().innerText());
      check(id("C5 the progress line never shames"), !shaming);

      // R22: without an account the plan stays in the browser and the person is told what an account adds.
      check(id("C6 no account: told how to keep the plan on every device and build a streak"), (await page.getByText(/Sign in to keep your plan on every device and to build a streak/).count()) === 1);

      // R12: a plan the person changed says so and names no rule.
      await page.getByLabel("Change this week").fill("2 posts and 1 comment and no messages");
      await page.getByRole("button", { name: "Update plan" }).click();
      await page.getByText(/^Changed by you:/).waitFor({ timeout: 15000 });
      const changed = (await page.getByText(/^Changed by you:/).innerText()).trim();
      check(id("C7 a week changed by chat says 'Changed by you' and names no rule"), !/Job seeker/.test(changed), changed);

      // Reload: the plan and its why line come back from the browser.
      await page.reload();
      await page.getByRole("tab", { name: "This week" }).click();
      await page.getByText(/^Changed by you:/).waitFor({ timeout: 20000 });
      check(id("C8 the changed week survives a reload and the rules do not overwrite it"), true);

      // Accessibility of the week screen.
      await page.waitForTimeout(600);
      await page.addScriptTag({ content: axeScript });
      const v = await page.evaluate(async () => {
        const r = await window.axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
        return r.violations.filter((x) => x.impact === "critical" || x.impact === "serious").map((x) => `${x.id} (${x.nodes[0]?.target?.join(" ") ?? "?"})`);
      });
      check(id("C9 the week screen has no serious axe violations"), v.length === 0, v.join(" | ").slice(0, 300));
    }
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(id("C10 no horizontal overflow"), over <= 1, `${over}px`);
    check(id("C11 no JS errors"), errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 250));
    await browser.close();
    return true;
  } catch (e) {
    check(id("FATAL"), false, e.message.split("\n")[0]);
    if (process.env.LYNKR_DEBUG) console.log((await page.locator("main").innerText().catch(() => "")).slice(0, 700));
    await browser.close();
    return false;
  }
}

let allPass = true;
for (const w of WIDTHS) {
  console.log(`\n=== Calendar at ${w}px${V1 ? " (v1)" : ""} ===`);
  allPass = (await run(w)) && allPass;
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exit(allPass && results.every((r) => r.ok) ? 0 : 1);
