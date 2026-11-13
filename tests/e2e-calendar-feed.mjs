// Calendar v2 Stage 2, the screens, in a real browser at 1280 and 375 px (calendar plan U5, AE3, AE7).
// The feed and the move route are stubbed in the browser (page.route), so no database is needed: what is tested is what
// the person sees and does. The server logic is covered by tests/calendar-feed*.test.mts and calendar-move.test.mts.
// Needs the server in demo mode with the calendar on: LYNKR_MOCK=1 LYNKR_CALENDAR=v2 LYNKR_PAYWALL=0 (no database).
// Run: LYNKR_URL=http://localhost:3001 node tests/e2e-calendar-feed.mjs   (W=375 for the phone width only)
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { reachResults } from "./e2e-outreach-helpers.mjs";

const BASE = process.env.LYNKR_URL || "http://localhost:3000";
const WIDTHS = process.env.W ? [Number(process.env.W)] : [1280, 375];
const axeScript = readFileSync("node_modules/axe-core/axe.min.js", "utf-8");
const NOW = new Date("2026-11-11T06:00:00Z"); // Wednesday 11:30 IST; the week of Monday 2026-11-09

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}${detail ? ` - ${detail}` : ""}`);
};

const item = (id, owner, kind, day, time, over = {}) => ({
  id, owner, kind, day, time, status: "draft", statusText: "Draft", title: "Item", label: "Job seeker", why: null, href: "#app/posts", movable: true, gated: true, ...over,
});

/** The stubbed server's state: a week with a scheduled post (Thursday), a comment slot, a message slot, a meeting and a replaced step. */
function makeServer(paid) {
  const state = {
    paid,
    items: [
      item("plan:2026-11-09:post-0", "plan", "post", "2026-11-12", "09:00", { title: "Proof of work", status: "scheduled", statusText: "Reminder set" }),
      item("plan:2026-11-09:comment-0", "plan", "comment", "2026-11-13", "12:30", { title: "Comment" }),
      item("plan:2026-11-09:message-0", "plan", "message", "2026-11-12", "10:30", { title: "Pick someone to contact", href: "#app/outreach" }),
      item("outreach:m1", "outreach", "meeting", "2026-11-14", "15:00", { title: "Meeting · Priya", status: "due", statusText: "Due", href: "#app/outreach", movable: paid, lockedReason: paid ? undefined : "Needs a subscription" }),
      item("outreach:old", "outreach", "follow_up", "2026-11-11", "10:30", { title: "Follow-up · Dev", status: "replaced", statusText: "Replaced", movable: false }),
      item("plan:2026-11-09:message-1", "plan", "message", "2026-11-11", "10:30", { title: "Pick someone to contact", href: "#app/outreach" }),
      item("plan:2026-11-09:comment-1", "plan", "comment", "2026-11-10", "12:30", { title: "Comment" }),
    ],
    moves: [],
    refuse: null,
  };
  return state;
}

async function run(width, paid) {
  const tag = `${width < 600 ? "375" : "1280"}${paid ? "" : " free"}`;
  const id = (s) => `${tag} ${s}`;
  const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 812 : 900 }, timezoneId: "Asia/Kolkata", isMobile: width < 600, hasTouch: width < 600 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource.*(401|402|404|409|503)/.test(m.text()) && errors.push(m.text()));
  const server = makeServer(paid);
  try {
    await reachResults(page, BASE);
    // From here the browser believes it is signed in and the feed comes from the stub.
    await ctx.clock.setFixedTime(NOW);
    await page.route("**/api/account", (r) => r.fulfill({ json: { accounts: true, google: false, googleClientId: null, apple: false, linkedin: false, signedIn: true, email: "t@example.com", subscribed: false, hasBilling: false } }));
    await page.route("**/api/calendar/plan**", (r) => r.fulfill({ status: 401, json: { error: "Please sign in first." } }));
    await page.route("**/api/calendar?**", (r) => r.fulfill({ json: { items: server.items, sources: { plan: "ok", outreach: "ok", posts: "off", comments: "off" }, from: "2026-11-09", to: "2026-11-15", clamped: false, paid: server.paid } }));
    await page.route("**/api/calendar/move", async (r) => {
      const body = JSON.parse(r.request().postData() || "{}");
      server.moves.push(body);
      if (server.refuse) return r.fulfill({ status: server.refuse.status, json: { error: server.refuse.error } });
      const it = server.items.find((x) => x.id === body.id);
      const replacement = it && it.owner === "outreach" ? `outreach:r${server.moves.length}` : null;
      if (it) { server.items = server.items.map((x) => (x.id === body.id ? { ...x, id: replacement ?? x.id, day: body.day, time: body.time ?? x.time } : x)); }
      r.fulfill({ json: { ok: true, item: replacement ? { id: replacement } : null } });
    });
    // Plan chat: a move is made by the server through the item's owner, so the stub moves the post and says so (U7, AE6).
    const chatBodies = [];
    await page.route("**/api/plan", async (r) => {
      const body = JSON.parse(r.request().postData() || "{}");
      chatBodies.push(body);
      server.items = server.items.map((x) => (x.id === "plan:2026-11-09:post-0" ? { ...x, day: "2026-11-13" } : x));
      r.fulfill({ json: { counts: body.counts, times: body.times, understood: true, moved: true, reply: "Moved your post to Friday." } });
    });
    await page.reload();
    await page.getByRole("tab", { name: "This week" }).click();
    const view = page.locator("[data-calendar-view]");
    await view.waitFor({ timeout: 20000 });
    const mobile = width < 600;
    const chipOf = (itemId) => page.locator(`[data-chip="${itemId}"]:visible`);

    if (mobile) await page.locator("[data-view=day-list] button:has-text('Thu')").first().click(); // the phone opens on today (Wednesday)
    await chipOf("plan:2026-11-09:post-0").first().waitFor({ timeout: 10000 });
    // R4, R5: type, time, status as words, goal.
    const postChipText = mobile ? null : await chipOf("plan:2026-11-09:post-0").innerText();
    if (!mobile) check(id("F1 a chip shows its time, its status as words and its goal"), /09:00 IST/.test(postChipText) && /Reminder set/.test(postChipText) && /Job seeker/.test(postChipText), postChipText.replace(/\n/g, " | "));

    if (mobile) {
      // R3: a week strip, the chosen day's list, no sideways scroll.
      const dots = await page.locator("[data-view=day-list] button:has(.sr-only)").count();
      check(id("F2 the week strip marks the days that have items"), dots >= 3, `${dots} days`);
      check(id("F3 choosing a day lists that day's items"), (await chipOf("plan:2026-11-09:post-0").count()) === 1 && (await chipOf("plan:2026-11-09:comment-0").count()) === 0);
    } else {
      check(id("F2 the week grid has seven day columns"), (await page.locator("[data-view=week] > div").count()) === 7);
    }

    // A replaced step is struck through with its status text.
    if (!mobile) {
      const old = chipOf("outreach:old");
      const struck = await old.locator("button").first().evaluate((el) => getComputedStyle(el).textDecorationLine);
      check(id("F4 a replaced item is struck through and still says Replaced"), /line-through/.test(struck) && /Replaced/.test(await old.innerText()));
    }

    // AE3 (UI): Change date with the keyboard moves the post and keeps what the owner returns.
    await chipOf("plan:2026-11-09:post-0").getByRole("button", { name: /Change date/ }).focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Change date" });
    await dialog.waitFor({ timeout: 5000 });
    check(id("F5 Change date opens with focus on the date"), await page.evaluate(() => document.activeElement?.getAttribute("type") === "date"));
    await dialog.getByLabel("Date").fill("2026-11-10");
    await dialog.getByRole("button", { name: "Save" }).click();
    await dialog.getByRole("alert").waitFor({ timeout: 3000 });
    check(id("F6 a past day is refused inline and nothing is sent"), server.moves.length === 0 && (await dialog.getByRole("alert").count()) === 1, await dialog.getByRole("alert").innerText().catch(() => ""));
    await dialog.getByLabel("Date").fill("2026-11-13");
    await dialog.getByRole("button", { name: "Save" }).click();
    await page.locator("[data-undo-bar]").waitFor({ timeout: 8000 });
    check(id("F7 the move is sent once, with an op id, the day and the time"), server.moves.length === 1 && server.moves[0].day === "2026-11-13" && server.moves[0].time === "09:00" && !!server.moves[0].op_id, JSON.stringify(server.moves[0]));
    check(id("F8 the dialog closes and the offer to Undo appears"), (await page.getByRole("dialog").count()) === 0 && /Moved/.test(await page.locator("[data-undo-bar]").innerText()));

    // R15: Undo sends the reverse move with a new op id.
    await page.locator("[data-undo-bar]").getByRole("button", { name: "Undo" }).click();
    await page.waitForFunction(() => !document.querySelector("[data-undo-bar]"), null, { timeout: 8000 });
    const back = server.moves[1];
    check(id("F9 Undo sends the reverse move with a new op id"), server.moves.length === 2 && back.day === "2026-11-12" && back.time === "09:00" && back.op_id !== server.moves[0].op_id, JSON.stringify(back));

    // A refused move (the owner says no) shows its reason next to the item and sends once.
    if (paid && !mobile) {
      // An outreach move replaces the step: Undo must move the NEW step back, not the old one.
      await chipOf("outreach:m1").getByRole("button", { name: /Change date/ }).click();
      await page.getByRole("dialog").getByLabel("Date").fill("2026-11-15");
      await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
      await page.locator("[data-undo-bar]").waitFor({ timeout: 8000 });
      await page.locator("[data-undo-bar]").getByRole("button", { name: "Undo" }).click();
      await page.waitForFunction(() => !document.querySelector("[data-undo-bar]"), null, { timeout: 8000 });
      const last = server.moves.at(-1);
      check(id("F9a Undo of an outreach move targets the replacement step"), /^outreach:r\d+$/.test(last.id) && last.day === "2026-11-14", JSON.stringify(last));
    }
    server.refuse = { status: 409, error: "Publishing now" };
    await chipOf("plan:2026-11-09:post-0").getByRole("button", { name: /Change date/ }).click();
    await page.getByRole("dialog").getByLabel("Date").fill("2026-11-14");
    const movesBefore = server.moves.length;
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await page.getByRole("dialog").getByRole("alert").waitFor({ timeout: 5000 });
    check(id("F10a a refused move stays in the dialog with the owner's reason, and was sent once"), /Publishing now/.test(await page.getByRole("dialog").getByRole("alert").innerText()) && server.moves.length === movesBefore + 1);
    server.refuse = null;
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "detached", timeout: 3000 });
    check(id("F10 Esc closes Change date and returns focus to the chip's menu button"), await page.evaluate(() => /Change date for/.test(document.activeElement?.getAttribute("aria-label") || "")));

    if (!mobile) {
      // Drag (desktop): Thursday's scheduled post dropped on Friday keeps its time; a past day is refused.
      const before = server.moves.length;
      const src = chipOf("plan:2026-11-09:comment-0");
      const target = page.locator("[data-day='2026-11-14']");
      const dt = await page.evaluateHandle(() => new DataTransfer());
      await src.dispatchEvent("dragstart", { dataTransfer: dt });
      const marks = await page.locator("[data-drop-ok]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-day"), e.getAttribute("data-drop-ok")]));
      check(id("F11 while dragging, valid days are marked and past days are not"), marks.find((m) => m[0] === "2026-11-14")?.[1] === "true" && marks.find((m) => m[0] === "2026-11-10")?.[1] === "false", JSON.stringify(marks.slice(0, 3)));
      await target.dispatchEvent("drop", { dataTransfer: dt });
      await page.locator("[data-undo-bar]").waitFor({ timeout: 8000 });
      check(id("F12 dropping on a day moves it and keeps its time"), server.moves.length === before + 1 && server.moves.at(-1).day === "2026-11-14" && server.moves.at(-1).time === undefined, JSON.stringify(server.moves.at(-1)));
      const past = page.locator("[data-day='2026-11-10']");
      const dt2 = await page.evaluateHandle(() => new DataTransfer());
      await chipOf("plan:2026-11-09:comment-0").dispatchEvent("dragstart", { dataTransfer: dt2 });
      const n = server.moves.length;
      await past.dispatchEvent("drop", { dataTransfer: dt2 });
      await page.waitForTimeout(400);
      check(id("F13 dropping on a past day sends nothing"), server.moves.length === n);
    }

    if (!paid) {
      // AE7: a free account can move a plan slot but sees the paywall card for a gated item, and a locked meeting says why.
      check(id("F14 a meeting it cannot move says why instead of offering Change date"), /Needs a subscription/.test(await chipOf("outreach:m1").first().innerText()) && (await chipOf("outreach:m1").getByRole("button", { name: /Change date/ }).count()) === 0);
      await chipOf("plan:2026-11-09:message-0").first().getByRole("button", { name: /^Pick someone to contact,/ }).click();
      await page.locator("[data-paywall-card]").waitFor({ timeout: 4000 });
      check(id("F15 opening a gated item shows the paywall card"), /part of the subscription/.test(await page.locator("[data-paywall-card]").innerText()));
    }

    // U7: a chat move reloads the grid, shows the reply, and sends the week's Monday so the server can find the item.
    await page.getByLabel("Change this week").fill("move Thursday's post to Friday");
    await page.getByRole("button", { name: "Update plan" }).click();
    await page.getByText("Moved your post to Friday.").waitFor({ timeout: 8000 });
    check(id("F21 a chat move shows the reply and sends the week"), chatBodies.length === 1 && chatBodies[0].weekStart === "2026-11-09", JSON.stringify(chatBodies[0] ?? {}).slice(0, 160));
    if (!mobile) {
      await page.locator("[data-day='2026-11-13'] [data-chip='plan:2026-11-09:post-0']").waitFor({ timeout: 8000 });
      check(id("F22 the grid shows the post on Friday after the chat move"), (await page.locator("[data-day='2026-11-12'] [data-chip='plan:2026-11-09:post-0']").count()) === 0);
    }

    // U8: Today is today's slice of the calendar, with what is overdue, and the week's N of M.
    await page.evaluate(() => { window.location.hash = "#app/today"; });
    await page.locator("[data-today-feed]").waitFor({ timeout: 8000 });
    const todayText = await page.locator("[data-today-feed]").innerText();
    check(id("F23 Today lists today's item and the overdue one, with how late"), /Pick someone to contact/.test(todayText) && /1 day late/.test(todayText) && !/Follow-up · Dev/.test(todayText), todayText.replace(/\n/g, " | ").slice(0, 160));
    check(id("F24 the ring counts the week from the feed"), /0\/6/.test(await page.locator("main").innerText()));
    const mainText = await page.locator("main").innerText();
    check(id("F25 the plan card says the calculated mix, not the fixed sentence"), /with reminders\./.test(mainText) && !/Three messages, two comments and one post/.test(mainText));
    await page.evaluate(() => { window.location.hash = "#app/plan"; });
    await page.locator("[data-calendar-view]").waitFor({ timeout: 8000 });

    // U9: the week's calendar file has an event for every open item, and adds no attendee.
    await page.locator(mobile ? "[data-view=day-list] [data-chip]" : "[data-view=week] [data-chip]").first().waitFor({ timeout: 8000 });
    await page.waitForFunction(() => document.querySelectorAll("button").length > 0 && ![...document.querySelectorAll("button")].some((b) => /^Download week/.test(b.textContent || "") && !b.closest("[data-calendar-view]")), null, { timeout: 8000 });
    const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 8000 }), page.getByRole("button", { name: /Download week/ }).click()]);
    const icsText = readFileSync(await dl.path(), "utf-8");
    const events = (icsText.match(/BEGIN:VEVENT/g) ?? []).length;
    check(id("F26 the week file has one event per open item, every owner, and no attendee"), events === 6 && /BEGIN:VCALENDAR/.test(icsText) && !/ATTENDEE/.test(icsText), `${events} events`);

    // Month view: three chips then "+N more", which opens the day in the week view.
    if (!mobile) {
      server.items = [...server.items, ...Array.from({ length: 6 }, (_, i) => item(`plan:2026-11-09:extra-${i}`, "plan", "comment", "2026-11-18", `0${i}:00`, { title: `Extra ${i}` }))];
      await page.getByRole("tab", { name: "Month" }).click();
      await page.locator("[data-view=month]").waitFor({ timeout: 8000 });
      const cell = page.locator("[data-day='2026-11-18']");
      check(id("F19 a month day with 6 items shows 3 chips and '+3 more'"), (await cell.locator("[data-chip]").count()) === 3 && (await cell.getByRole("button", { name: "+3 more" }).count()) === 1);
      await cell.getByRole("button", { name: "+3 more" }).click();
      await page.locator("[data-view=week]").waitFor({ timeout: 8000 });
      check(id("F20 '+N more' opens that day in the week view"), (await page.locator("[data-day='2026-11-18'] [data-chip]").count()) === 6);
    }

    // Accessibility and layout.
    await page.waitForTimeout(500);
    await page.addScriptTag({ content: axeScript });
    const v = await page.evaluate(async () => {
      const r = await window.axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
      return r.violations.filter((x) => x.impact === "critical" || x.impact === "serious").map((x) => `${x.id} (${x.nodes[0]?.target?.join(" ") ?? "?"})`);
    });
    check(id("F16 no serious axe violations"), v.length === 0, v.join(" | ").slice(0, 300));
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(id("F17 no horizontal overflow"), over <= 1, `${over}px`);
    check(id("F18 no JS errors"), errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 250));
    await browser.close();
    return true;
  } catch (e) {
    check(id("FATAL"), false, e.message.split("\n")[0]);
    if (process.env.LYNKR_DEBUG) console.log((await page.locator("main").innerText().catch(() => "")).slice(0, 700));
    await browser.close();
    return false;
  }
}

let allPass = true;
const ONLY = process.env.ONLY; // "paid" or "free"
if (ONLY !== "free") for (const w of WIDTHS) {
  console.log(`\n=== Calendar feed at ${w}px (paid) ===`);
  allPass = (await run(w, true)) && allPass;
}
if (ONLY !== "paid") {
  console.log(`\n=== Calendar feed at 1280px (free) ===`);
  allPass = (await run(1280, false)) && allPass;
}
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
process.exit(allPass && results.every((r) => r.ok) ? 0 : 1);
