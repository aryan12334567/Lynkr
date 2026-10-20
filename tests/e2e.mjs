// End-to-end checks in demo mode: review-before-drafting, ask ladder, Connect Coach v2,
// checker v2, comment helper, profile import, draft editing, weekly plan.
// Needs the dev server in demo mode on :3000 and Google Chrome installed. Run: node tests/e2e.mjs
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};

/** Answer the demo interview by what each question asks. null = Skip. */
function answerFor(q) {
  if (/what did you personally do/i.test(q)) return "We built a Power BI dashboard for our college fest that tracked 40 sponsors.";
  if (/Which part did you handle yourself/.test(q)) return "I wrote the SQL and the sponsor view myself.";
  if (/difficult or uncertain/.test(q)) return "Choosing which sponsors to chase first.";
  if (/What changed because of your work/i.test(q)) return "It saved the team about 6 hours a week.";
  if (/learn, notice or question/i.test(q)) return "Check row counts before trusting a chart.";
  if (/^Optional: what went wrong/.test(q)) return null;
  if (/^Optional: what have you personally noticed/.test(q)) return "Fresher dashboards often skip data cleaning; I saw it in our analytics club.";
  if (/Who do you most want to reach/.test(q)) return "Analytics firms in Pune such as Fractal.";
  return "Not sure.";
}

function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = deflateRawSync(Buffer.from(text));
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt16LE(n.length, 26);
    parts.push(local, n, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(8, 10);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, timezoneId: "Asia/Kolkata" });
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// C9 deliberately triggers a 422 (screenshots need an AI key); the browser logs it. Any other failed request still counts.
page.on("console", (m) => m.type() === "error" && !/status of 422/.test(m.text()) && errors.push(m.text()));

const openPlanTab = () => page.getByRole("tab", { name: "This week" }).click();
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("lynkr:v1") || "null"));

