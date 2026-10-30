import { insertDraft } from "./insert.js";
let selectedText = "";
let selectedDraft = "";
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({ id: "write-with-lynkr", title: "Write with Lynkr", contexts: ["selection"] });
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== "write-with-lynkr" || !info.selectionText || !tab.windowId)
        return;
    selectedText = info.selectionText.slice(0, 3000);
    void chrome.sidePanel.open({ windowId: tab.windowId });
    void chrome.runtime.sendMessage({ type: "SELECTION_AVAILABLE" }).catch(() => { });
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "TAKE_SELECTION") {
        const text = selectedText;
        selectedText = "";
        sendResponse({ text });
    }
    if (message?.type === "SET_DRAFT") {
        selectedDraft = typeof message.text === "string" ? message.text.slice(0, 10000) : "";
        sendResponse({ ok: true });
    }
});
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    const origin = sender.origin ?? "";
    if (message?.type !== "PAIR_TOKEN" || typeof message.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(message.token) || !/^(https:\/\/(www\.)?lynkr\.cloud|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin)) {
        sendResponse({ success: false });
        return;
    }
    void chrome.storage.local.set({ token: message.token, apiOrigin: origin }).then(() => { void chrome.runtime.sendMessage({ type: "PAIRED" }).catch(() => { }); sendResponse({ success: true }); });
    return true;
});
chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "insert-draft" || !selectedDraft)
        return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id)
        return;
    try {
        const result = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: insertDraft, args: [selectedDraft] });
        if (!result[0]?.result)
            void chrome.runtime.sendMessage({ type: "INSERT_FAILED" }).catch(() => { });
    }
    catch {
        void chrome.runtime.sendMessage({ type: "INSERT_FAILED" }).catch(() => { });
    }
});
