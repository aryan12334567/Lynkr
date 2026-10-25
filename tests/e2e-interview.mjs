// Interview v2, end to end in a real browser (acceptance test I22): bucket, paste import, every question,
// reflections, the live Story Vault, the read-back, rating and the first win, at 1280 px and 375 px.
// Needs the server in demo mode with the new interview: LYNKR_MOCK=1 LYNKR_INTERVIEW=v2 LYNKR_PAYWALL=0.
// Run: LYNKR_URL=http://localhost:3001 node tests/e2e-interview.mjs   (W=375 for the phone width only)
import { chromium } from "playwright-core";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const SHOTS = process.env.LYNKR_SHOTS || "";
const WIDTHS = process.env.W ? [Number(process.env.W)] : [1280, 375];

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};

/** A specific answer per question, chosen from its wording. Long, with "I" and a number, so no follow-up is owed. */
function answerFor(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("studying") || p.includes("what you do now")) return "I am in my final year of B.Com at Symbiosis Pune, finishing in May 2027.";
  if (p.includes("come to you for")) return "Classmates come to me to clean messy Excel sheets; I fixed 6 of them last term.";
  if (p.includes("role are you aiming")) return "Junior data analyst roles in fintech or retail, working mostly in SQL and Power BI.";
  if (p.includes("companies")) return "Razorpay, Zepto and Swiggy, or mid-size retail analytics teams in Pune or Bengaluru.";
  if (p.includes("justify")) return "Honestly I want to build dashboards people actually open every morning, in any team.";
  if (p.includes("must-have")) return "Pune or hybrid, starting June 2027, and a team that uses SQL every day.";
  if (p.includes("which part was yours") || p.includes("what did you do")) return "I wrote all 14 SQL queries myself and designed the 3 dashboard pages on my own.";
  if (p.includes("proud")) return "We built a sponsor dashboard for the college fest.";
  if (p.includes("number") || p.includes("estimate") || p.includes("how much") || p.includes("how many"))
    return "About 40 sponsors tracked, and it cut our follow-up meeting from 2 hours to 30 minutes, roughly.";
  if (p.includes("way in")) return "My college alumni group has 3 people at Razorpay, and my internship manager knows Zepto's data lead.";
  if (p.includes("offer")) return "I can share the 12-page dashboard teardown I wrote about fest sponsor data.";
  if (p.includes("gaps")) return "I took 6 months off after 12th to help with my family's shop in Nashik.";
  return "I keep a 30-day log of every SQL query I write and what it taught me about the data.";
}

