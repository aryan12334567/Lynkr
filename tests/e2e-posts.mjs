// Posts v2 workspace, the screens, in a real browser at 1280 and 375 px (posts plan U10, U11).
// Every Posts route is replaced by an in-memory fake that follows the route contract (page.route), so no database or model
// is needed: what is tested is what the person sees and does. The server logic is covered by tests/posts-*.test.mts.
// Needs the server in demo mode: LYNKR_MOCK=1 LYNKR_INTERVIEW=v2 LYNKR_CALENDAR=v2 LYNKR_PAYWALL=0 (no database).
// Run: LYNKR_URL=http://localhost:3005 node tests/e2e-posts.mjs   (W=375 for the phone width only)
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { reachResults } from "./e2e-outreach-helpers.mjs";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const WIDTHS = process.env.W ? [Number(process.env.W)] : [1280, 375];
const axeScript = readFileSync("node_modules/axe-core/axe.min.js", "utf-8");
const NOW = new Date("2026-11-11T06:00:00Z"); // Wednesday 11:30 IST; the week of Monday 2026-11-09
const WEEK = "2026-11-09";

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};

const QUESTIONS = [
  { key: "what", text: "What did you do?", example: "For example: I cleaned the fest survey data before the committee meeting." },
  { key: "result", text: "What changed because of it?", example: "For example: the meeting took 30 minutes, not 2 hours." },
  { key: "next", text: "What would you do differently?", example: "For example: I would check the export first." },
];
const THIN = { key: "thin", text: "Tell me one specific moment from this, even in rough words.", example: "For example: who asked, what you did first, what changed." };
const BODIES = [
  "I cleaned 6 messy survey sheets for our college fest last term. Nobody asked me to. It cut our follow-up meeting from 2 hours to 30 minutes.",
  "Last term I fixed 6 survey sheets for the fest committee. The follow-up meeting went from 2 hours to 30 minutes after that.",
  "Our fest committee lost hours on messy sheets. I cleaned 6 of them, and our meeting dropped from 2 hours to 30 minutes.",
];

