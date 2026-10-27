// Moving browser data into the account: the pure helpers in components/MoveToAccount.tsx.
// The component file has JSX, so only its marked helper block is compiled and loaded here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const src = readFileSync(new URL("../components/MoveToAccount.tsx", import.meta.url), "utf8");
const block = src.slice(src.indexOf("// --- pure helpers (start)"), src.indexOf("// --- pure helpers (end)"));
const js = ts.transpileModule(block, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = await import(`data:text/javascript,${encodeURIComponent(js)}`);

test("browser data worth moving: any fact or a profile", () => {
  assert.equal(m.hasBrowserData({ profile: null, facts: [] }), false);
  assert.equal(m.hasBrowserData({ profile: { role: "x" }, facts: [] }), true);
  assert.equal(m.hasBrowserData({ profile: null, facts: [{ id: "F1" }] }), true);
});

test("move summary: added, updated, and kept where the account was newer", () => {
  const before = [
    { id: "F1", text: "Built a sponsor dashboard" },
    { id: "F2", text: "Wrote the SQL myself" },
    { id: "F3", text: "Saved 6 hours a week" },
  ];
  const sent = [
    { id: "F1", text: "Built a sponsor dashboard" }, // same: neither added nor updated
    { id: "F2", text: "Wrote all the SQL myself" }, // changed and newer: updated
    { id: "F3", text: "Saved 5 hours a week" }, // account newer: kept
    { id: "F4", text: "Ran the fest budget" }, // new: added
  ];
  const r = m.moveSummary(before, sent, [{ id: "F3" }]);
  assert.deepEqual(r, { added: 1, updated: 1, kept: 1 });
  assert.equal(m.summaryLine(r), "1 fact added, 1 updated, 1 kept from your account.");
  assert.equal(m.summaryLine({ added: 3, updated: 0, kept: 0 }), "3 facts added, 0 updated, 0 kept from your account.");
});

test("dismissal key is per account and case-insensitive", () => {
  assert.equal(m.dismissKey("A@Example.test"), m.dismissKey("a@example.test"));
  assert.notEqual(m.dismissKey("a@example.test"), m.dismissKey("b@example.test"));
});
