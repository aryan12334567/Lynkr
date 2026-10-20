// Accessibility and phone checks: keyboard-only flow, visible focus, labels on every control, 375 px.
// Needs the dev server in demo mode on :3000 and Google Chrome installed. Run: node tests/e2e-a11y.mjs
import { chromium } from "playwright-core";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};
const TABS = ["Today", "Story Vault", "Profile fix", "Outreach", "Posts & comments", "This week", "Connect", "Check a message"];

const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "Asia/Kolkata" })).newPage();

/** Controls without an accessible name (no <label>, aria-label or aria-labelledby). */
const unlabelled = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("input, textarea, select")]
      .filter((el) => !(el.labels && el.labels.length) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby"))
      .map((el) => el.outerHTML.slice(0, 80)),
  );
const focusedName = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    return (el?.labels?.[0]?.innerText ?? el?.getAttribute("aria-label") ?? el?.innerText ?? "").trim();
  });

try {
  await page.goto(BASE);
  // Keyboard: Tab to "Start" on the landing page and press Enter.
  await page.getByRole("button", { name: "Start", exact: true }).first().waitFor();
  let onStart = false;
  for (let i = 0; i < 10 && !onStart; i++) {
    await page.keyboard.press("Tab");
    onStart = (await focusedName()).startsWith("Start");
  }
  await page.keyboard.press("Enter");
  await page.getByLabel("Target role").waitFor();

  // A1 (setup): keyboard only, from page load to the first interview question.
  let reached = false;
  for (let i = 0; i < 25 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = (await focusedName()).startsWith("Target role");
  }
  const outline = await page.evaluate(() => {
    const s = getComputedStyle(document.activeElement);
    return `${s.outlineStyle} ${s.outlineWidth}`;
  });
  await page.keyboard.type("Data analyst");
  let onBackground = false;
  for (let i = 0; i < 5 && !onBackground; i++) {
    await page.keyboard.press("Tab");
    onBackground = (await focusedName()).startsWith("Your background");
  }
  await page.keyboard.type("Final-year B.Com, self-taught SQL");
  let onSubmit = false;
  for (let i = 0; i < 20 && !onSubmit; i++) {
    await page.keyboard.press("Tab");
    onSubmit = (await focusedName()) === "Start the interview";
  }
  await page.keyboard.press("Enter");
  const started = await page.getByText("Question 1").waitFor({ timeout: 10000 }).then(() => true, () => false);
  check("A1 keyboard-only setup", reached && onBackground && onSubmit && started, `role ${reached}, background ${onBackground}, submit ${onSubmit}, interview ${started}`);
  check("A2 visible focus", outline === "solid 2px", `focused field outline ${outline}`);

  // Interview by keyboard: type, Tab to "Send answer", Enter, until the review screen.
  let answers = 0;
  for (let i = 0; i < 12; i++) {
    // Either the review screen, or question n with its answer box loaded.
    const done = await page
      .waitForFunction(
        (n) =>
          [...document.querySelectorAll("h2")].some((h) => h.textContent === "Check your facts") ||
          (document.body.innerText.includes(`Question ${n}`) && !!document.querySelector("textarea#answer")),
        i + 1,
        { timeout: 15000 },
      )
      .then(() => page.getByRole("heading", { name: "Check your facts" }).count());
    if (done) break;
    await page.getByPlaceholder(/Type/).focus();
    await page.keyboard.type(`Answer ${i + 1}: I built a report myself, used by ${10 + i} people.`);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    answers++;
  }
  await page.getByRole("heading", { name: "Check your facts" }).waitFor({ timeout: 15000 });
  // Review by keyboard: confirm all, then write.
  await page.getByRole("button", { name: /Confirm all/ }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Write my drafts" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("tab", { name: "Story Vault" }).waitFor({ timeout: 15000 });
  check("A3 keyboard-only interview and review", answers >= 6, `${answers} answers sent with Tab + Enter, facts confirmed by keyboard`);

  // A4: every form control on every tab has an accessible name.
  const missing = [];
  missing.push(...(await unlabelled()));
  for (const t of TABS) {
    await page.getByRole("tab", { name: t, exact: true }).click();
    if (t === "This week") await page.getByRole("button", { name: "Move" }).first().click();
    if (t === "Connect") await page.getByText("Paste from their profile or a screenshot (optional)").click();
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
  check("A5 375px", problems.length === 0, problems.join(" | ") || "8 tabs, no overflow, active tab visible");
} catch (e) {
  check("run", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
