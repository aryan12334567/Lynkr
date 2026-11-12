import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { insertDraft } from "../extension/dist/insert.js";
import { SELECTION_PROBLEM_TEXT, commentBody, commenterOn, flagSegments, isLinkedInTab, selectionProblem } from "../extension/dist/api.js";

// The Commenter in the side panel (plan U5). Local files only: the fixture page stands in for LinkedIn, the built
// panel is served from a stub address, and Lynkr's API is answered by the test. linkedin.com is never opened.

const FIXTURE = pathToFileURL(resolve("tests/fixtures/linkedin-like.html")).href;
const PANEL = "https://www.lynkr.cloud/panel/";
const DIST = resolve("extension/dist");
const axeScript = readFileSync("node_modules/axe-core/axe.min.js", "utf-8");
const LI = "https://www.linkedin.com/feed/";

let shared;
const launch = async () => (shared ??= await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true }));
after(async () => { await shared?.close(); });

const POST = "Priya Shah\nData Lead at Swiggy\n2d •\nMost teams skip cleaning the survey data and then wonder why the dashboard is wrong.\nWe fixed the inputs first, and the report time dropped.";
const opt = (angle, body, extra = {}) => ({ angle, body, postAnchor: "Most teams skip cleaning the survey data", factRefs: [], why: "Answers the survey data line.", flags: [], ...extra });
const OPTIONS = {
  status: "options", goal: "job_seeker", author: { name: "Priya Shah", headline: "Data Lead at Swiggy" }, dropped: 0,
  options: [opt("experience", "When I cleaned the fest survey data first, the summary changed shape."), opt("add", "Inputs first is the part nobody budgets for, and the dashboard follows from it.")],
};

// ---- pure rules ----

test("R4: the panel refuses a selection that cannot be answered before any request", () => {
  assert.equal(selectionProblem("too short"), "short");
  assert.equal(selectionProblem("x".repeat(3601)), "long");
  assert.equal(selectionProblem(`${"word ".repeat(10)}…see more`), "see_more");
  assert.equal(selectionProblem(POST), null);
  assert.match(SELECTION_PROBLEM_TEXT.see_more, /see more/);
});

test("R10: Insert only runs on https://www.linkedin.com/", () => {
  assert.equal(isLinkedInTab("https://www.linkedin.com/feed/"), true);
  for (const bad of [undefined, "", "https://mail.google.com/", "https://linkedin.com/feed/", "https://www.linkedin.com.evil.test/", "http://www.linkedin.com/", "https://user@www.linkedin.com/", "https://www.linkedin.com:8443/", "not a url"]) assert.equal(isLinkedInTab(bad), false, String(bad));
});

test("flagged sentences are split out for 'Check this line' and nothing is lost", () => {
  const body = "First sentence is fine. A claim that rests on nothing. Last one.";
  const segs = flagSegments(body, ["A claim that rests on nothing."]);
  assert.equal(segs.map(s => s.text).join(""), body);
  assert.deepEqual(segs.filter(s => s.flagged).map(s => s.text), ["A claim that rests on nothing."]);
  assert.deepEqual(flagSegments(body, ["not in the body"]), [{ text: body, flagged: false }]);
});

test("the request carries the selection, and the goal, reaction and author only when the person set them", () => {
  assert.deepEqual(commentBody(POST, null, "  ", undefined), { selection: POST });
  assert.deepEqual(commentBody(POST, "freelancer", " mine ", { name: "Priya", headline: "Lead" }), { selection: POST, goal: "freelancer", reaction: "mine", author: { name: "Priya", headline: "Lead" } });
  assert.equal(commentBody("y".repeat(5000), null, "", undefined).selection.length, 4000);
});

test("the Commenter counts as on only when Lynkr clearly says on, and never asks a foreign origin", async () => {
  const ask = (body, ok = true) => async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 });
  assert.equal(await commenterOn("https://www.lynkr.cloud", ask({ commenter: "on" })), true);
  assert.equal(await commenterOn("https://www.lynkr.cloud", ask({ commenter: "off" })), false);
  assert.equal(await commenterOn("https://www.lynkr.cloud", ask({})), false);
  assert.equal(await commenterOn("https://www.lynkr.cloud", ask({ commenter: "on" }, false)), false);
  assert.equal(await commenterOn("https://www.lynkr.cloud", async () => { throw new Error("offline"); }), false);
  let called = false;
  assert.equal(await commenterOn("https://evil.test", async () => { called = true; return new Response("{}"); }), false);
  assert.equal(called, false);
});