/** The fake Posts server: slots, interview, versions, editing, scheduling and the LinkedIn switch. */
function makeServer() {
  const s = { posts: [], answers: {}, versions: {}, needMore: new Set(), n: 0, calls: { interview: 0, versions: 0 }, schedules: [], fail: null, linkedin: { autopublish: false, connected: false, canPublish: false, expiresAt: null } };
  const SLOTS = [
    { index: 0, type: "proof", day: "2026-11-12", time: "09:00", brief: "Show one piece of work you did and what it led to." },
    { index: 1, type: "observation", day: "2026-11-13", time: "12:30", brief: "Share one thing you noticed first-hand and why it matters." },
  ];
  const now = () => new Date().toISOString();
  const mk = (over) => ({ id: `p${++s.n}`, type: "proof", brief: "", mode: "quick", status: "draft", weekStart: null, slotIndex: null, scheduledAt: null, currentVersionId: null, createdAt: now(), updatedAt: now(), publishMode: null, publishedAt: null, linkedinUrn: null, failReason: null, ...over });
  const addVersion = (post, body, source, instruction = null, batch = 0) => {
    const list = (s.versions[post.id] ??= []);
    const v = { id: `${post.id}v${list.length + 1}`, n: list.length + 1, batch, body, why: `Starts with what you did. (${source})`, source, instruction, createdAt: now() };
    list.push(v);
    post.currentVersionId = v.id;
    return v;
  };
  // Slot 2 starts approved with a text, so the release screen can be reached at once.
  const seeded = mk({ type: "observation", brief: SLOTS[1].brief, weekStart: WEEK, slotIndex: 1, status: "approved" });
  s.posts.push(seeded);
  s.answers[seeded.id] = [];
  addVersion(seeded, BODIES[2], "write", null, 1);
  const stepOf = (post) => {
    const a = (s.answers[post.id] ?? []).filter((x) => x.key !== "thin");
    const cap = post.mode === "thorough" ? 5 : 3;
    return a.length >= cap ? { kind: "done", reason: "cap", note: "That is all I need. Time to write." } : { kind: "question", question: { ...QUESTIONS[a.length % 3], index: a.length, cap } };
  };
  const find = (id) => s.posts.find((p) => p.id === id);
  s.handle = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const json = (data, status = 200) => route.fulfill({ status, json: data });
    if (s.fail && s.fail.path === path && s.fail.method === method && (!s.fail.match || s.fail.match(body))) {
      const f = s.fail;
      s.fail = null;
      return json(f.json, f.status);
    }
    if (path === "/api/posts/linkedin") return json(s.linkedin);
    if (path === "/api/posts/interview") {
      s.calls.interview++;
      const post = find(body.id);
      if (body.mode) post.mode = body.mode;
      if (body.answer && body.key) (s.answers[post.id] ??= []).push({ turn: (s.answers[post.id] ?? []).length + 1, key: body.key, question: body.key, answer: body.answer });
      const step = body.writeNow ? { kind: "done", reason: "write_now", note: "Writing it now from what you've told me." } : stepOf(post);
      return json({ post, answers: s.answers[post.id] ?? [], step });
    }
    if (path === "/api/posts/versions") {
      s.calls.versions++;
      const post = find(body.id);
      if (body.mode === "generate") {
        if (s.needMore.has(post.id) && !(s.answers[post.id] ?? []).some((a) => a.key === "thin")) return json({ result: "need_more", message: "I couldn't write this from what you told me without inventing something. Answer one more question and I'll try again.", question: THIN, stop: false });
        const batch = Math.max(0, ...(s.versions[post.id] ?? []).map((v) => v.batch)) + 1;
        const made = BODIES.map((b) => addVersion(post, b, "write", null, batch));
        return json({ result: "versions", versions: made, dropped: 1, note: null, post });
      }
      const base = (s.versions[post.id] ?? []).find((v) => v.id === body.versionId);
      const v = addVersion(post, base.body.split(". ")[0].replace(/\.+$/, "") + ".", "refine", body.instruction);
      return json({ result: "refined", version: v, post });
    }
    if (path === "/api/posts/schedule") {
      s.schedules.push(body);
      const post = find(body.id);
      if (body.markPosted) Object.assign(post, { status: "published", publishedAt: now() });
      else if (body.at === null) Object.assign(post, { status: "approved", scheduledAt: null, publishMode: null });
      else Object.assign(post, { status: "scheduled", scheduledAt: body.at, publishMode: s.linkedin.canPublish ? "auto" : "manual" });
      return json({ post });
    }
    if (path !== "/api/posts") return json({ error: "Not found." }, 404);
    if (method === "GET") {
      const id = url.searchParams.get("id");
      if (id) {
        const post = find(id);
        return json({ post, answers: s.answers[id] ?? [], versions: s.versions[id] ?? [], interview: stepOf(post) });
      }
      if (url.searchParams.get("week")) return json({ weekStart: WEEK, slots: SLOTS.map((x) => ({ ...x, post: s.posts.find((p) => p.weekStart === WEEK && p.slotIndex === x.index) ?? null })), others: [] });
      return json({ posts: s.posts });
    }
    if (method === "POST") {
      let post;
      if ("slot" in body) {
        post = s.posts.find((p) => p.weekStart === body.weekStart && p.slotIndex === body.slot);
        if (!post) {
          const slot = SLOTS[body.slot];
          post = mk({ type: slot.type, brief: body.brief ?? slot.brief, weekStart: body.weekStart, slotIndex: body.slot });
          s.posts.push(post);
        }
      } else {
        post = mk({ type: body.type, brief: body.brief });
        s.posts.push(post);
        s.needMore.add(post.id);
      }
      return json({ post }, 201);
    }
    if (method === "PATCH") {
      const post = find(body.id);
      if (body.brief !== undefined) post.brief = body.brief;
      if (body.status) post.status = body.status;
      if (body.versionId) post.currentVersionId = body.versionId;
      if (body.text !== undefined) {
        const v = addVersion(post, body.text, "manual");
        const problems = /synergy/i.test(body.text) ? [{ code: "banned_phrase", message: "\"synergy\" is a phrase that sounds like AI. Say it in plain words." }] : [];
        return json({ post, version: v, problems });
      }
      return json({ post });
    }
    return json({ error: "Not found." }, 404);
  };
  return s;
}

