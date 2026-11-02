import { insertDraft } from "./insert.js";

/** The most selected text one drafting request carries. */
export const SELECTION_LIMIT = 3000;

let selection = { text: "", truncated: false };
let selectedDraft = "";

/** Runs in the clicked tab. It returns only what the user has selected, never anything else on the page. */
function readSelection(): string {
  return window.getSelection()?.toString() ?? "";
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "write-with-lynkr", title: "Write with Lynkr", contexts: ["selection"] });
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  if (info.menuItemId !== "write-with-lynkr" || !tab?.windowId) return;
  // The click gives activeTab for this tab. Reading the selection keeps its line breaks; the menu's own copy is the fallback.
  let text = "";
  if (tab.id !== undefined) {
    try { text = (await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readSelection }))[0]?.result ?? ""; } catch { text = ""; }
  }
  text = text.trim() || (info.selectionText ?? "").trim();
  if (!text) return;
  selection = { text: text.slice(0, SELECTION_LIMIT), truncated: text.length > SELECTION_LIMIT };
  void chrome.sidePanel.open({ windowId: tab.windowId });
  void chrome.runtime.sendMessage({ type: "SELECTION_AVAILABLE" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // The selection is held in memory until the panel takes it, once.
  if (message?.type === "TAKE_SELECTION") { const taken = selection; selection = { text: "", truncated: false }; sendResponse(taken); }
  if (message?.type === "SET_DRAFT") { selectedDraft = typeof message.text === "string" ? message.text.slice(0, 10000) : ""; sendResponse({ ok: true }); }
});

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const origin = sender.origin ?? "";
  if (message?.type !== "PAIR_TOKEN" || typeof message.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(message.token) || !/^(https:\/\/(www\.)?lynkr\.cloud|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin)) { sendResponse({ success: false }); return; }
  void chrome.storage.local.set({ token: message.token, apiOrigin: origin }).then(() => { void chrome.runtime.sendMessage({ type: "PAIRED" }).catch(() => {}); sendResponse({ success: true }); });
  return true;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "insert-draft" || !selectedDraft) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: insertDraft, args: [selectedDraft] });
    if (!result[0]?.result) void chrome.runtime.sendMessage({ type: "INSERT_FAILED" }).catch(() => {});
  } catch { void chrome.runtime.sendMessage({ type: "INSERT_FAILED" }).catch(() => {}); }
});