// ---- static checks on the built extension ----

test("the menu is limited to LinkedIn, nothing is cut silently, and no manifest permission was added", async () => {
  const bg = await readFile("extension/dist/background.js", "utf8");
  assert.match(bg, /documentUrlPatterns/);
  assert.match(bg, /isLinkedInTab/);
  assert.ok(!/slice\(0,\s*3000\)/.test(bg), "the silent 3,000 character cut is gone");
  const manifest = JSON.parse(await readFile("extension/dist/manifest.json", "utf8"));
  assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"]);
  assert.ok(!manifest.content_scripts && !JSON.stringify(manifest).includes("linkedin"));
  const panel = await readFile("extension/dist/sidepanel.js", "utf8");
  assert.ok(!/localStorage|sessionStorage/.test(panel), "the selection is never written to web storage");
  assert.ok(!/storage\.local\.set\(\{[^}]*selection/.test(panel));
});

test("Ctrl+Shift+Y inserts only on LinkedIn; anywhere else the panel is told to copy", async () => {
  const listeners = {}, sent = [], scripts = [];
  const event = name => ({ addListener: fn => { listeners[name] = fn; } });
  let tabUrl = "https://mail.google.com/mail";
  globalThis.chrome = {
    runtime: { onInstalled: event("installed"), onMessage: event("message"), onMessageExternal: event("external"), sendMessage: async m => { sent.push(m); } },
    contextMenus: { create() {}, onClicked: event("menu") },
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {} },
    scripting: { executeScript: async o => { scripts.push(o); return [{ result: true }]; } },
    storage: { local: { set: async () => {} } },
    commands: { onCommand: event("command") },
    tabs: { query: async () => [{ id: 9, url: tabUrl }] },
  };
  try {
    await import("../extension/dist/background.js");
    listeners.message({ type: "SET_DRAFT", text: "A comment" }, {}, () => {});
    await listeners.command("insert-draft");
    assert.equal(scripts.length, 0);
    assert.ok(sent.some(m => m.type === "INSERT_FAILED"));
    tabUrl = "https://www.linkedin.com/feed/";
    await listeners.command("insert-draft");
    assert.equal(scripts.length, 1);
    assert.deepEqual(scripts[0].args, ["A comment"]);
  } finally { delete globalThis.chrome; }
});

// ---- the panel in Chromium ----

const contact = { id: "11111111-1111-4111-8111-111111111111", name: "Alice Rao", company: "Acme", role: "Analyst", profileUrl: null, relationship: "stranger", goal: "job", intent: "learn_role", tier: "tier_1", status: "to_contact" };

async function openPanel({ answer, selection = { text: POST, truncated: false }, consent = true, commenter = "on", tabUrl = LI, fixture }) {
  const context = await (await launch()).newContext();
  const page = await context.newPage();
  const calls = [];
  await page.exposeFunction("__insertInFixture", async text => { await fixture.bringToFront(); return fixture.evaluate(insertDraft, text); });
  await page.addInitScript(({ selection, tabUrl, consent }) => {
    const listeners = [], writes = [];
    let pending = selection;
    window.__writes = writes; window.__copied = null; window.__sent = [];
    window.chrome = {
      storage: { local: {
        get: async () => ({ token: "t".repeat(43), apiOrigin: "https://www.lynkr.cloud", ...(consent ? { commentConsent: true } : {}) }),
        set: async v => { writes.push(JSON.stringify(v)); }, remove: async () => {},
      } },
      runtime: {
        onMessage: { addListener: fn => listeners.push(fn) },
        sendMessage: async m => { window.__sent.push(m); if (m.type === "TAKE_SELECTION") { const r = pending ?? { text: "", truncated: false }; pending = null; return r; } return { ok: true }; },
      },
      tabs: { query: async () => [{ id: 1, url: tabUrl }] },
      scripting: { executeScript: async ({ args }) => [{ result: await window.__insertInFixture(args[0]) }] },
    };
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async t => { window.__copied = t; } } });
  }, { selection, tabUrl, consent });
  await page.route(url => url.href.startsWith(PANEL), async route => {
    const name = new URL(route.request().url()).pathname.split("/").pop();
    await route.fulfill({ body: await readFile(resolve(DIST, name)), contentType: name.endsWith(".html") ? "text/html" : "text/javascript" });
  });
  await page.route("https://www.lynkr.cloud/api/status", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ commenter }) }));
  await page.route(url => url.href.startsWith("https://www.lynkr.cloud/api/ext/"), async route => {
    const req = route.request();
    const call = { path: new URL(req.url()).pathname.split("/").pop(), body: req.postData() ? JSON.parse(req.postData()) : null };
    calls.push(call);
    const out = await answer(call, calls);
    await route.fulfill({ status: out.status ?? 200, contentType: "application/json", body: JSON.stringify(out.json ?? {}) });
  });
  await page.goto(`${PANEL}sidepanel.html`);
  await page.locator("#paired:not([hidden]), #unpaid:not([hidden])").first().waitFor();
  return { page, context, calls, comments: () => calls.filter(c => c.path === "comment") };
}
const withFixture = async run => {
  const fixture = await (await launch()).newPage();
  await fixture.goto(FIXTURE);
  try { await run(fixture); } finally { await fixture.close(); }
};
const base = (comment) => async (c, calls) => c.path === "contacts" ? { json: { contacts: [contact] } } : c.path === "comment" ? comment(c, calls) : { status: 500, json: { error: "unexpected" } };

