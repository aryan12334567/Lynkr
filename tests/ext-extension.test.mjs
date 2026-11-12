import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { insertDraft } from "../extension/dist/insert.js";
import { ApiError, ORIGIN_PATTERN, checkProfileTab, createClient, formatIST, tapsFor } from "../extension/dist/api.js";

// Everything here runs against local files only: tests/fixtures/linkedin-like.html and the built panel, with Lynkr's
// API answered by the test. linkedin.com is never opened, and the tab addresses the panel is told about are stubs.

const FIXTURE = pathToFileURL(resolve("tests/fixtures/linkedin-like.html")).href;
const PANEL = "https://www.lynkr.cloud/panel/";
const DIST = resolve("extension/dist");

let shared;
const launch = async () => (shared ??= await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true }));
after(async () => { await shared?.close(); });

// ---- static checks ----

test("manifest uses activeTab, without LinkedIn host access or content scripts", async () => {
 const manifest = JSON.parse(await readFile(new URL("../extension/dist/manifest.json", import.meta.url), "utf8"));
 assert.ok(manifest.permissions.includes("activeTab"));
 assert.ok(!manifest.content_scripts);
 assert.ok(manifest.host_permissions.every(host => !host.includes("linkedin.com")));
 assert.ok(!JSON.stringify(manifest).includes("linkedin"));
 assert.deepEqual([...manifest.permissions].sort(), ["activeTab", "contextMenus", "scripting", "sidePanel", "storage"]);
 assert.ok(!manifest.optional_host_permissions && !manifest.optional_permissions);
 assert.equal(manifest.background.service_worker, "background.js");
 assert.equal(manifest.commands["insert-draft"].suggested_key.default, "Ctrl+Shift+Y");
});

test("the built extension is the source: the panel page is copied from one file", async () => {
 assert.equal(await readFile("extension/dist/sidepanel.html", "utf8"), await readFile("extension/sidepanel.html", "utf8"));
 await assert.rejects(readFile("extension/src/sidepanel.html"));
});

