// End-to-end checks (acceptance tests in research/acceptance-tests.md): weekly plan P10–P18, ask ladder L5–L6.
// Needs the dev server in demo mode on :3000 and Google Chrome installed.
// Run: node tests/e2e.mjs
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, timezoneId: "Asia/Kolkata" });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const openPlanTab = () => page.getByRole("tab", { name: "This week" }).click();

try {
  // Setup and interview (demo mode: 6 questions, skip the 5th).
  await page.goto(BASE);
  await page.getByLabel("Target role").fill("Data analyst");
  await page.getByLabel("Your background in one or two lines").fill("Final-year B.Com, tier-3 college in Pune, self-taught SQL");
  await page.getByRole("button", { name: "Start the interview" }).click();
  const answers = [
    "I built a Power BI dashboard for my college fest that tracked 40 sponsors.",
    "It saved the team about 6 hours a week.",
    "It shows I can turn messy data into a decision.",
    "My first SQL join gave wrong numbers; now I check row counts.",
    null,
    "Analytics firms in Pune such as Fractal.",
  ];
  for (const [i, a] of answers.entries()) {
    await page.getByText(`Question ${i + 1}`).waitFor();
    if (a === null) await page.getByRole("button", { name: "Skip" }).click();
    else {
      await page.getByPlaceholder(/Type/).fill(a);
      await page.getByRole("button", { name: "Send answer" }).click();
    }
  }
  await page.getByRole("tab", { name: "This week" }).waitFor({ timeout: 15000 });

  // L5: the relationship picker switches the first message (ask ladder).
  await page.getByRole("tab", { name: "Outreach" }).click();
  const firstTitle = () => page.locator("h3").filter({ hasText: /First message to a stranger|Message to someone from your college|Referral request/ }).first().innerText();
  const t1 = await firstTitle();
  await page.screenshot({ path: "docs/ladder.png", fullPage: true });
  await page.getByRole("radio", { name: "Same college / alumni" }).click();
  const t2 = await firstTitle();
  await page.getByRole("radio", { name: "Someone who knows me" }).click();
  const t3 = await firstTitle();
  const follow = await page.getByRole("heading", { name: "Follow-up in 5 to 7 days" }).count();
  check("L5", t1 === "First message to a stranger" && t2 === "Message to someone from your college" && t3 === "Referral request" && follow === 1, `${t1} / ${t2} / ${t3}, follow-up ${follow}`);

  // P10: default view.
  await openPlanTab();
  await page.getByText(/^Week of /).waitFor();
  const heading = await page.getByRole("heading", { level: 3 }).filter({ hasText: "Week of" }).innerText();
  const itemCount = await page.locator("section[aria-label] >> text=/\\d\\d:\\d\\d IST/").count();
  const drafts = await page.locator("section[aria-label] span", { hasText: /^Draft$/ }).count();
  check("P10", /3 messages, 2 comments, 1 post/.test(heading) && itemCount === 6 && drafts === 6, `${heading} | items ${itemCount}, drafts ${drafts}`);
  await page.screenshot({ path: "docs/plan-week.png", fullPage: true });

  // P11: status flow on the first item.
  const c1 = page.locator("[data-item='message-0']");
  await c1.getByRole("button", { name: "Schedule" }).click();
  const s1 = await c1.getByText("Scheduled", { exact: true }).count();
  await c1.getByRole("button", { name: /^Mark (sent|posted)$/ }).click();
  const s2 = await c1.getByText(/^(Sent|Posted)$/).count();
  // P16: a sent message offers "Got a reply".
  const replyToggle = await c1.getByLabel("Got a reply").count();
  check("P16", replyToggle === 1, `reply toggle ${replyToggle}`);
  await c1.getByRole("button", { name: "Back to draft" }).click();
  const s3 = await c1.getByText("Draft", { exact: true }).count();
  check("P11", s1 === 1 && s2 === 1 && s3 === 1, `scheduled ${s1}, done ${s2}, back ${s3}`);

  // P12: move the first Monday item to Friday 15:45, then reload.
  const moved = page.locator("[data-item='message-0']");
  const movedTitle = await moved.locator("p").first().innerText();
  await moved.getByRole("button", { name: "Move" }).click();
  const friDay = await page.locator("section[aria-label^='Fri']").getAttribute("aria-label");
  await page.getByLabel("Day").selectOption({ label: friDay });
  await page.getByLabel("Time (IST)").fill("15:45");
  const fri = () => page.locator("section[aria-label^='Fri']");
  const before = await fri().getByText("15:45 IST").count();
  await page.reload();
  await openPlanTab();
  const after = await fri().getByText("15:45 IST").count();
  check("P12", before === 1 && after === 1, `"${movedTitle}" on Fri 15:45 before reload ${before}, after ${after}`);

  // P13: adjust by chat.
  await page.getByLabel("Change this week").fill("2 posts, no comments");
  await page.getByRole("button", { name: "Update plan" }).click();
  await page.getByText(/^Updated:/).waitFor();
  const h2 = await page.getByRole("heading", { level: 3 }).filter({ hasText: "Week of" }).innerText();
  const reply = await page.getByText(/^Updated:/).innerText();
  check("P13", /3 messages, 0 comments, 2 posts/.test(h2), `${h2} | ${reply}`);

  // P15: downloads and Google link.
  const [weekDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download week (.ics)" }).click()]);
  const weekIcs = readFileSync(await weekDl.path(), "utf8");
  const events = (weekIcs.match(/BEGIN:VEVENT/g) || []).length;
  const [oneDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: ".ics", exact: true }).first().click()]);
  const oneIcs = readFileSync(await oneDl.path(), "utf8");
  const gHref = await page.getByRole("link", { name: "Google Calendar" }).first().getAttribute("href");
  const g = new URL(gHref);
  check(
    "P15",
    events === 5 && (oneIcs.match(/BEGIN:VEVENT/g) || []).length === 1 && g.hostname === "calendar.google.com" && /^\d{8}T\d{6}Z\/\d{8}T\d{6}Z$/.test(g.searchParams.get("dates") || "") && !!g.searchParams.get("text"),
    `week events ${events} (5 open items), google "${g.searchParams.get("text")}"`,
  );

  // P14: month view.
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  const monthTitle = await page.getByRole("heading", { level: 4 }).first().innerText();
  const chips = await page.locator(".grid-cols-7 [title]").count();
  check("P14", /2026/.test(monthTitle) && chips === 5, `${monthTitle}, ${chips} chips`);
  await page.screenshot({ path: "docs/plan-month.png", fullPage: true });
  await page.getByRole("tab", { name: "Week", exact: true }).click();

  // P17: phone width.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check("P17", overflow <= 0, `horizontal overflow ${overflow}px`);
  await page.screenshot({ path: "docs/plan-phone.png", fullPage: false });
  await page.setViewportSize({ width: 1280, height: 900 });

  // L6: results saved before the ask ladder (no stranger/alumni drafts) show a rewrite prompt.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("lynkr:v1"));
    delete s.result.outreach.stranger;
    delete s.result.outreach.alumni;
    localStorage.setItem("lynkr:v1", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("tab", { name: "Outreach" }).click();
  const prompt = await page.getByRole("button", { name: "Rewrite drafts" }).count();
  check("L6", prompt === 1, `rewrite prompt ${prompt}`);

  // P18: clear everything removes the plan.
  await page.getByRole("tab", { name: "Story Vault" }).click();
  await page.getByRole("button", { name: "Clear everything" }).click();
  const stored = await page.evaluate(() => localStorage.getItem("lynkr:v1"));
  const plan = stored ? JSON.parse(stored).plan : null;
  check("P18", plan === null, `stored plan after clear: ${plan === null ? "none" : "still there"}`);

  check("console", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  check("run", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