async function run(width) {
  const tag = width < 600 ? "375" : "1280";
  const id = (x) => `${tag} ${x}`;
  const mobile = width < 600;
  const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width, height: mobile ? 812 : 900 }, timezoneId: "Asia/Kolkata", isMobile: mobile, hasTouch: mobile, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(401|402|404|409|500|503)/.test(m.text()) && errors.push(m.text()));
  const server = makeServer();
  try {
    await reachResults(page, BASE);
    await ctx.clock.setFixedTime(NOW);
    await page.route("**/api/account", (r) => r.fulfill({ json: { accounts: true, google: false, googleClientId: null, apple: false, linkedin: false, signedIn: true, email: "t@example.com", subscribed: true, hasBilling: false } }));
    await page.route("**/api/status", async (r) => {
      const real = await r.fetch();
      r.fulfill({ json: { ...(await real.json()), posts: "v2", calendar: "v2" } });
    });
    await page.route("**/api/calendar/plan**", (r) => r.fulfill({ status: 401, json: { error: "Please sign in first." } }));
    await page.route("**/api/calendar?**", (r) => r.fulfill({ json: { items: [], sources: { plan: "ok", outreach: "ok", posts: "ok", comments: "off" }, from: WEEK, to: "2026-11-15", clamped: false, paid: true } }));
    await page.route("**/api/posts**", (r) => server.handle(r));
    await page.addInitScript(() => { window.__calChanged = 0; window.addEventListener("lynkr:calendar-changed", () => { window.__calChanged++; }); });
    await page.reload();
    await page.getByRole("tab", { name: "Posts & comments" }).click();
    const ws = page.locator("[data-posts-workspace]");
    await ws.waitFor({ timeout: 20000 });
    const dialog = page.locator("dialog[data-post-panel]");
    const pill = () => dialog.locator("h2 + p");

    // U10: the slots, each with its type in words, day and time, brief and state in words.
    const cards = ws.locator("[data-slot-card]");
    await cards.nth(1).waitFor({ timeout: 10000 });
    const c0 = await cards.nth(0).innerText();
    const c1 = await cards.nth(1).innerText();
    check(id("P1 slots show type, day and time, and the state in words"), (await cards.count()) === 2 && /Proof of work/.test(c0) && /Thu, 12 Nov, 09:00 IST/.test(c0) && /Not started/.test(c0) && /Approved/.test(c1), `${c0.replace(/\n/g, " | ").slice(0, 90)}`);
    check(id("P1a the brief is editable with a counter, and today's cards are still there"), (await cards.nth(0).getByLabel("What this post is about").inputValue()).length > 10 && /of 400 characters/.test(c0) && (await page.getByText("Posts from your own work").count()) === 1);

    // Interview: Quick or Thorough first, one question at a time, the example, a counter, Next, Write it now.
    const start = cards.nth(0).getByRole("button", { name: /^Start this post: Proof of work/ });
    await start.click();
    await dialog.waitFor({ timeout: 8000 });
    const ans = dialog.getByRole("textbox", { name: "What did you do?" });
    await ans.waitFor({ timeout: 8000 });
    check(id("P2 the interview asks Quick or Thorough first, then one question with its example"), (await dialog.getByRole("radio").count()) === 2 && /fest survey data/.test(await dialog.innerText()));
    await dialog.getByRole("radio", { name: /^Quick/ }).check();
    await ans.fill("I cleaned 6 messy survey sheets for our fest.");
    check(id("P2a the counter follows the answer"), /45 of 1,500 characters/.test(await dialog.innerText()) || /\d+ of 1,500 characters/.test(await dialog.innerText()));
    const before = server.calls.interview;
    await dialog.getByRole("button", { name: "Next", exact: true }).dblclick();
    await dialog.getByRole("textbox", { name: "What changed because of it?" }).waitFor({ timeout: 8000 });
    check(id("P3 Next is sent once even when pressed twice, and the next question appears"), server.calls.interview === before + 1, `${server.calls.interview - before} request(s)`);
    check(id("P3a the radio choice is gone after the first answer"), (await dialog.getByRole("radio").count()) === 0);
    await dialog.getByRole("textbox", { name: "What changed because of it?" }).fill("Our follow-up meeting went from 2 hours to 30 minutes.");
    await dialog.getByRole("button", { name: "Write it now" }).click();

    // Versions: the cards, the why line, the note about the dropped one, "Use this one".
    await dialog.getByRole("button", { name: "Use version 1" }).waitFor({ timeout: 10000 });
    const vtext = await dialog.innerText();
    check(id("P4 three versions appear with their why line and a note that one was left out"), (await dialog.getByRole("button", { name: /^Use version/ }).count()) === 3 && /Why this one/.test(vtext) && /1 version was left out/.test(vtext));
    await dialog.getByRole("button", { name: "Use version 2" }).click();
    const editor = dialog.getByRole("textbox", { name: "Your post" });
    await editor.waitFor({ timeout: 8000 });
    check(id("P5 choosing a version opens the editor with its text and a live word count"), (await editor.inputValue()) === BODIES[1] && /\d+ words\. For a first draft, 90 to 180 words works well\./.test(await dialog.innerText()));
    await editor.fill(`${BODIES[1]} We built real synergy.`);
    check(id("P5a Approve waits while there are unsaved changes"), await dialog.getByRole("button", { name: "Approve" }).isDisabled());
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await dialog.getByRole("alert").filter({ hasText: "sounds like AI" }).waitFor({ timeout: 8000 });
    check(id("P6 a save with a problem lists it in words under the text, and Approve stays off"), await dialog.getByRole("button", { name: "Approve" }).isDisabled());

    // Accessibility with the editor open (problems showing).
    await page.addScriptTag({ content: axeScript });
    const axeNow = () => page.evaluate(async () => {
      const r = await window.axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
      return r.violations.filter((x) => x.impact === "critical" || x.impact === "serious").map((x) => `${x.id} (${x.nodes[0]?.target?.join(" ") ?? "?"})`);
    });
    const v1 = await axeNow();
    check(id("P6a no serious axe violations with the editor open"), v1.length === 0, v1.join(" | ").slice(0, 300));
    if (mobile) {
      const small = await page.evaluate(() => [...document.querySelectorAll("dialog[data-post-panel] button, dialog[data-post-panel] a, dialog[data-post-panel] summary")].filter((e) => e.offsetParent !== null && e.getBoundingClientRect().height < 43.5).map((e) => (e.textContent || "").trim().slice(0, 20)));
      check(id("P6b every button and link in the panel is at least 44px tall"), small.length === 0, small.join(", "));
    }
    const dw = await page.evaluate(() => { const d = document.querySelector("dialog[data-post-panel]"); return d.scrollWidth - d.clientWidth; });
    check(id("P6c the panel has no sideways scroll"), dw <= 1, `${dw}px`);

    // Refine adds to History, Restore goes back.
    await dialog.locator("details summary").click();
    const hist = () => dialog.locator("details li").count();
    await dialog.getByRole("button", { name: "Restore version 2" }).click();
    await page.waitForFunction((t) => document.querySelector("dialog[data-post-panel] textarea")?.value === t, BODIES[1], { timeout: 8000 });
    const h0 = await hist();
    await dialog.getByRole("button", { name: "Shorter" }).click();
    await page.waitForFunction((n) => document.querySelectorAll("dialog[data-post-panel] details li").length > n, h0, { timeout: 8000 });
    check(id("P7 a refine adds a version to History"), (await hist()) === h0 + 1, h0 + " to " + (await hist()));
    const current = await editor.inputValue();
    check(id("P7a the refined text is in the editor and is shorter"), current.length < BODIES[1].length, current.length + " chars");
    await dialog.getByRole("button", { name: "Restore version 2" }).click();
    await page.waitForFunction((t) => document.querySelector("dialog[data-post-panel] textarea")?.value === t, BODIES[1], { timeout: 8000 });
    check(id("P7b Restore puts an earlier version back as the current text"), /Version 2: Written by Lynkr \(current\)/.test(await dialog.locator("details").innerText()));

    // Approve: a 500 shows the server's text and the button works again.
    server.fail = { path: "/api/posts", method: "PATCH", match: (b) => b.status === "approved", status: 500, json: { error: "Our server had a problem. Try again." } };
    const approve = dialog.getByRole("button", { name: "Approve" });
    await approve.click();
    await dialog.getByRole("alert").filter({ hasText: "Our server had a problem. Try again." }).waitFor({ timeout: 8000 });
    check(id("P8 a 500 shows the server's words and Approve can be pressed again"), await approve.isEnabled());
    await approve.click();
    await pill().filter({ hasText: "Approved" }).waitFor({ timeout: 8000 });
    check(id("P9 Approve sets the state to Approved"), true);

    // After approval: copy, LinkedIn, the plain line, a reminder.
    await dialog.getByRole("button", { name: "Copy text" }).click();
    await dialog.getByRole("button", { name: "Copied" }).waitFor({ timeout: 4000 });
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    check(id("P10 Copy puts the text on the clipboard and says Copied"), clip.trim() === BODIES[1].trim());
    const li = dialog.getByRole("link", { name: /Open LinkedIn/ });
    check(id("P10a Open LinkedIn opens a new tab safely"), (await li.getAttribute("href")) === "https://www.linkedin.com/feed/?shareActive=true" && (await li.getAttribute("target")) === "_blank" && /noopener/.test((await li.getAttribute("rel")) ?? ""));
    check(id("P11 the plain line is shown and there is no Schedule it"), /Lynkr does not post for you\. Copy it, post it on LinkedIn, then tick Posted\./.test(await dialog.innerText()) && (await dialog.getByRole("button", { name: "Schedule it" }).count()) === 0);
    await dialog.getByLabel("Date").fill("2026-11-12");
    await dialog.getByLabel("Time (IST)").fill("09:30");
    await dialog.getByRole("button", { name: "Set reminder" }).click();
    await pill().filter({ hasText: "Reminder set for Thu, 12 Nov, 09:30 IST" }).waitFor({ timeout: 8000 });
    check(id("P12 a reminder is set and the state says Reminder set for the day and time"), server.schedules.at(-1)?.at === "2026-11-12T04:00:00.000Z", JSON.stringify(server.schedules.at(-1)));
    check(id("P12a the Calendar is told"), (await page.evaluate(() => window.__calChanged)) > 0);
    await dialog.getByRole("button", { name: "Cancel schedule" }).click();
    await pill().filter({ hasText: /^Approved$/ }).waitFor({ timeout: 8000 });
    check(id("P13 Cancel schedule sends null and goes back to Approved"), server.schedules.at(-1)?.at === null && (await dialog.getByRole("button", { name: "Cancel schedule" }).count()) === 0);
    await dialog.getByRole("button", { name: "I posted it" }).click();
    await pill().filter({ hasText: /^Posted$/ }).waitFor({ timeout: 8000 });
    check(id("P14 I posted it shows Posted"), server.schedules.at(-1)?.markPosted === true);
    // Keyboard: Esc closes and focus returns to the card.
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached", timeout: 4000 });
    check(id("P15 Esc closes the panel and focus goes back into the slot card"), await page.evaluate(() => !!document.activeElement?.closest("[data-slot-card]")));
    await cards.nth(0).getByText("Posted", { exact: true }).waitFor({ timeout: 5000 });
    check(id("P15a the slot card says Posted"), true);

    // A free post: 402 shows the paywall card; then an error from the server, Write it now, and a question sent back.
    await ws.getByRole("button", { name: "Write a post that isn't in the plan" }).click();
    await ws.getByLabel("What this post is about").last().fill("The day my dashboard broke in front of the committee.");
    server.fail = { path: "/api/posts", method: "POST", status: 402, json: { error: "Subscription needed", code: "subscription_required" } };
    await ws.getByRole("button", { name: "Start this post", exact: true }).click();
    await page.locator("[data-paywall-card]").waitFor({ timeout: 6000 });
    check(id("P16 a 402 shows the subscription card"), /part of the subscription/.test(await page.locator("[data-paywall-card]").innerText()));
    await ws.getByRole("button", { name: "Start this post", exact: true }).click();
    await dialog.waitFor({ timeout: 8000 });
    const q1 = dialog.getByRole("textbox", { name: "What did you do?" });
    await q1.fill("My dashboard showed zero sales because I joined on the wrong column.");
    server.fail = { path: "/api/posts/interview", method: "POST", status: 500, json: { error: "The writer is busy. Try again in a minute." } };
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByRole("alert").filter({ hasText: "The writer is busy" }).waitFor({ timeout: 8000 });
    check(id("P17 a 500 in the interview shows the server's words and Next works again"), await dialog.getByRole("button", { name: "Next", exact: true }).isEnabled());
    await dialog.getByRole("button", { name: "Write it now" }).click();
    const thin = dialog.getByRole("textbox", { name: THIN.text });
    await thin.waitFor({ timeout: 10000 });
    check(id("P18 when more is needed the returned question comes back with its message"), /without inventing something/.test(await dialog.innerText()));
    await thin.fill("My lead asked why sales were zero, and I found the wrong join in ten minutes.");
    await dialog.getByRole("button", { name: "Next", exact: true }).click();
    await dialog.getByRole("button", { name: "Use version 1" }).waitFor({ timeout: 10000 });
    check(id("P19 answering it writes the versions"), (await dialog.getByRole("button", { name: /^Use version/ }).count()) === 3);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached", timeout: 4000 });

    // The wording changes when the account can publish.
    server.linkedin = { autopublish: true, connected: true, canPublish: true, expiresAt: null };
    await page.reload();
    await page.getByRole("tab", { name: "Posts & comments" }).click();
    await ws.locator("[data-slot-card]").nth(1).waitFor({ timeout: 15000 });
    await ws.locator("[data-slot-card]").nth(1).getByRole("button", { name: /^Open: Something I noticed/ }).click();
    await dialog.getByRole("button", { name: "Schedule it" }).waitFor({ timeout: 8000 });
    const t = await dialog.innerText();
    check(id("P20 with canPublish the wording is Schedule it and the once-only line"), /Lynkr will publish this once, at the time you choose, to your own profile\. You can cancel until it starts\./.test(t) && !/Lynkr does not post for you/.test(t));
    await dialog.getByLabel("Date").fill("2026-11-12");
    await dialog.getByLabel("Time (IST)").fill("10:00");
    await dialog.getByRole("button", { name: "Schedule it" }).click();
    await pill().filter({ hasText: "Scheduled for Thu, 12 Nov, 10:00 IST" }).waitFor({ timeout: 8000 });
    check(id("P21 a scheduled post says Scheduled for the day and time"), true);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached", timeout: 4000 });

    const v2 = await axeNow().catch(async () => { await page.addScriptTag({ content: axeScript }); return axeNow(); });
    check(id("P22 no serious axe violations on the list"), v2.length === 0, v2.join(" | ").slice(0, 300));
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(id("P23 no horizontal overflow"), over <= 1, `${over}px`);
    check(id("P24 no JS errors"), errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 250));
    await browser.close();
    return true;
  } catch (e) {
    check(id("FATAL"), false, e.message.split("\n")[0]);
    if (process.env.LYNKR_DEBUG) console.log((await page.locator("main").innerText().catch(() => "")).slice(0, 900));
    await browser.close();
    return false;
  }
}

let allPass = true;
for (const w of WIDTHS) {
  console.log(`\n=== Posts at ${w}px ===`);
  allPass = (await run(w)) && allPass;
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exit(allPass && results.every((r) => r.ok) ? 0 : 1);