test("a selection with Comments on opens the chooser with Comment focused, and nothing is sent until a choice is made", async () => {
  await withFixture(async fixture => {
    const { page, context, comments } = await openPanel({ fixture, consent: false, answer: base(() => ({ json: OPTIONS })) });
    try {
      await page.locator("#chooser:not([hidden])").waitFor();
      assert.equal(await page.locator("#message-view").isVisible(), false);
      assert.equal(await page.evaluate(() => document.activeElement?.id), "choose-comment");
      assert.equal(comments().length, 0);
      // First use: the notice comes first, and "Not now" sends nothing.
      await page.locator("#choose-comment").click();
      await page.locator("#consent:not([hidden])").waitFor();
      assert.match(await page.locator("#consent").innerText(), /never posts, likes or sends/);
      await page.locator("#consent-no").click();
      assert.equal(comments().length, 0);
      await page.locator("#choose-comment").click();
      await page.locator("#consent-yes").click();
      await page.locator("#c-options li").first().waitFor();
      assert.equal(comments().length, 1);
      assert.deepEqual(comments()[0].body, { selection: POST });
      assert.ok((await page.evaluate(() => window.__writes)).some(w => /commentConsent/.test(w)), "the consent is remembered");
      assert.ok(!(await page.evaluate(() => window.__writes.join("\n"))).includes("Priya"), "the selection is never stored");
    } finally { await context.close(); }
  });
});

test("Message someone about this opens the Outreach flow unchanged", async () => {
  await withFixture(async fixture => {
    const { page, context, comments } = await openPanel({ fixture, answer: base(() => ({ json: OPTIONS })) });
    try {
      await page.locator("#choose-message").click();
      assert.equal(await page.locator("#message-view").isVisible(), true);
      assert.equal(await page.locator("#selection-card").isVisible(), true);
      assert.equal(comments().length, 0);
    } finally { await context.close(); }
  });
});

test("Comments off: the chooser never shows and the Outreach flow is the panel", async () => {
  await withFixture(async fixture => {
    const { page, context } = await openPanel({ fixture, commenter: "off", answer: base(() => ({ json: OPTIONS })) });
    try {
      assert.equal(await page.locator("#chooser").isVisible(), false);
      assert.equal(await page.locator("#message-view").isVisible(), true);
    } finally { await context.close(); }
  });
});

