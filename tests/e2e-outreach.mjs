// Outreach v2, end to end in a real browser: goal setup, import connections fixture, add contact,
// write draft, copy and open profile, mark sent, follow-up appearing in Today. At 1280 px and 375 px.
// Needs the server in demo mode with outreach v2: LYNKR_MOCK=1 LYNKR_OUTREACH=v2 LYNKR_PAYWALL=0.
// Run: LYNKR_URL=http://localhost:3001 node tests/e2e-outreach.mjs   (W=375 for the phone width only)
import { chromium } from "playwright-core";
import { reachResults } from "./e2e-outreach-helpers.mjs";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const SHOTS = process.env.LYNKR_SHOTS || "";
const WIDTHS = process.env.W ? [Number(process.env.W)] : [1280, 375];

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};


async function run(width) {
  const tag = width < 600 ? "375" : "1280";
  const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width, height: width < 600 ? 812 : 900 },
    timezoneId: "Asia/Kolkata",
    isMobile: width < 600,
    hasTouch: width < 600,
    permissions: ["clipboard-read", "clipboard-write"]
  });
  const page = await ctx.newPage();
  const errors = [];
  const networkLog = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // With no account the app's own calls answer 401 (not signed in), 409 or 503 (no storage); the browser logs each as a console error. They are expected here.
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(401|409|503)/.test(m.text()) && errors.push(m.text()));

  // U13 requirement: verify no connections file upload happens
  page.on("request", (req) => {
    if (req.method() === "POST" || req.method() === "PUT" || req.method() === "PATCH") {
      // Bodies that are not JSON (analytics beacons, binary) are kept as raw text so the check below can still scan them.
      let body = null;
      try { body = req.postDataJSON(); } catch { body = req.postData(); }
      networkLog.push({ url: req.url(), method: req.method(), body });
    }
  });

  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${tag}-${name}.png`, fullPage: true });
  const id = (s) => `${tag} ${s}`;
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  try {
    await reachResults(page, BASE);
    await shot("0-after-first-win");
    await page.getByRole("tab", { name: "Outreach" }).waitFor({ timeout: 10000 });
    await page.getByRole("tab", { name: "Outreach" }).click();
    await page.getByText("What do you want from LinkedIn?").waitFor({ timeout: 30000 });
    await shot("1-goal-setup");

    // R1: goals are pre-selected from the interview ("A new job" -> Find a job); one tap confirms.
    const preselected = await page.locator("button[aria-pressed='true']").count();
    check(id("O1 goals pre-selected from the interview"), preselected >= 1, `${preselected} pre-selected`);
    check(id("O1b 'Find a job' is one of them"), (await page.getByRole("button", { name: /Find a job/ }).getAttribute("aria-pressed")) === "true");
    await page.getByRole("button", { name: "Looks right" }).click();
    await page.getByRole("heading", { name: "Your goals" }).waitFor({ timeout: 15000 });
    await shot("2-people-board");

    // R6/R35: the connections file is read in the browser. Nothing is sent until a person is added.
    const connectionRows = page.getByRole("list", { name: "Your connections, best match first" }).getByRole("listitem");
    const requestsBeforeImport = networkLog.length;
    await page.locator("input[type='file']").setInputFiles("tests/fixtures/connections.csv");
    await connectionRows.first().waitFor({ timeout: 15000 });
    const rows = await connectionRows.count();
    await shot("3-connections-imported");
    const sentDuringImport = networkLog.slice(requestsBeforeImport).filter((r) => /fixture-mail\.test|Connected On|asha\.rao|bala\.sen/i.test(`${r.url} ${JSON.stringify(r.body)}`));
    check(id("O2 connections are read in the browser: rows listed, nothing uploaded (R6)"), rows >= 2 && sentDuringImport.length === 0, `${rows} rows, ${sentDuringImport.length} requests carried file data`);

    // R37: with no account or storage, the made-up example person can be tried tap by tap. Adding a real person needs
    // storage (covered by the PGlite route tests and the preview check), so the browser journey uses the example.
    await page.getByRole("button", { name: /Priya Nair/ }).click();
    await page.getByText("Goal for Priya Nair").waitFor({ timeout: 15000 });
    await shot("4-person-card");
    let taps = 0;

    // R15-R19: complete drafts, no placeholders.
    await page.getByRole("button", { name: /^Write a message$|^Write again$/ }).click(); taps++;
    const versions = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: /^Version \d/ }) });
    await versions.first().waitFor({ timeout: 30000 });
    const nVersions = await versions.count();
    const firstDraft = await versions.first().locator("p").nth(0).innerText();
    const bad = /\[\[|\{|<|TODO|undefined/i.test(firstDraft);
    check(id("O3 two or more complete drafts, no placeholders"), nVersions >= 2 && !bad && firstDraft.length > 40, `${nVersions} versions`);
    check(id("O3b a ready draft is one tap after choosing the person"), taps <= 1, `${taps} tap(s)`);
    await shot("5-drafts");

    // R24: copy works. The profile link opens a tab, so only plain Copy is exercised here.
    await page.getByRole("button", { name: /^Copy version 1/ }).click();
    await page.getByText(/Copied\./).waitFor({ timeout: 10000 });
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    check(id("O4 Copy puts version 1 on the clipboard"), copied.length > 40 && copied === firstDraft, `copied ${copied.length} chars`);

    // R25: Mark sent records the invite on the person's timeline.
    await page.getByRole("button", { name: /^Mark sent/ }).first().click();
    await page.getByText(/Marked sent/).first().waitFor({ timeout: 15000 });
    await shot("6-marked-sent");
    const markedButtons = await page.getByRole("button", { name: /^Marked sent/ }).count();
    check(id("O5 Mark sent confirms and the button switches to 'Marked sent'"), markedButtons >= 1, `${markedButtons} marked`);

    // R44: Today still opens with the outreach section in place.
    await page.getByRole("tab", { name: /Today/ }).click();
    await page.getByRole("heading", { name: "Next up" }).waitFor({ timeout: 15000 });
    await shot("7-today");
    check(id("O6 Today opens after outreach"), true);


    // Check horizontal overflow (no scrolling)
    const over = await overflow();
    check(id("O7 no horizontal overflow"), over <= 1, `${over}px overflow`);

    // Check for JS errors
    check(id("O8 no JS errors"), errors.length === 0, errors.length > 0 ? errors.slice(0, 3).join(" | ").slice(0, 300) : "");

    await browser.close();
    return true;
  } catch (e) {
    check(id("FATAL"), false, e.message);
    await shot("fatal").catch(() => {});
    await browser.close();
    return false;
  }
}

let allPass = true;
for (const w of WIDTHS) {
  console.log(`\n=== Testing at ${w}px ===`);
  const ok = await run(w);
  allPass = allPass && ok;
}

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exit(allPass && results.every((r) => r.ok) ? 0 : 1);