test("the page is never read: no built file touches page content or the page address", async () => {
 for (const name of ["background", "sidepanel", "insert", "api"]) {
  const src = await readFile(`extension/dist/${name}.js`, "utf8");
  assert.ok(!/document\.body|innerHTML|outerHTML|location\.href|XMLHttpRequest/.test(src), `${name} reads no page content`);
  assert.ok(!/fetch\(["'`]https?:\/\/[^"'`$]*linkedin/.test(src), `${name} never fetches linkedin.com`);
 }
});

// ---- the panel's rules, without a browser ----

test("only linkedin.com/in/ addresses can be saved; the query and fragment are dropped", () => {
 assert.deepEqual(checkProfileTab("https://www.linkedin.com/in/Some-One/?utm=1#x"), { ok: true, url: "https://www.linkedin.com/in/some-one/" });
 assert.deepEqual(checkProfileTab("https://linkedin.com/in/x"), { ok: true, url: "https://www.linkedin.com/in/x/" });
 for (const bad of ["https://www.linkedin.com/feed/", "https://www.linkedin.com/in/x/details/", "http://www.linkedin.com/in/x/", "https://evil.test/in/x/", "https://www.linkedin.com.evil.test/in/x/", "https://user@www.linkedin.com/in/x/", "not a url"]) {
  assert.deepEqual(checkProfileTab(bad), { ok: false, reason: "not_profile" }, bad);
 }
 assert.deepEqual(checkProfileTab(undefined), { ok: false, reason: "no_address" });
});

test("taps depend on the stage, and a finished contact has none", () => {
 assert.deepEqual(tapsFor("replied"), ["meeting_booked", "goal_reached", "close"]);
 assert.deepEqual(tapsFor("meeting"), ["meeting_done", "goal_reached", "close"]);
 assert.deepEqual(tapsFor("outcome"), []);
 assert.deepEqual(tapsFor("unknown"), []);
 assert.match(formatIST("2031-03-14T10:00:00.000Z"), /14 Mar.*3:30\s?pm IST/i);
 assert.ok(ORIGIN_PATTERN.test("https://www.lynkr.cloud") && !ORIGIN_PATTERN.test("https://evil.test") && !ORIGIN_PATTERN.test("https://lynkr.cloud.evil.test"));
});

test("unpaired and unpaid clients never call a draft, save or record route", async () => {
 const calls = [];
 const fetchFn = async (url, init) => { calls.push(url); return new Response(JSON.stringify(calls.length === 1 ? { error: "Upgrade" } : {}), { status: calls.length === 1 ? 402 : 200 }); };
 let auth = null;
 const client = createClient({ auth: () => auth, fetchFn });
 for (const path of ["draft", "profile", "outcome"]) await assert.rejects(client.request(path, { body: {} }), ApiError);
 auth = { token: "t".repeat(43), origin: "https://www.lynkr.cloud" };
 for (const path of ["draft", "profile", "outcome"]) await assert.rejects(client.request(path, { body: {} }), /Connect/);
 assert.equal(calls.length, 0);
 await assert.rejects(client.request("contacts"), e => e.status === 402);
 for (const path of ["draft", "profile", "outcome"]) await assert.rejects(client.request(path, { body: {} }), /subscription/);
 assert.equal(calls.length, 1);
 auth = { token: "t".repeat(43), origin: "https://evil.test" };
 await assert.rejects(client.request("contacts"), /Connect/);
 assert.equal(calls.length, 1);
});

// ---- the service worker, with a stubbed chrome ----

test("the context menu reads the selection the user made, holds it once in memory, and falls back to the menu's copy", async () => {
 const listeners = {}, sent = [], opened = [], created = [];
 const event = name => ({ addListener: fn => { listeners[name] = fn; } });
 let scripted = () => [{ result: "Great point on credit risk\nsecond line" }];
 globalThis.chrome = {
  runtime: { onInstalled: event("installed"), onMessage: event("message"), onMessageExternal: event("external"), sendMessage: async m => { sent.push(m); } },
  contextMenus: { create: o => created.push(o), onClicked: event("menu") },
  sidePanel: { setPanelBehavior: async () => {}, open: async o => { opened.push(o); } },
  scripting: { executeScript: async () => scripted() },
  storage: { local: { set: async () => {} } },
  commands: { onCommand: event("command") },
  tabs: { query: async () => [] },
 };
 await import("../extension/dist/background.js");
 listeners.installed();
 assert.deepEqual(created.map(c => [c.id, c.title, c.contexts]), [["write-with-lynkr", "Write with Lynkr", ["selection"]]]);
 assert.deepEqual(created[0].documentUrlPatterns, ["https://www.linkedin.com/*"]); // the menu item exists only on LinkedIn (R1)
 const take = () => new Promise(done => listeners.message({ type: "TAKE_SELECTION" }, {}, done));
 await listeners.menu({ menuItemId: "write-with-lynkr", selectionText: "menu copy" }, { id: 7, windowId: 3 });
 assert.deepEqual(opened, [{ windowId: 3 }]);
 assert.ok(sent.some(m => m.type === "SELECTION_AVAILABLE"));
 assert.deepEqual(await take(), { text: "Great point on credit risk\nsecond line", truncated: false });
 assert.deepEqual(await take(), { text: "", truncated: false });
 scripted = () => { throw new Error("no access"); };
 await listeners.menu({ menuItemId: "write-with-lynkr", selectionText: "menu copy" }, { id: 7, windowId: 3 });
 assert.equal((await take()).text, "menu copy");
 scripted = () => [{ result: "x".repeat(3500) }];
 await listeners.menu({ menuItemId: "write-with-lynkr", selectionText: "" }, { id: 7, windowId: 3 });
 const long = await take();
 assert.equal(long.text.length, 3500); assert.equal(long.truncated, false); // nothing is cut silently any more (Commenter R4)
 await listeners.menu({ menuItemId: "other", selectionText: "ignored" }, { id: 7, windowId: 3 });
 assert.equal((await take()).text, "");
 // Pairing is accepted only from Lynkr's own origins.
 const answer = (message, origin) => new Promise(done => { listeners.external(message, { origin }, done); });
 const token = "a".repeat(43);
 assert.deepEqual(await answer({ type: "PAIR_TOKEN", token }, "https://evil.test"), { success: false });
 assert.deepEqual(await answer({ type: "PAIR_TOKEN", token: "short" }, "https://www.lynkr.cloud"), { success: false });
 assert.deepEqual(await answer({ type: "PAIR_TOKEN", token }, "https://www.lynkr.cloud"), { success: true });
 delete globalThis.chrome;
});

// ---- insertion on the fixture page ----

test("insertion updates focused editable fields and dispatches input, refuses other elements", async () => {
 const page = await (await launch()).newPage();
 try {
  await page.goto(FIXTURE);
  for (const selector of ["#message-box", "#comment-box", "#textarea-box"]) {
   await page.locator(selector).focus();
   assert.equal(await page.evaluate(insertDraft, "A draft from Lynkr"), true);
   const value = await page.locator(selector).evaluate(e => e instanceof HTMLTextAreaElement ? e.value : e.textContent);
   assert.ok(value.includes("A draft from Lynkr"));
  }
  assert.match(await page.locator("#event-log").innerText(), /input/i);
  await page.locator("h1").first().evaluate(e => { e.setAttribute("tabindex", "0"); e.focus(); });
  assert.equal(await page.evaluate(insertDraft, "not inserted"), false);
 } finally { await page.close(); }
});

// ---- the side panel, in Chromium, with the API answered by the test ----

const contact = (id, name, status = "to_contact", extra = {}) => ({ id, name, company: "Acme", role: "Analyst", profileUrl: null, relationship: "stranger", goal: "job", intent: "learn_role", tier: "tier_1", status, ...extra });
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222", C = "33333333-3333-4333-8333-333333333333";

/**
 * Opens the built side panel with a stubbed `chrome` and Lynkr's API answered by `answer`. `fixture` is the local
 * LinkedIn-like page that Insert targets. Returns the page plus what the panel sent and stored.
 */
async function openPanel({ commenter = "off", consent = false, paired = true, contacts = [contact(A, "Alice Rao"), contact(B, "Bob Iyer", "replied"), contact(C, "Cara Das", "meeting")], answer, selection = null, tabUrl, fixture }) {
 const context = await (await launch()).newContext();
 const page = await context.newPage();
 const calls = [];
 await page.exposeFunction("__insertInFixture", async text => { await fixture.bringToFront(); return fixture.evaluate(insertDraft, text); });
 await page.addInitScript(({ paired, selection, tabUrl, consent }) => {
  const listeners = [], writes = [];
  let pending = selection;
  window.__writes = writes; window.__copied = null; window.__sent = [];
  window.chrome = {
   storage: { local: {
    get: async () => (paired ? { token: "t".repeat(43), apiOrigin: "https://www.lynkr.cloud", ...(consent ? { commentConsent: true } : {}) } : {}),
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
 }, { paired, selection, tabUrl, consent });
 await page.route(url => url.href.startsWith(PANEL), async route => {
  const name = new URL(route.request().url()).pathname.split("/").pop();
  await route.fulfill({ body: await readFile(resolve(DIST, name)), contentType: name.endsWith(".html") ? "text/html" : "text/javascript" });
 });
 await page.route(url => url.href.startsWith("https://www.lynkr.cloud/api/ext/"), async route => {
  const req = route.request();
  const call = { path: new URL(req.url()).pathname.split("/").pop(), method: req.method(), body: req.postData() ? JSON.parse(req.postData()) : null, auth: req.headers()["authorization"] };
  calls.push(call);
  const out = await answer(call);
  await route.fulfill({ status: out.status ?? 200, contentType: "application/json", body: JSON.stringify(out.json ?? {}) });
 });
 await page.route("https://www.lynkr.cloud/api/status", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ commenter }) }));
 await page.goto(`${PANEL}sidepanel.html`);
 await page.locator("#paired:not([hidden]), #unpaired:not([hidden]), #unpaid:not([hidden])").first().waitFor();
 return { page, context, calls, contacts };
}
const withFixture = async run => {
 const browser = await launch();
 const fixture = await browser.newPage();
 await fixture.goto(FIXTURE);
 try { await run(fixture); } finally { await fixture.close(); }
};
const status = page => page.locator("#status");
const standard = contacts => async ({ path }) => path === "contacts" ? { json: { contacts } } : { status: 500, json: { error: "unexpected" } };

test("not paired: the connect card shows and no route is called", async () => {
 await withFixture(async fixture => {
  const { page, context, calls } = await openPanel({ paired: false, fixture, answer: async () => ({ status: 500 }) });
  try {
   assert.equal(await page.locator("#unpaired").isVisible(), true);
   assert.equal(await page.locator("#paired").isVisible(), false);
   assert.match(await page.locator("#unpaired a").getAttribute("href"), /^https:\/\/www\.lynkr\.cloud\//);
   assert.deepEqual(calls, []);
  } finally { await context.close(); }
 });
});

test("unpaid: the upgrade card shows and no draft, profile or outcome route is ever called", async () => {
 await withFixture(async fixture => {
  const { page, context, calls } = await openPanel({ fixture, tabUrl: "https://www.linkedin.com/in/x/", answer: async () => ({ status: 402, json: { error: "Your Lynkr subscription has lapsed. Upgrade to keep using the extension." } }) });
  try {
   assert.equal(await page.locator("#unpaid").isVisible(), true);
   assert.match(await page.locator("#unpaid").innerText(), /upgrade/i);
   assert.equal(await page.locator("#paired").isVisible(), false);
   await page.evaluate(() => { for (const id of ["write", "save-profile", "insert"]) document.getElementById(id).click(); });
   assert.deepEqual(calls.map(c => c.path), ["contacts"]);
  } finally { await context.close(); }
 });
});

test("a refused token (401) sends the panel back to not paired", async () => {
 await withFixture(async fixture => {
  const { page, context } = await openPanel({ fixture, answer: async () => ({ status: 401, json: { error: "Invalid or expired token." } }) });
  try { assert.equal(await page.locator("#unpaired").isVisible(), true); } finally { await context.close(); }
 });
});

test("paired: search, goal and intent, draft versions with Insert and Copy, notes left (AE4)", async () => {
 await withFixture(async fixture => {
  const contacts = [contact(A, "Alice Rao"), contact(B, "Bob Iyer", "replied", { company: "Beta" })];
  const versions = [{ angle: "a", body: "Version one body for Alice", verdict: "Ready" }, { angle: "b", body: "Version two body for Alice", verdict: "Ready" }];
  const { page, context, calls } = await openPanel({
   fixture, contacts, answer: async c => c.path === "contacts" ? { json: { contacts } } : c.path === "draft" ? { json: { versions, notesLeft: 2, strongerQuestion: "" } } : { status: 500 },
  });
  try {
   assert.deepEqual(await page.locator("#contact option").allInnerTexts(), ["Alice Rao · Analyst · Acme", "Bob Iyer · Analyst · Beta"]);
   assert.match(await page.locator("#contact-details").innerText(), /Goal: job · Intent: learn role/);
   await page.locator("#search").fill("beta");
   assert.deepEqual(await page.locator("#contact option").allInnerTexts(), ["Bob Iyer · Analyst · Beta"]);
   await page.locator("#search").fill("");
   await page.locator("#contact").selectOption(A);
   await page.locator("#write").click();
   await page.locator("#drafts .version").first().waitFor();
   assert.deepEqual(calls.find(c => c.path === "draft").body, { contactId: A, channel: "connection_note" });
   assert.equal(calls.find(c => c.path === "draft").auth, `Bearer ${"t".repeat(43)}`);
   assert.equal(await page.locator("#drafts .version").count(), 2);
   assert.match(await page.locator("#notes-left").innerText(), /left this month: 2/);
   assert.equal(await page.locator("#draft").inputValue(), "Version one body for Alice");
   await page.getByRole("button", { name: "Use version 2" }).click();
   assert.equal(await page.locator("#draft").inputValue(), "Version two body for Alice");
   // Insert puts the chosen version into the box the user clicked.
   await fixture.locator("#message-box").focus();
   await page.locator("#insert").click();
   await page.locator("#status:has-text('Inserted')").waitFor();
   assert.equal(await fixture.locator("#message-box").innerText(), "Version two body for Alice");
   // With nothing focused, the version is copied and the panel says to paste.
   await fixture.evaluate(() => document.activeElement && document.activeElement.blur());
   await page.locator("#insert").click();
   await page.locator("#status:has-text('Click in the box and paste')").waitFor();
   assert.equal(await page.evaluate(() => window.__copied), "Version two body for Alice");
   assert.equal(await fixture.locator("#message-box").innerText(), "Version two body for Alice");
   await page.evaluate(() => { window.__copied = null; });
   await page.locator("#copy").click();
   await page.locator("#status:has-text('Copied')").waitFor();
   assert.equal(await page.evaluate(() => window.__copied), "Version two body for Alice");
  } finally { await context.close(); }
 });
});

test("Save this profile link saves a /in/ address and explains itself on any other page", async () => {
 await withFixture(async fixture => {
  const contacts = [contact(A, "Alice Rao")];
  const answer = async c => c.path === "contacts" ? { json: { contacts } } : c.path === "profile" ? { json: { contact: { id: A } } } : { status: 500 };
  const good = await openPanel({ fixture, contacts, answer, tabUrl: "https://www.linkedin.com/in/x/?utm=1" });
  try {
   await good.page.locator("#save-profile").click();
   await good.page.locator("#status:has-text('Profile link saved')").waitFor();
   assert.deepEqual(good.calls.find(c => c.path === "profile").body, { contactId: A, profileUrl: "https://www.linkedin.com/in/x/" });
  } finally { await good.context.close(); }
  const feed = await openPanel({ fixture, contacts, answer, tabUrl: "https://www.linkedin.com/feed/" });
  try {
   await feed.page.locator("#save-profile").click();
   await feed.page.locator("#status:has-text('only works on a LinkedIn profile')").waitFor();
   assert.ok(!feed.calls.some(c => c.path === "profile"));
  } finally { await feed.context.close(); }
  const blind = await openPanel({ fixture, contacts, answer, tabUrl: undefined });
  try {
   await blind.page.locator("#save-profile").click();
   await blind.page.locator("#status:has-text('did not share')").waitFor();
   assert.ok(!blind.calls.some(c => c.path === "profile"));
  } finally { await blind.context.close(); }
 });
});

test("selected text: choose a contact, Reply to this; it is sent once, never stored, and there is no Comment chooser", async () => {
 await withFixture(async fixture => {
  const contacts = [contact(A, "Alice Rao")];
  let draftStatus = 200;
  const answer = async c => c.path === "contacts" ? { json: { contacts } } : c.path === "draft" ? (draftStatus === 200 ? { json: { versions: [{ angle: "a", body: "Agreed on credit risk, Alice.", verdict: "Ready" }] } } : { status: 400, json: { error: "Invalid request." } }) : { status: 500 };
  const selection = { text: "Great point on credit risk", truncated: false };
  const { page, context, calls } = await openPanel({ fixture, contacts, answer, selection });
  try {
   await page.locator("#selection-card").waitFor();
   assert.equal(await page.locator("#selection-text").innerText(), "Great point on credit risk");
   assert.equal(await page.locator("#chooser").isVisible(), false); // Comments are off here: the Outreach flow only
   assert.equal(await page.locator("input[name=selection-use]:checked").getAttribute("value"), "contact");
   await page.getByLabel("Reply to this").check();
   await page.locator("#write").click();
   await page.locator("#drafts .version").waitFor();
   const bodies = calls.filter(c => c.path === "draft").map(c => c.body);
   assert.deepEqual(bodies, [{ contactId: A, channel: "connection_note", selection: "Great point on credit risk", selectionUse: "reply" }]);
   assert.equal(await page.locator("#selection-card").isVisible(), false);
   await page.locator("#write").click();
   for (let i = 0; i < 100 && calls.filter(c => c.path === "draft").length < 2; i++) await page.waitForTimeout(50);
   assert.equal(calls.filter(c => c.path === "draft").length, 2);
   assert.equal(calls.filter(c => c.path === "draft").at(-1).body.selection, undefined);
   const stored = await page.evaluate(() => window.__writes.join("\n"));
   assert.ok(!/credit risk/.test(stored));
  } finally { await context.close(); }
  // A refused selection keeps the text so the user can retry or discard it.
  draftStatus = 400;
  const second = await openPanel({ fixture, contacts, answer, selection });
  try {
   await second.page.locator("#write").click();
   await second.page.locator("#status:has-text('Discard the selection')").waitFor();
   assert.equal(await second.page.locator("#selection-card").isVisible(), true);
   await second.page.locator("#clear-selection").click();
   assert.equal(await second.page.locator("#selection-card").isVisible(), false);
  } finally { await second.context.close(); }
 });
});

test("outcome taps: only the chosen contact's current stage, errors in the status line, undo stays in Lynkr (R40)", async () => {
 await withFixture(async fixture => {
  const contacts = [contact(A, "Alice Rao"), contact(B, "Bob Iyer", "replied"), contact(C, "Cara Das", "meeting")];
  let outcome = async () => ({ status: 500 });
  const answer = async c => c.path === "contacts" ? { json: { contacts } } : c.path === "outcome" ? outcome(c) : { status: 500 };
  const { page, context, calls } = await openPanel({ fixture, contacts, answer });
  const taps = () => page.locator("#taps button").allInnerTexts();
  try {
   await page.locator("#contact").selectOption(A);
   assert.deepEqual(await taps(), ["Invite sent", "Message sent", "Close"]);
   await page.locator("#contact").selectOption(C);
   assert.deepEqual(await taps(), ["Meeting done", "Goal reached", "Close"]);
   await page.locator("#contact").selectOption(B);
   assert.deepEqual(await taps(), ["Meeting booked", "Goal reached", "Close"]);
   assert.match(await page.locator("#progress").innerText(), /Undo it in Lynkr/);

   // A bad datetime: the server's 400 message is shown in the status line.
   const message = "Add the meeting's date and time (IST), like 2026-11-05T15:30.";
   outcome = async () => ({ status: 400, json: { error: message } });
   await page.getByRole("button", { name: "Meeting booked" }).click();
   assert.equal(await page.locator("#tap-details").isVisible(), true);
   assert.equal(await page.locator("#happened-row").isVisible(), false);
   await page.locator("#tap-save").click();
   await page.locator("#status").filter({ hasText: message }).waitFor();
   assert.deepEqual(calls.filter(c => c.path === "outcome").at(-1).body.meetingAt, undefined);
   assert.deepEqual(await taps(), ["Meeting booked", "Goal reached", "Close"]);

   // A failed send (500) then a retry: the same op id goes again, so the step is recorded once.
   outcome = async () => ({ status: 500, json: { error: "Could not save that step." } });
   await page.locator("#meeting-at").fill("2031-03-14T15:30");
   await page.locator("#tap-save").click();
   await page.locator("#status").filter({ hasText: "Could not save that step." }).waitFor();
   assert.deepEqual(await taps(), ["Meeting booked", "Goal reached", "Close"]);

   // A good one: shown in IST, and the stage moves on.
   outcome = async () => ({ json: { contact: { id: B, status: "meeting" }, event: { kind: "meeting_booked", meetingAt: "2031-03-14T10:00:00.000Z" }, goalReachedSuggested: false } });
   await page.locator("#tap-save").click();
   await page.locator("#status:has-text('Undo it in Lynkr')").waitFor();
   assert.match(await status(page).innerText(), /Meeting booked saved for .*14 Mar.*3:30\s?pm IST/i);
   const sent = calls.filter(c => c.path === "outcome");
   assert.deepEqual({ ...sent.at(-1).body, opId: "x" }, { contactId: B, status: "meeting_booked", meetingAt: "2031-03-14T15:30", opId: "x" });
   assert.equal(sent.at(-1).body.opId, sent.at(-2).body.opId);
   assert.deepEqual(await taps(), ["Meeting done", "Goal reached", "Close"]);

   // Meeting done: the first answer is sent with the optional rating and next step; "Moved" asks for the new time.
   outcome = async () => ({ json: { contact: { id: B, status: "meeting" }, event: { kind: "meeting_done" }, goalReachedSuggested: true } });
   await page.getByRole("button", { name: "Meeting done" }).click();
   assert.equal(await page.locator("#meeting-row").isVisible(), false);
   await page.locator("#happened").selectOption("moved");
   assert.equal(await page.locator("#meeting-row").isVisible(), true);
   await page.locator("#happened").selectOption("yes");
   await page.locator("#rating").selectOption("good");
   await page.locator("#next").selectOption("check_in");
   await page.locator("#tap-save").click();
   await page.locator("#status:has-text('Tap Goal reached')").waitFor();
   const done = calls.filter(c => c.path === "outcome").at(-1).body;
   assert.deepEqual({ ...done, opId: "x" }, { contactId: B, status: "meeting_done", happened: "yes", rating: "good", next: "check_in", opId: "x" });

   // Goal reached finishes the contact; the panel then offers no taps.
   outcome = async () => ({ json: { contact: { id: B, status: "outcome" }, event: { kind: "goal_reached" } } });
   await page.getByRole("button", { name: "Goal reached" }).click();
   await page.locator("#stage:has-text('finished')").waitFor();
   assert.deepEqual(await taps(), []);

   // A lapsed subscription mid-session shows the upgrade card.
   await page.locator("#contact").selectOption(A);
   outcome = async () => ({ status: 402, json: { error: "Your Lynkr subscription has lapsed. Upgrade to keep using the extension." } });
   await page.getByRole("button", { name: "Close" }).click();
   await page.locator("#unpaid").waitFor({ state: "visible" });
  } finally { await context.close(); }
 });
});

test("keyboard only: every tap can be reached and used at the side panel's width", async () => {
 await withFixture(async fixture => {
  const contacts = [contact(B, "Bob Iyer", "replied")];
  const answer = async c => c.path === "contacts" ? { json: { contacts } } : c.path === "outcome" ? { json: { contact: { id: B, status: "outcome" }, event: { kind: "goal_reached" } } } : { status: 500 };
  const { page, context, calls } = await openPanel({ fixture, contacts, answer });
  try {
   await page.setViewportSize({ width: 360, height: 800 });
   await page.locator("#search").focus();
   const seen = new Set();
   for (let i = 0; i < 40 && seen.size < 3; i++) {
    await page.keyboard.press("Tab");
    const action = await page.evaluate(() => document.activeElement?.dataset?.action ?? "");
    if (action) {
     seen.add(action);
    }
   }
   assert.deepEqual([...seen].sort(), ["close", "goal_reached", "meeting_booked"]);
   await page.locator("[data-action=goal_reached]").focus();
   await page.keyboard.press("Enter");
   await page.locator("#status:has-text('Goal reached saved')").waitFor();
   assert.equal(calls.filter(c => c.path === "outcome").length, 1);
   // The details form is also keyboard-reachable: its fields come after the taps in order.
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  } finally { await context.close(); }
 });
});