async function run(width) {
  const tag = width < 600 ? "375" : "1280";
  const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 900 }, timezoneId: "Asia/Kolkata", isMobile: width < 600, hasTouch: width < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${tag}-${name}.png`, fullPage: true });
  const id = (s) => `${tag} ${s}`;
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const question = () => page.locator("main h2").first().innerText();
  const save = () => page.getByRole("button", { name: /Save and continue/ });

  try {
    await page.goto(BASE + "#start");
    await page.getByRole("heading", { name: "Which sounds most like you?" }).waitFor({ timeout: 30000 });
    await shot("1-bucket");
    check(id("V1 bucket choice shows three options"), (await page.locator("main ul > li button").count()) === 3);
    await page.getByRole("button", { name: /Student or recent graduate/ }).click();

    // Import: the structured paste fallback.
    await page.getByRole("button", { name: "Paste my profile instead" }).first().click();
    await page.getByLabel("Headline").fill("Final-year B.Com | Excel and SQL");
    await page.getByLabel(/Current role or course/).fill("Final-year B.Com at Symbiosis Pune");
    await page.getByLabel(/^About/).fill("I like turning messy sheets into dashboards.");
    await shot("2-import-paste");
    await page.getByRole("button", { name: "Use this" }).click();

    await save().waitFor({ timeout: 30000 });
    await shot("3-first-question");
    const pct = Number(await page.getByRole("progressbar").getAttribute("aria-valuenow"));
    check(id("V2 progress starts above zero after the import"), pct > 0, `${pct}%`);
    const first = await question();
    check(id("V3 the import prefill is offered on the first question"), first.includes("From your profile: Final-year B.Com at Symbiosis Pune"), first.slice(0, 120));

    const seen = [];
    const skipWhere = [];
    let parked = "";
    let revisited = false;
    let followUp = false;
    let afterWe = false;
    let exampleBlocked = null;
    let stuckOk = null;
    let reloaded = null;
    let vaultFilled = false;
    let reflection = "";

    for (let i = 0; i < 40; i++) {
      if (await page.getByRole("heading", { name: /what Lynkr heard/ }).count()) break;
      await save().waitFor({ timeout: 30000 });
      const q = await question();
      const p = q.toLowerCase();
      seen.push(q);
      const hasSkip = (await page.getByRole("button", { name: "Skip", exact: true }).count()) > 0;
      if (hasSkip) skipWhere.push(q);
      // The screen right after the "We built..." answer must be its follow-up.
      if (afterWe) followUp = (await page.getByText("Follow-up", { exact: true }).count()) > 0;
      afterWe = false;
      if (await page.getByText("Coming back to this one", { exact: true }).count()) revisited = revisited || q === parked;

      // "Not sure yet" parks the first open question it's offered on; it should come back later.
      if (!parked && p.includes("come to you for")) {
        parked = q;
        await page.getByRole("button", { name: "Not sure yet" }).click();
        await page.waitForFunction((prev) => document.querySelector("main h2")?.textContent !== prev, q);
        continue;
      }
      // The example answer can't be saved unedited.
      if (exampleBlocked === null && p.includes("role are you aiming")) {
        await page.getByRole("button", { name: "Use as a starting point" }).click();
        const blocked = await save().isDisabled();
        await page.getByLabel("Your answer").fill(answerFor(q));
        exampleBlocked = blocked && !(await save().isDisabled());
      }
      // The stuck ladder: rephrase first, then more examples.
      if (stuckOk === null && p.includes("companies")) {
        await page.getByRole("button", { name: "I'm stuck" }).click();
        const rephrase = await page.getByText("Another way to put it:").count();
        await page.getByRole("button", { name: /Show more examples/ }).click();
        const ladder = await page.getByRole("button", { name: /Come back to it later/ }).count();
        stuckOk = rephrase === 1 && ladder === 1;
      }
      // Reload mid-interview: the same question comes back.
      if (reloaded === null && p.includes("must-have")) {
        await page.reload();
        await save().waitFor({ timeout: 30000 });
        reloaded = (await question()) === q;
      }

      const chips = page.locator("main fieldset button[role=radio], main fieldset button[role=checkbox]");
      if (await chips.count()) await chips.first().click();
      const box = page.getByLabel(/^(Your answer|Anything to add\?)$/);
      if ((await box.count()) && !(await box.inputValue())) {
        const needsText = (await page.getByLabel("Your answer").count()) > 0;
        if (needsText) await box.fill(answerFor(q));
      }
      if (answerFor(q).startsWith("We built") && (await box.count()) && (await box.inputValue()).startsWith("We built")) afterWe = true;
      if (await save().isDisabled()) {
        // Enrichment questions can go to "Later"; anything else is a test gap worth seeing.
        const later = page.getByRole("button", { name: "Later", exact: true });
        if (await later.count()) await later.click();
        else throw new Error(`Can't save: ${q}`);
      } else {
        await save().click();
      }
      await page.waitForFunction(
        (prev) => document.querySelector("main h2")?.textContent !== prev || /what Lynkr heard/.test(document.body.innerText),
        q,
        { timeout: 30000 },
      );
      const r = (await page.locator("main section p[aria-live=polite]").first().innerText().catch(() => "")).trim();
      if (r) reflection = r;
      const vault = page.getByRole("complementary", { name: "Your Story Vault" }).or(page.locator('[aria-label="Your Story Vault"]'));
      if (!vaultFilled && (await vault.count())) vaultFilled = !(await vault.first().innerText()).includes("Your facts appear here");
      if (i === 3) await shot("4-mid-interview");
    }

    check(id("V4 every core question answered through to the read-back"), (await page.getByRole("heading", { name: /what Lynkr heard/ }).count()) === 1, `${seen.length} screens`);
    check(id("V5 Skip appears only on the sensitive question"), skipWhere.length >= 1 && skipWhere.every((q) => q.toLowerCase().includes("gaps")), skipWhere.join(" | ").slice(0, 120));
    check(id("V6 'Not sure yet' parks and the question comes back"), !!parked && revisited, parked.slice(0, 60));
    check(id("V7 the example can't be saved until it's edited"), exampleBlocked === true);
    check(id("V8 stuck ladder: rephrase, then examples, then a 'come back later' step"), stuckOk === true);
    check(id("V9 a 'we' answer gets a follow-up"), followUp);
    check(id("V10 a specific one-line reflection after an answer"), reflection.length > 0 && !/great|awesome|amazing/i.test(reflection), reflection.slice(0, 80));
    check(id("V11 the Story Vault panel fills"), vaultFilled);
    check(id("V12 reload mid-interview resumes at the same question"), reloaded === true);

    // Read-back: fix a line, remove a line, rate 4.
    await shot("5-readback");
    const fixes = page.getByRole("button", { name: /^Fix: / });
    const nFix = await fixes.count();
    await fixes.first().click();
    await page.getByLabel(/Fix this line/).fill("I wrote all 14 SQL queries for the fest sponsor dashboard myself.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    const fixed = await page.getByText("I wrote all 14 SQL queries for the fest sponsor dashboard myself.").count();
    const removeBtn = page.getByRole("button", { name: /^Remove: / }).last();
    const removedText = ((await removeBtn.getAttribute("aria-label")) ?? "").replace(/^Remove: /, "");
    await removeBtn.click();
    const putBack = await page.getByRole("button", { name: `Put back: ${removedText}` }).count();
    check(id("V13 fix a line and remove a line"), nFix > 1 && fixed === 1 && putBack === 1, `${nFix} lines`);
    await page.getByRole("radio", { name: /^4 out of 5/ }).click();
    check(id("V14 rating 4 selected"), (await page.getByRole("radio", { name: /^4 out of 5/ }).getAttribute("aria-checked")) === "true");
    await page.getByRole("button", { name: "Looks right, write my first drafts" }).click();

    // First win: a headline and a referral, Copy locked until blanks are filled.
    await page.getByRole("button", { name: /See everything Lynkr can do/ }).waitFor({ timeout: 60000 });
    await shot("6-first-win");
    const cards = await page.getByRole("button", { name: "Copy", exact: true }).count();
    const blanks = page.getByPlaceholder("Your real answer");
    const nBlanks = await blanks.count();
    let lockedThenOpen = true;
    if (nBlanks) {
      const copyBtns = page.getByRole("button", { name: "Copy", exact: true });
      const anyLocked = (await copyBtns.evaluateAll((els) => els.filter((e) => e.disabled).length)) > 0;
      for (let k = 0; k < nBlanks; k++) await blanks.nth(k).fill("Riya");
      const stillLocked = await copyBtns.evaluateAll((els) => els.filter((e) => e.disabled).length);
      lockedThenOpen = anyLocked && stillLocked === 0;
    }
    check(id("V15 first win shows a headline and a referral"), cards === 2, `${cards} copy buttons`);
    check(id("V16 Copy is locked until blanks are filled"), lockedThenOpen, `${nBlanks} blanks`);

    check(id("V17 no sideways scroll"), (await overflow()) <= 0, `${await overflow()}px`);
    check(id("V18 no console errors"), errors.length === 0, errors.slice(0, 3).join(" | ").slice(0, 200));
  } catch (err) {
    await shot("error");
    check(id("crashed"), false, err.message.split("\n")[0]);
  }
  await browser.close();
}

for (const w of WIDTHS) await run(w);
const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