test("options show the author, the angle, the why line and a first selection; focus lands on Options; the panel passes axe", async () => {
  await withFixture(async fixture => {
    const { page, context } = await openPanel({ fixture, answer: base(() => ({ json: { ...OPTIONS, options: [opt("experience", "Cleaned the fest data first. Our petabyte lakehouse runs on twelve clusters.", { flags: ["Our petabyte lakehouse runs on twelve clusters."] }), OPTIONS.options[1]] } })) });
    try {
      await page.locator("#choose-comment").click();
      await page.locator("#c-options li").first().waitFor();
      assert.equal(await page.locator("#c-author").innerText(), "Priya Shah · Data Lead at Swiggy");
      assert.equal(await page.locator("#c-author-edit").innerText(), "Edit");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "c-options-title");
      assert.deepEqual(await page.locator("#c-options label").allInnerTexts(), ["From your experience", "Add a point"]);
      assert.equal(await page.locator('input[name="c-goal"]:checked').getAttribute("value"), "job_seeker");
      assert.equal(await page.locator("#c-opt-0").isChecked(), true);
      assert.match(await page.locator(".why").first().innerText(), /^Why this works: Answers the survey data line/);
      assert.equal(await page.locator(".check").innerText(), "Our petabyte lakehouse runs on twelve clusters.");
      assert.match(await page.locator("#c-options").innerText(), /Check this line/);
      assert.deepEqual(await page.locator("#c-options button").evaluateAll(b => b.map(x => x.getAttribute("aria-label"))), ["Insert From your experience option", "Copy From your experience option", "Insert Add a point option", "Copy Add a point option"]);
      // The first option is already the target of Ctrl+Shift+Y.
      assert.equal(await page.evaluate(() => window.__sent.filter(m => m.type === "SET_DRAFT").at(-1)?.text), "Cleaned the fest data first. Our petabyte lakehouse runs on twelve clusters.");
      await page.locator("#c-opt-1").check();
      assert.match(await page.evaluate(() => window.__sent.filter(m => m.type === "SET_DRAFT").at(-1)?.text), /^Inputs first/);
      await page.addScriptTag({ content: axeScript });
      const v = await page.evaluate(async () => (await window.axe.run({ runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] })).violations.filter(x => x.impact === "critical" || x.impact === "serious").map(x => `${x.id} (${x.nodes[0]?.target?.join(" ")})`));
      assert.deepEqual(v, []);
    } finally { await context.close(); }
  });
});

test("AE3: Insert puts the option after the text already in the comment box and presses nothing", async () => {
  await withFixture(async fixture => {
    const { page, context } = await openPanel({ fixture, answer: base(() => ({ json: OPTIONS })) });
    try {
      await page.locator("#choose-comment").click();
      await page.locator("#c-options li").first().waitFor();
      await fixture.evaluate(() => {
        const box = document.querySelector("#comment-box");
        box.textContent = "Agreed. ";
        box.focus();
        const r = document.createRange(); r.selectNodeContents(box); r.collapse(false);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      });
      await page.getByRole("button", { name: "Insert From your experience option" }).click();
      await page.locator("#status:has-text('Inserted. Review it, then press Post on LinkedIn.')").waitFor();
      const text = await fixture.locator("#comment-box").evaluate(e => e.textContent);
      assert.match(text, /^Agreed\.\s*When I cleaned the fest survey data first, the summary changed shape\.$/);
    } finally { await context.close(); }
  });
});

test("AE4: with nothing focused, or off LinkedIn, Insert copies and says to paste", async () => {
  await withFixture(async fixture => {
    const none = await openPanel({ fixture, answer: base(() => ({ json: OPTIONS })) });
    try {
      await none.page.locator("#choose-comment").click();
      await none.page.locator("#c-options li").first().waitFor();
      await fixture.evaluate(() => document.activeElement?.blur());
      await none.page.getByRole("button", { name: "Insert Add a point option" }).click();
      await none.page.locator("#status:has-text('Click in the comment box and paste')").waitFor();
      assert.match(await none.page.evaluate(() => window.__copied), /^Inputs first/);
    } finally { await none.context.close(); }
    const gmail = await openPanel({ fixture, tabUrl: "https://mail.google.com/mail", answer: base(() => ({ json: OPTIONS })) });
    try {
      await gmail.page.locator("#choose-comment").click();
      await gmail.page.locator("#c-options li").first().waitFor();
      await fixture.locator("#comment-box").focus();
      await gmail.page.getByRole("button", { name: "Insert From your experience option" }).click();
      await gmail.page.locator("#status:has-text('Click in the comment box and paste')").waitFor();
      assert.equal(await fixture.locator("#comment-box").innerText(), "", "nothing was inserted off LinkedIn");
    } finally { await gmail.context.close(); }
  });
});