try {
  // Setup with the content profile, then the evidence-first interview.
  await page.goto(BASE);
  // L0: the landing page leads into setup.
  await page.getByRole("button", { name: "Start", exact: true }).first().click();
  await page.getByLabel("Target role").fill("Data analyst");
  const suggested = await page.getByLabel(/Closest field/).inputValue();
  await page.getByLabel("Your background in one or two lines").fill("Final-year B.Com, tier-3 college in Pune, self-taught SQL");
  await page.getByLabel("Where you are now").selectOption("final_year");
  await page.getByLabel("Hiring teams and recruiters").check();
  await page.getByRole("button", { name: "Start the interview" }).click();
  check("S1", suggested === "data_ai", `field suggested from role: ${suggested}`);

  const asked = [];
  for (let i = 0; i < 12; i++) {
    // Wait for either the review screen or a new question (different from the last one).
    const last = asked.at(-1) ?? "";
    await page.waitForFunction(
      (prev) => {
        if ([...document.querySelectorAll("h2")].some((h) => h.textContent === "Check your facts")) return true;
        const q = document.querySelector("p.font-serif");
        return !!q && q.textContent !== prev;
      },
      last,
      { timeout: 15000 },
    );
    if (await page.getByRole("heading", { name: "Check your facts" }).count()) break;
    const text = await page.locator("p.font-serif").first().innerText();
    asked.push(text);
    const a = answerFor(text);
    if (a === null) await page.getByRole("button", { name: "Skip" }).click();
    else {
      await page.getByPlaceholder(/Type/).fill(a);
      await page.getByRole("button", { name: "Send answer" }).click();
    }
  }
  const followUps = asked.filter((q) => /Which part did you handle yourself|What changed, or what artifact/.test(q)).length;
  check("I1", asked.length >= 7 && followUps >= 1 && followUps <= 2, `${asked.length} questions, ${followUps} follow-up(s)`);

  // V1: facts are candidates until confirmed; drafting is blocked until then.
  await page.getByRole("heading", { name: "Check your facts" }).waitFor();
  const blocked = await page.getByRole("button", { name: "Write my drafts" }).isDisabled();
  const nFacts = await page.locator("[data-fact]").count();
  const source = await page.locator("[data-fact]").first().innerText();
  await page.locator("[data-fact='F3']").getByRole("button", { name: "Don't use in drafts" }).click();
  await page.getByRole("button", { name: /Confirm all/ }).click();
  const facts = (await stored()).facts;
  check(
    "V1",
    blocked && nFacts >= 6 && /From your answer to/.test(source) && facts.find((f) => f.id === "F3")?.useInDrafts === false && facts.filter((f) => f.reviewStatus === "confirmed").length === nFacts - 1,
    `${nFacts} facts, write blocked before review ${blocked}, F3 excluded`,
  );
  await page.getByRole("button", { name: "Write my drafts" }).click();
  await page.getByRole("tab", { name: "This week" }).waitFor({ timeout: 15000 });
  const res = (await stored()).result;
  const refs = [...Object.values(res.outreach), ...res.posts].flatMap((d) => d.factRefs);
  check("V2", !refs.includes("F3") && refs.length > 0, `fact refs used: ${[...new Set(refs)].join(",")} (F3 excluded)`);

  // L5: the relationship picker switches the first message (ask ladder).
  await page.getByRole("tab", { name: "Outreach" }).click();
  const firstTitle = () => page.locator("article h3").first().innerText();
  const t1 = await firstTitle();
  await page.getByRole("radio", { name: "Same college / alumni" }).click();
  const t2 = await firstTitle();
  await page.getByRole("radio", { name: "Someone who knows me" }).click();
  const t3 = await firstTitle();
  const follow = await page.getByRole("heading", { name: "Follow-up in 5 to 7 days" }).count();
  check("L5", t1 === "First message to a stranger" && t2 === "Message to someone from your college" && t3 === "Referral request" && follow === 1, `${t1} / ${t2} / ${t3}, follow-up ${follow}`);
  await page.screenshot({ path: "docs/ladder.png", fullPage: true });

  // E1: full-text edit of a post persists, copy locks on a new blank, reset restores.
  await page.getByRole("tab", { name: "Posts & comments" }).click();
  const proof = page.locator("article").first();
  await proof.getByRole("button", { name: "Edit text" }).click();
  await proof.getByLabel("Edit the full text").fill("My own version of the post. [[a new blank]]");
  await proof.getByRole("button", { name: "Done editing" }).click();
  const lockedByBlank = await proof.getByRole("button", { name: "Copy", exact: true }).isDisabled();
  await page.reload();
  await page.getByRole("tab", { name: "Posts & comments" }).click();
  const kept = await page.locator("article").first().innerText();
  await page.locator("article").first().getByRole("button", { name: "Reset to the draft" }).click();
  const after = await page.locator("article").first().innerText();
  check("E1", lockedByBlank && kept.includes("My own version") && !after.includes("My own version"), `locked by blank ${lockedByBlank}, survived reload ${kept.includes("My own version")}`);

  // CM1: comment helper. Nothing of your own: skip. With a line and a thought: draft. Excerpt never stored.
  const excerpt = "Most dashboards fail because nobody agrees on the metric definitions before building anything.";
  await page.getByLabel("Paste the part of the post you're responding to").fill(excerpt);
  await page.getByLabel("The exact line you're responding to").fill("nobody agrees on the metric definitions");
  await page.getByRole("button", { name: "Write a comment" }).click();
  await page.locator("[data-comment]").waitFor();
  const skip = await page.locator("[data-comment]").innerText();
  await page.getByLabel(/What have you seen or done/).fill("On our fest dashboard we agreed the sponsor count definition with the team before building, and it saved a week of rework.");
  await page.getByRole("button", { name: "Write a comment" }).click();
  await page.getByText("Draft for your review").waitFor();
  const draft = await page.getByLabel("Your comment").inputValue();
  await page.getByRole("button", { name: "Keep this comment" }).click();
  const raw = await page.evaluate(() => localStorage.getItem("lynkr:v1"));
  check("CM1", /Skip this one/.test(skip) && draft.includes("metric definitions") && !raw.includes("before building anything") && raw.includes("sponsor count definition"), "skip without a point; draft quotes the line; excerpt not stored; kept comment stored");

  // PF1: import an export ZIP; messages are skipped; findings update.
  await page.getByRole("tab", { name: "Profile fix" }).click();
  const zipBuf = zip({
    "Profile.csv": "First Name,Headline,Summary,Geo Location\nAsha,Commerce student,I am passionate.,Pune\n",
    "Skills.csv": "Name\nExcel\n",
    "Positions.csv": "Company Name,Title,Description\nAcme,Intern,Responsible for reports.\n",
    "messages.csv": "FROM,CONTENT\nx,private\n",
  });
  await page.getByLabel("Choose your LinkedIn export ZIP or CSV files").setInputFiles({ name: "export.zip", mimeType: "application/zip", buffer: zipBuf });
  await page.locator("[data-import-preview]").waitFor();
  const preview = await page.locator("[data-import-preview]").innerText();
  await page.getByRole("button", { name: "Use these" }).click();
  await page.locator("[data-imported]").waitFor();
  const top = await page.locator("ol [data-finding]").allInnerTexts();
  const rawAfter = await page.evaluate(() => localStorage.getItem("lynkr:v1"));
  check(
    "PF1",
    /1 other files not opened/.test(preview) && top.length >= 1 && top.length <= 3 && top.some((t) => /Headline/.test(t)) && !rawAfter.includes("Responsible for reports"),
    `${top.length} fix-first items; imported data not saved`,
  );
  await page.screenshot({ path: "docs/profile-fix.png", fullPage: false });

  // EN1–EN4: import a job page (Apify plan). Demo mode uses a fixture: no network call.
  const linkBox = page.getByLabel(/Import a job posting link/);
  await linkBox.fill("https://www.linkedin.com/jobs/view/12345");
  await page.getByRole("button", { name: "Import" }).click();
  await page.getByText(/never reads LinkedIn/).waitFor();
  const pasteStillThere = await page.getByLabel(/A job description you're targeting/).isEnabled();
  check("EN1", pasteStillThere, "LinkedIn refused before any fetch; paste box still works");
  await linkBox.fill("https://jobs.lever.co/example/baf9b35a-1ac6-45f8-9a95-de02c8b532bd");
  await page.getByRole("button", { name: "Import" }).click();
  const review = page.locator('[data-requirements="review"]');
  await review.waitFor();
  const reviewText = await review.innerText();
  const gatedBefore = (await page.locator("[data-finding]").allInnerTexts()).join(" ").includes("job page you imported");
  check(
    "EN2",
    /Demo sample/.test(reviewText) && /Source: https:\/\/jobs\.lever\.co/.test(reviewText) && !/priya|@example|98765|linkedin|ignore previous/i.test(reviewText) && !gatedBefore,
    "review shows source and time, no contact data, not used before approval",
  );
  const beforeRequirements = await review.locator("li").count();
  await review.getByRole("button", { name: /^Remove: / }).first().click();
  const afterRequirements = await review.locator("li").count();
  await page.getByRole("button", { name: "Use these requirements" }).click();
  await page.locator('[data-requirements="approved"]').waitFor();
  const findings = (await page.locator("[data-finding]").allInnerTexts()).join(" ");
  check("EN3", afterRequirements === beforeRequirements - 1 && /job page you imported/.test(findings), `items ${beforeRequirements} -> ${afterRequirements}; findings cite the imported page`);
  const storedRequirements = await page.evaluate(() => localStorage.getItem("lynkr:v1") || "");
  check("EN4", !storedRequirements.includes("Example Analytics") && !storedRequirements.includes("jobs.lever.co"), "imported page is never saved in the browser");
  await page.getByRole("button", { name: "Stop using it" }).click();

  // C7: who-to-look-for cards with LinkedIn people-search links, known people first.
  await page.getByRole("tab", { name: "Connect" }).click();
  const cards = page.locator("[data-look-for]");
  const nCards = await cards.count();
  const hrefs = await cards.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const firstCard = await cards.first().innerText();
  check("C7", nCards >= 3 && nCards <= 5 && /Best first/.test(firstCard) && hrefs.every((h) => h.startsWith("https://www.linkedin.com/search/results/people/?keywords=")), `${nCards} cards`);

  // C8: contact decision first; then a note from the packet; copy locked until blanks are filled; ≤ 200 characters.
  const decision0 = await page.locator("[data-contact]").innerText();
  await page.getByLabel("One real thing you noticed").fill("post on cleaning survey data before a dashboard");
  await page.getByLabel("Your one ask").fill("how do you decide which outliers to drop");
  const decision1 = await page.locator("[data-contact]").innerText();
  await page.getByRole("button", { name: "Write my note" }).click();
  const noteBox = page.locator("[data-note]");
  await noteBox.waitFor();
  const lockedBefore = await page.getByRole("button", { name: "Copy note" }).isDisabled();
  for (const input of await noteBox.getByPlaceholder("Your real answer").all()) await input.fill("Asha");
  const lockedAfter = await page.getByRole("button", { name: "Copy note" }).isDisabled();
  const countText = await page.locator("[data-count]").innerText();
  const chars = Number(countText.split("/")[0].trim());
  check("C8", /Need one more detail/.test(decision0) && /Good reason to contact/.test(decision1) && lockedBefore && !lockedAfter && chars > 0 && chars <= 200, `locked ${lockedBefore} -> ${lockedAfter}, ${countText}`);
  await page.screenshot({ path: "docs/connect.png", fullPage: true });

  // C8b: a referral ask to a stranger is held back before any wording.
  await page.getByLabel("What you want").selectOption("referral");
  await page.getByLabel("How you know them").selectOption("none");
  const hold = await page.locator("[data-contact]").innerText();
  await page.getByRole("button", { name: "Write my note" }).click();
  await page.getByText("Don't send this").waitFor();
  check("C8b", /Hold off/.test(hold), "referral to a stranger: hold off, no draft");
  await page.getByLabel("What you want").selectOption("work_question");
  await page.getByLabel("How you know them").selectOption("public_work");

  // C9: screenshot upload in demo mode gives a clear message.
  await page.getByText("Paste from their profile or a screenshot (optional)").click();
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  await page.locator("input[type=file]").setInputFiles({ name: "profile.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Write my note" }).click();
  await page.getByText(/needs an AI key/).waitFor();
  check("C9", true, "demo mode explains screenshots need a key");

  // C10: tracker and note budget, persisted across reload.
  await page.getByLabel("Who (your own label)").fill("Analytics lead at a Pune SaaS firm");
  await page.getByRole("button", { name: "Add person" }).click();
  const person = page.locator("[data-person]").first();
  const st1 = await person.locator("[data-status]").innerText();
  const left1 = await page.locator("[data-notes-left]").innerText();
  await person.getByRole("button", { name: "Mark invited" }).click();
  const left2 = await page.locator("[data-notes-left]").innerText();
  await person.getByRole("button", { name: "Mark accepted" }).click();
  const hint = await person.locator("[data-hint]").innerText();
  const funnelText = await page.locator("[data-funnel]").innerText();
  await page.reload();
  await page.getByRole("tab", { name: "Connect" }).click();
  const st2 = await page.locator("[data-person] [data-status]").first().innerText();
  check(
    "C10",
    st1 === "To find" && /^3 of 3/.test(left1) && /^2 of 3/.test(left2) && /low-effort question/.test(hint) && st2 === "Accepted" && /counts, not rates/.test(funnelText),
    `${st1} | ${left1.split(" personalised")[0]} -> ${left2.split(" personalised")[0]} | after reload ${st2}`,
  );

  // C11: weekly cap.
  await page.getByLabel("New people per week").fill("1");
  await page.getByLabel("Who (your own label)").fill("Second person");
  const addDisabled = await page.getByRole("button", { name: "Add person" }).isDisabled();
  const capMsg = await page.locator("[data-cap]").count();
  check("C11", addDisabled && capMsg === 1, `add disabled ${addDisabled}, cap message ${capMsg}`);

  // C12 (phone part): no horizontal scroll on the Connect tab.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const connectOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.setViewportSize({ width: 1280, height: 900 });

  // K1: checker marks the exact words and applies the smallest edit.
  await page.getByRole("tab", { name: "Check a message" }).click();
  await page.getByLabel("Your message").fill("Hello sir, I hope this message finds you well. I built a dashboard for 300 users. Kindly revert on any opening?");
  const k1 = await page.locator("[data-verdict]").innerText();
  const marks = await page.locator(".sheet mark").count();
  await page.getByRole("button", { name: /Change to "would you be open to it\?"/ }).click();
  const fixed = await page.getByLabel("Your message").inputValue();
  check("K1", /Edit before sending|Do not send yet/.test(k1) && marks >= 2 && !/kindly revert/i.test(fixed), `${marks} marked spans; edit applied`);

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
  const replyToggle = await c1.getByLabel("Got a reply").count();
  check("P16", replyToggle === 1, `reply toggle ${replyToggle}`);
  await c1.getByRole("button", { name: "Back to draft" }).click();
  const s3 = await c1.getByText("Draft", { exact: true }).count();
  check("P11", s1 === 1 && s2 === 1 && s3 === 1, `scheduled ${s1}, done ${s2}, back ${s3}`);

  // P12: move the first Monday item to Friday 15:45, then reload.
  const moved = page.locator("[data-item='message-0']");
  await moved.getByRole("button", { name: "Move" }).click();
  const friDay = await page.locator("section[aria-label^='Fri']").getAttribute("aria-label");
  await page.getByLabel("Day").selectOption({ label: friDay });
  await page.getByLabel("Time (IST)").fill("15:45");
  const fri = () => page.locator("section[aria-label^='Fri']");
  const before = await fri().getByText("15:45 IST").count();
  await page.reload();
  await openPlanTab();
  const afterMove = await fri().getByText("15:45 IST").count();
  check("P12", before === 1 && afterMove === 1, `Fri 15:45 before reload ${before}, after ${afterMove}`);

  // P13: adjust by chat.
  await page.getByLabel("Change this week").fill("2 posts, no comments");
  await page.getByRole("button", { name: "Update plan" }).click();
  await page.getByText(/^Updated:/).waitFor();
  const h2 = await page.getByRole("heading", { level: 3 }).filter({ hasText: "Week of" }).innerText();
  check("P13", /3 messages, 0 comments, 2 posts/.test(h2), h2);

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
  check("P14", /20\d\d/.test(monthTitle) && chips === 5, `${monthTitle}, ${chips} chips`);
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

  // P18: clear everything removes the plan, the vault and the tracker.
  await page.getByRole("tab", { name: "Story Vault" }).click();
  await page.getByRole("button", { name: "Clear everything" }).click();
  await page.getByRole("button", { name: "Yes, delete everything" }).click();
  await page.waitForFunction(() => localStorage.getItem("lynkr:v1") === null);
  const saved = await stored();
  check("P18", saved === null, "storage key absent after clear");
  const people = saved?.connect?.people?.length ?? 0;
  check("C12", people === 0 && connectOverflow <= 0, `people after clear ${people}, Connect tab overflow at 390px ${connectOverflow}px`);

  check("console", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  check("run", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
