// Phase 4 accessibility and phone checks (research/build-plan.md, tasks 4 and 5).
// Needs the dev server in demo mode on :3000 and Google Chrome installed.
// Run: node tests/e2e-a11y.mjs
import { chromium } from "playwright-core";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};
const TABS = ["Story Vault", "Profile fix", "Outreach", "Posts & comments", "This week", "Connect", "Check a message"];

const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "Asia/Kolkata" })).newPage();

/** Controls without an accessible name (no <label>, aria-label or aria-labelledby). */
const unlabelled = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")]
      .filter((el) => !(el.labels && el.labels.length) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby"))
      .map((el) => el.outerHTML.slice(0, 80)),
  );

try {
  await page.goto(BASE);

  // A1 (setup): keyboard only, from page load to the first interview question.
  const focusedLabel = () => page.evaluate(() => document.activeElement?.labels?.[0]?.innerText?.trim() ?? document.activeElement?.innerText?.trim() ?? "");
  let reached = false;
  for (let i = 0; i < 25 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = (await focusedLabel()).startsWith("Target role");
  }
  const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return `${s.outlineStyle} ${s.outlineWidth}`; });
  await page.keyboard.type("Data analyst");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Final-year B.Com, self-taught SQL");
  await page.keyboard.press("Tab"); // optional pasted profile
  await page.keyboard.press("Tab"); // submit button
  await page.keyboard.press("Enter");
  const started = await page.getByText("Question 1").waitFor({ timeout: 10000 }).then(() => true, () => false);
  check("A1 keyboard-only setup", reached && started, `reached role field ${reached}, interview started ${started}`);
  check("A2 visible focus", outline === "solid 2px", `focused field outline ${outline}`);

  // Interview by keyboard: type, Tab to "Send answer", Enter.
  for (let i = 0; i < 6; i++) {
    await page.getByText(`Question ${i + 1}`).waitFor();
    await page.getByPlaceholder(/Type/).focus();
    await page.keyboard.type(`Answer ${i + 1}: I built a report used by ${10 + i} people.`);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
  }
  await page.getByRole("tab", { name: "Story Vault" }).waitFor({ timeout: 15000 });
  check("A3 keyboard-only interview", true, "six answers sent with Tab + Enter");

  // A4: every form control on every tab has an accessible name.
  const missing = [];
  missing.push(...(await unlabelled()));
  for (const t of TABS) {
    await page.getByRole("tab", { name: t, exact: true }).click();
    if (t === "This week") await page.getByRole("button", { name: "Move" }).first().click();
    missing.push(...(await unlabelled()).map((m) => `${t}: ${m}`));
  }
  check("A4 labels", missing.length === 0, missing.slice(0, 3).join(" | ") || "all controls labelled");

  // A5: 375 px, every tab: no horizontal page scroll and the active tab is fully visible.
  await page.setViewportSize({ width: 375, height: 812 });
  const problems = [];
  for (const t of TABS) {
    const tab = page.getByRole("tab", { name: t, exact: true });
    await tab.click();
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    const box = await tab.boundingBox();
    if (overflow > 0) problems.push(`${t}: page overflows ${overflow}px`);
    if (!box || box.x < 0 || box.x + box.width > 375) problems.push(`${t}: tab off-screen`);
  }
  check("A5 375px", problems.length === 0, problems.join(" | ") || "7 tabs, no overflow, active tab visible");
} catch (e) {
  check("run", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