test("skips keep the selection and put the cursor in the reaction box", async () => {
  await withFixture(async fixture => {
    let reply = { json: { status: "skip", reason: "no_input", why: "Tell me one thing you think about this and I'll write it.", author: null, goal: "job_seeker" } };
    const { page, context, comments } = await openPanel({ fixture, answer: base(() => reply) });
    try {
      await page.locator("#choose-comment").click();
      await page.locator("#c-note:has-text('Tell me one thing')").waitFor();
      assert.equal(await page.evaluate(() => document.activeElement?.id), "c-reaction");
      assert.equal(await page.locator("#c-author").innerText(), "Author not detected");
      assert.equal(await page.locator("#c-author-edit").innerText(), "Add");
      reply = { json: { status: "skip", reason: "off_topic", why: "Your facts are about UI design; this post is about taxes.", author: null, goal: "job_seeker" } };
      await page.locator("#c-reaction").fill("Taxes are not my field");
      await page.locator("#c-regen").click();
      await page.locator("#c-note:has-text('Add your reaction and try again')").waitFor();
      assert.equal(comments().at(-1).body.reaction, "Taxes are not my field");
      assert.equal(comments().at(-1).body.selection, POST, "the selection is kept across Regenerate");
    } finally { await context.close(); }
  });
});

test("Regenerate sends the goal the person picked; an edited author is sent but never starts a generation", async () => {
  await withFixture(async fixture => {
    const { page, context, comments } = await openPanel({ fixture, answer: base(() => ({ json: { ...OPTIONS, author: null } })) });
    try {
      await page.locator("#choose-comment").click();
      await page.locator("#c-options li").first().waitFor();
      await page.getByLabel("Freelancer").check();
      await page.locator("#c-author-edit").click();
      await page.locator("#c-name").fill("Priya Shah");
      await page.locator("#c-headline").fill("Data Lead");
      await page.locator("#c-author-save").click();
      assert.equal(await page.locator("#c-author").innerText(), "Priya Shah · Data Lead");
      assert.equal(await page.evaluate(() => document.activeElement?.id), "c-author-edit");
      assert.equal(comments().length, 1, "saving the author does not generate");
      await page.locator("#c-regen").click();
      await page.waitForFunction(() => !document.getElementById("c-regen").disabled);
      assert.equal(comments().length, 2);
      assert.deepEqual({ goal: comments()[1].body.goal, author: comments()[1].body.author }, { goal: "freelancer", author: { name: "Priya Shah", headline: "Data Lead" } });
    } finally { await context.close(); }
  });
});

test("a cap (429) shows its text with no retry prompt; a server error keeps the selection and Regenerate retries", async () => {
  await withFixture(async fixture => {
    let reply = { status: 429, json: { error: "That's today's comments. A few thoughtful ones beat many." } };
    const { page, context, comments } = await openPanel({ fixture, answer: base(() => reply) });
    try {
      await page.locator("#choose-comment").click();
      await page.locator("#status:has-text('today')").waitFor();
      assert.ok(!/retry/i.test(await page.locator("#status").innerText()));
      reply = { status: 503, json: { error: "Writing comments is unavailable right now." } };
      await page.locator("#c-regen").click();
      await page.locator("#status:has-text('Your selection is kept')").waitFor();
      reply = { json: OPTIONS };
      await page.locator("#c-regen").click();
      await page.locator("#c-options li").first().waitFor();
      assert.deepEqual(comments().map(c => c.body.selection), [POST, POST, POST]);
    } finally { await context.close(); }
  });
});

test("AE7: a lapsed subscription (402) shows the upgrade card", async () => {
  await withFixture(async fixture => {
    const { page, context } = await openPanel({ fixture, answer: base(() => ({ status: 402, json: { error: "Your Lynkr subscription has lapsed.", code: "subscription_required" } })) });
    try {
      await page.locator("#choose-comment").click();
      await page.locator("#unpaid:not([hidden])").waitFor();
    } finally { await context.close(); }
  });
});

test("a selection that cannot be answered is explained in the panel and never sent", async () => {
  await withFixture(async fixture => {
    const { page, context, comments } = await openPanel({ fixture, selection: { text: `${POST}\n…see more`, truncated: false }, answer: base(() => ({ json: OPTIONS })) });
    try {
      await page.locator("#choose-comment").click();
      await page.locator("#c-note:has-text('Expand the post')").waitFor();
      assert.equal(comments().length, 0);
    } finally { await context.close(); }
  });
});

test("one option that passed the checks is shown with the honest note", async () => {
  await withFixture(async fixture => {
    const { page, context } = await openPanel({ fixture, answer: base(() => ({ json: { ...OPTIONS, options: [OPTIONS.options[0]], dropped: 2 } })) });
    try {
      await page.locator("#choose-comment").click();
      await page.locator("#c-note:has-text(\"The other options didn't pass Lynkr's checks\")").waitFor();
      assert.equal(await page.locator("#c-options li").count(), 1);
    } finally { await context.close(); }
  });
});
