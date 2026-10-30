import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { insertDraft } from "../extension/dist/insert.js";

test("manifest uses activeTab, without LinkedIn host access or content scripts", async () => {
 const manifest = JSON.parse(await readFile(new URL("../extension/dist/manifest.json", import.meta.url), "utf8"));
 assert.ok(manifest.permissions.includes("activeTab"));
 assert.ok(!manifest.content_scripts);
 assert.ok(manifest.host_permissions.every(host => !host.includes("linkedin.com")));
});
test("insertion updates focused editable fields and dispatches input, refuses other elements", async () => {
 const browser = await chromium.launch({ channel: process.env.LYNKR_BROWSER || "chrome", headless: true });
 try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve("tests/fixtures/linkedin-like.html")).href);
  for (const selector of ["#message-box", "#comment-box", "#textarea-box"]) {
   await page.locator(selector).focus();
   assert.equal(await page.evaluate(insertDraft, "A draft from Lynkr"), true);
   const value = await page.locator(selector).evaluate(e => e instanceof HTMLTextAreaElement ? e.value : e.textContent);
   assert.ok(value.includes("A draft from Lynkr"));
  }
  assert.match(await page.locator("#event-log").innerText(), /input/i);
  await page.locator("h1").first().evaluate(e => { e.setAttribute("tabindex", "0"); e.focus(); });
  assert.equal(await page.evaluate(insertDraft, "not inserted"), false);
 } finally { await browser.close(); }
});
