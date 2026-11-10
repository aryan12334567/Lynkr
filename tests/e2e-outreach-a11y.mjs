// Outreach v2 accessibility at 1280 and 375 px: keyboard-only use of goal setup, the person card and the drafts, a visible
// focus ring, and axe (WCAG 2 A and AA) with no serious or critical violations on each screen.
// Needs the server in demo mode with outreach v2: LYNKR_MOCK=1 LYNKR_OUTREACH=v2 LYNKR_PAYWALL=0.
// Run: LYNKR_URL=http://localhost:3001 node tests/e2e-outreach-a11y.mjs   (W=375 for the phone width only)
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { reachResults } from "./e2e-outreach-helpers.mjs";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const WIDTHS = process.env.W ? [Number(process.env.W)] : [1280, 375];
const axeScript = readFileSync("node_modules/axe-core/axe.min.js", "utf-8");

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};

/** Serious and critical axe violations on the page as it is now, as "rule (first element)". */
async function axeViolations(page) {
  await page.waitForTimeout(600); // let transitions finish: axe reads colours mid-fade otherwise
  await page.addScriptTag({ content: axeScript });
  return page.evaluate(async () => {
    const r = await window.axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
    return r.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => `${v.id} (${v.nodes[0]?.target?.join(" ") ?? "?"})`);
  });
}

/** Tab forward until the focused control's accessible name matches, up to `max` presses. Returns whether it was reached. */
async function tabTo(page, pattern, max = 60) {
  for (let i = 0; i < max; i++) {
    const name = await page.evaluate(() => {
      const a = document.activeElement;
      return a ? (a.getAttribute("aria-label") || a.innerText || a.getAttribute("value") || "").replace(/\s+/g, " ").trim() : "";
    });
    if (pattern.test(name)) return true;
    await page.keyboard.press("Tab");
  }
  return false;
}

/** The focused element draws a ring: a non-empty outline or a box shadow. */
const focusRing = (page) =>
  page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
  });

async function run(width) {
  const tag = width < 600 ? "375" : "1280";
  const id = (s) => `${tag} ${s}`;
  const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 900 }, timezoneId: "Asia/Kolkata", isMobile: width < 600, hasTouch: width < 600, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  try {
    await reachResults(page, BASE);
    await page.getByRole("tab", { name: "Outreach" }).click();
    await page.getByText("What do you want from LinkedIn?").waitFor({ timeout: 30000 });

    // Goal setup: a chip toggles from the keyboard, and Looks right is reachable and works.
    const v0 = await axeViolations(page);
    check(id("A1 goal setup: no serious axe violations"), v0.length === 0, v0.join(" | ").slice(0, 300));
    const referral = page.getByRole("button", { name: "Get a referral" });
    await referral.focus();
    const before = await referral.getAttribute("aria-pressed");
    await page.keyboard.press("Space");
    check(id("A2 a goal chip toggles with the keyboard"), (await referral.getAttribute("aria-pressed")) !== before);
    check(id("A3 the focused chip shows a focus ring"), await focusRing(page));
    check(id("A4 'Looks right' is reachable by Tab"), await tabTo(page, /^Looks right$/));
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "Your goals" }).waitFor({ timeout: 15000 });

    // People board and the person card, by keyboard.
    const person = page.getByRole("button", { name: /Priya Nair/ });
    await person.focus();
    await page.keyboard.press("Enter");
    await page.getByText("Goal for Priya Nair").waitFor({ timeout: 15000 });
    check(id("A5 a person is chosen with the keyboard"), (await person.getAttribute("aria-pressed")) === "true");

    // Writing: reach the Write button, run it, reach Copy and Mark sent.
    const channel = page.getByRole("button", { name: "Connection note" });
    await channel.focus();
    check(id("A6 'Write a message' is reachable by Tab"), await tabTo(page, /^Write a message$/, 12));
    check(id("A7 the focused Write button shows a focus ring"), await focusRing(page));
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: /^Version 1/ }).waitFor({ timeout: 30000 });
    check(id("A8 'Copy version 1' is reachable by Tab"), await tabTo(page, /^Copy version 1$/, 40));
    await page.keyboard.press("Enter");
    const announced = await page.getByRole("status").filter({ hasText: /Copied\./ }).first().waitFor({ timeout: 10000 }).then(() => true, () => false);
    check(id("A9 Copy is announced in a status region"), announced);
    check(id("A10 'Mark sent' is reachable by Tab"), await tabTo(page, /^Mark sent/, 12));

    // The whole workspace with a person and drafts on screen.
    const v = await axeViolations(page);
    check(id("A11 person card with drafts: no serious axe violations"), v.length === 0, v.join(" | ").slice(0, 300));

    // Connections list.
    await page.locator("input[type='file']").setInputFiles("tests/fixtures/connections.csv");
    await page.getByRole("list", { name: "Your connections, best match first" }).getByRole("listitem").first().waitFor({ timeout: 15000 });
    const v2 = await axeViolations(page);
    check(id("A12 with the connections list: no serious axe violations"), v2.length === 0, v2.join(" | ").slice(0, 300));

    await browser.close();
    return true;
  } catch (e) {
    check(id("FATAL"), false, e.message.split("\n")[0]);
    await browser.close();
    return false;
  }
}

let allPass = true;
for (const w of WIDTHS) {
  console.log(`\n=== Testing accessibility at ${w}px ===`);
  allPass = (await run(w)) && allPass;
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exit(allPass && results.every((r) => r.ok) ? 0 : 1);
