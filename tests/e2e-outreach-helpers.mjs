// Shared by the Outreach browser tests: drives the demo interview and lands on the results, where the tabs are.
// Needs the server in demo mode (LYNKR_MOCK=1). Nothing here talks to a real database or model.

/** Answer function for interview questions. */
export function answerFor(prompt) {
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

/** From the landing page to the results screen (all tabs visible). */
export async function reachResults(page, BASE) {
  const question = () => page.locator("main h2").first().innerText();
  const save = () => page.getByRole("button", { name: /Save and continue/ });
  // Complete interview flow to reach Results with tabs
  await page.goto(BASE + "#start");
  await page.getByRole("heading", { name: "Which sounds most like you?" }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /Student or recent graduate/ }).click();

  // Import: the structured paste fallback.
  await page.getByRole("button", { name: "Paste my profile instead" }).first().click();
  await page.getByLabel("Headline").fill("Final-year B.Com | Excel and SQL");
  await page.getByLabel(/Current role or course/).fill("Final-year B.Com at Symbiosis Pune");
  await page.getByLabel(/^About/).fill("I like turning messy sheets into dashboards.");
  await page.getByRole("button", { name: "Use this" }).click();

  // Answer interview questions until read-back
  await save().waitFor({ timeout: 30000 });
  for (let i = 0; i < 40; i++) {
    if (await page.getByRole("heading", { name: /what Lynkr heard/ }).count()) break;
    await save().waitFor({ timeout: 30000 });
    const q = await question();
    const p = q.toLowerCase();

    // Park "come to you for" question
    if (p.includes("come to you for")) {
      await page.getByRole("button", { name: "Not sure yet" }).click();
      await page.waitForFunction((prev) => document.querySelector("main h2")?.textContent !== prev, q);
      continue;
    }

    const chips = page.locator("main fieldset button[role=radio], main fieldset button[role=checkbox]");
    if (await chips.count()) await chips.first().click();
    const box = page.getByLabel(/^(Your answer|Anything to add\?)$/);
    if ((await box.count()) && !(await box.inputValue())) {
      const needsText = (await page.getByLabel("Your answer").count()) > 0;
      if (needsText) await box.fill(answerFor(q));
    }
    if (await save().isDisabled()) {
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
  }

  // Read-back: rate 4
  await page.getByRole("radio", { name: /^4 out of 5/ }).click();
  await page.getByRole("button", { name: "Looks right, write my first drafts" }).click();

  // First win: wait for completion, then navigate to Results
  await page.getByRole("button", { name: /See everything Lynkr can do/ }).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: /See everything Lynkr can do/ }).click();

  // "See everything" lands on the facts check; "Write my drafts" is what opens the tabs.
  await page.getByRole("button", { name: "Write my drafts" }).click();
}
