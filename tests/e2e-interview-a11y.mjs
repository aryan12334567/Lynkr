// Interview v2 accessibility (acceptance test I23): keyboard-only answering, visible focus, a name on every
// control, live regions, the progress bar's values, and 44 px touch targets at 375 px.
// Needs the server in demo mode with the new interview: LYNKR_MOCK=1 LYNKR_INTERVIEW=v2 LYNKR_PAYWALL=0.
// Run: LYNKR_URL=http://localhost:3001 node tests/e2e-interview-a11y.mjs
import { chromium } from "playwright-core";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};
const ANSWER = "I built 3 dashboards myself for 40 fest sponsors in Pune, using SQL and Power BI every week.";

const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "Asia/Kolkata" })).newPage();

/** Form controls and buttons with no accessible name. */
const unnamed = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("main input:not([type=hidden]), main textarea, main select, main button")]
      .filter((el) => {
        if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
        if (el.tagName === "BUTTON") return !el.textContent.trim();
        return !(el.labels && el.labels.length);
      })
      .map((el) => el.outerHTML.slice(0, 80)),
  );
const focused = () =>
  page.evaluate(() => {
    const el = document.activeElement;
    const s = getComputedStyle(el);
    return { name: (el?.labels?.[0]?.innerText ?? el?.getAttribute("aria-label") ?? el?.innerText ?? "").trim(), tag: el?.tagName, outline: `${s.outlineStyle} ${s.outlineWidth}` };
  });
/** Tab forward until the focused control's name matches, up to `max` presses. */
async function tabTo(match, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const f = await focused();
    if (match.test(f.name)) return f;
  }
  return null;
}
const question = () => page.locator("main h2").first().innerText();
const save = () => page.getByRole("button", { name: /Save and continue/ });

try {
  const missing = [];
  await page.goto(BASE + "#start");
  await page.getByRole("heading", { name: "Which sounds most like you?" }).waitFor({ timeout: 30000 });
  missing.push(...(await unnamed()).map((m) => `bucket: ${m}`));

  // K1: keyboard only from the first screen to an answered question.
  const bucket = await tabTo(/Student or recent graduate/);
  check("K1a reach a bucket by Tab", !!bucket);
  check("K2 visible focus", bucket?.outline === "solid 2px", `outline ${bucket?.outline}`);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Paste my profile instead" }).first().waitFor();
  missing.push(...(await unnamed()).map((m) => `import: ${m}`));
  await page.getByRole("button", { name: "Paste my profile instead" }).first().click();
  missing.push(...(await unnamed()).map((m) => `paste: ${m}`));
  await page.getByRole("button", { name: "Back", exact: true }).click();
  const skip = await tabTo(/Skip for now/);
  await page.keyboard.press("Enter");
  await save().waitFor({ timeout: 30000 });
  missing.push(...(await unnamed()).map((m) => `question: ${m}`));

  const q1 = await question();
  const chip = await tabTo(/^Final year$/);
  await page.keyboard.press("Enter");
  const chipOn = (await page.getByRole("radio", { name: "Final year" }).getAttribute("aria-checked")) === "true";
  const box = await tabTo(/Anything to add\?/);
  await page.keyboard.type("I finish my B.Com at Symbiosis Pune in May 2027.");
  await page.keyboard.press("Control+Enter");
  await page.waitForFunction((prev) => document.querySelector("main h2")?.textContent !== prev, q1, { timeout: 30000 });
  check("K1 keyboard only: bucket, import, chip, text, save", !!skip && !!chip && chipOn && !!box, `skip ${!!skip}, chip ${chipOn}, text ${!!box}`);

  // L1: the reflection and the vault count are announced.
  const reflection = (await page.locator("main section p[aria-live=polite]").first().innerText()).trim();
  const vaultLive = await page.locator('[aria-label="Your Story Vault"] [aria-live=polite]').count();
  check("L1 reflection in a polite live region", reflection.length > 0, reflection.slice(0, 80));
  check("L2 Story Vault count announced", vaultLive >= 1);

  // P1: the progress bar exposes its values.
  const bar = page.getByRole("progressbar").first();
  const [now, min, max] = await Promise.all(["aria-valuenow", "aria-valuemin", "aria-valuemax"].map((a) => bar.getAttribute(a)));
  check("P1 progressbar role and values", now !== null && Number(now) >= 0 && Number(max) === 100 && Number(min) === 0, `${now} of ${min}-${max}`);

  // T1: at 375 px every button on the question screen is at least 44 px tall.
  await page.setViewportSize({ width: 375, height: 812 });
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("main section button")]
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 44)
      .map((b) => `${b.textContent.trim().slice(0, 30)} ${Math.round(b.getBoundingClientRect().height)}px`),
  );
  check("T1 44px touch targets at 375px", small.length === 0, small.join(" | ") || "all buttons 44px or taller");
  await page.setViewportSize({ width: 1280, height: 900 });

  // Answer the rest (by keyboard where there's text) to reach the read-back and first win.
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole("heading", { name: /what Lynkr heard/ }).count()) break;
    await save().waitFor({ timeout: 30000 });
    const q = await question();
    const chips = page.locator("main fieldset button[role=radio], main fieldset button[role=checkbox]");
    if (await chips.count()) await chips.first().click();
    const text = page.getByLabel("Your answer");
    if (await text.count()) {
      await text.focus();
      await page.keyboard.type(ANSWER);
    }
    if (await save().isDisabled()) await page.getByRole("button", { name: /^(Later|Not sure yet)$/ }).first().click();
    else await save().click();
    await page.waitForFunction((prev) => document.querySelector("main h2")?.textContent !== prev || /what Lynkr heard/.test(document.body.innerText), q, { timeout: 30000 });
  }
  await page.getByRole("heading", { name: /what Lynkr heard/ }).waitFor({ timeout: 30000 });
  missing.push(...(await unnamed()).map((m) => `read-back: ${m}`));

  // K3: rate and confirm the read-back by keyboard.
  const four = await tabTo(/^4 out of 5/, 120);
  await page.keyboard.press("Enter");
  const rated = (await page.getByRole("radio", { name: /^4 out of 5/ }).getAttribute("aria-checked")) === "true";
  const confirm = await tabTo(/Looks right, write my first drafts/);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /See everything Lynkr can do/ }).waitFor({ timeout: 60000 });
  check("K3 read-back rating and confirm by keyboard", !!four && rated && !!confirm);
  missing.push(...(await unnamed()).map((m) => `first win: ${m}`));
  check("N1 every control has a name", missing.length === 0, missing.slice(0, 3).join(" | ") || "bucket, import, paste, question, read-back, first win");
} catch (e) {
  check("run", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
