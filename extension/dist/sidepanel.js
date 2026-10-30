import { insertDraft } from "./insert.js";
const el = (id) => document.getElementById(id);
const status = el("status");
const contactSelect = el("contact");
const draft = el("draft");
let token = "", origin = "", contacts = [];
function say(message) { status.textContent = message; }
function view(name) { for (const n of ["paired", "unpaid", "unpaired"])
    el(n).hidden = n !== name; }
async function api(path, init = {}) {
    const r = await fetch(`${origin}/api/ext/${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
        if (r.status === 401) {
            token = "";
            await chrome.storage.local.remove("token");
            view("unpaired");
        }
        if (r.status === 402)
            view("unpaid");
        throw new Error(data.error || "Could not reach Lynkr.");
    }
    return data;
}
function fillContacts() {
    const query = el("search").value.toLowerCase();
    const previous = contactSelect.value;
    contactSelect.replaceChildren();
    for (const c of contacts.filter(c => `${c.name} ${c.company ?? ""}`.toLowerCase().includes(query))) {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = [c.name, c.role, c.company].filter(Boolean).join(" · ");
        contactSelect.append(option);
    }
    if ([...contactSelect.options].some(o => o.value === previous))
        contactSelect.value = previous;
    showContact();
}
function showContact() {
    const c = contacts.find(x => x.id === contactSelect.value);
    el("contact-details").textContent = c ? `Goal: ${c.goal.replaceAll("_", " ")} · Intent: ${c.intent.replaceAll("_", " ")} · ${c.status.replaceAll("_", " ")}` : "No contacts found. Add one in Lynkr.";
    el("write").disabled = !c;
}
async function load() {
    const saved = await chrome.storage.local.get(["token", "apiOrigin"]);
    token = typeof saved.token === "string" ? saved.token : "";
    origin = typeof saved.apiOrigin === "string" ? saved.apiOrigin : "";
    if (!token || !/^(https:\/\/(www\.)?lynkr\.cloud|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/.test(origin)) {
        view("unpaired");
        return;
    }
    try {
        const data = await api("contacts");
        contacts = data.contacts;
        view("paired");
        fillContacts();
        say("");
    }
    catch (e) {
        say(e.message);
    }
}
async function takeSelection() { const r = await chrome.runtime.sendMessage({ type: "TAKE_SELECTION" }).catch(() => null); if (r?.text) {
    el("selection-info").hidden = false;
} }
async function setDraft(text) { draft.value = text; await chrome.runtime.sendMessage({ type: "SET_DRAFT", text }).catch(() => { }); }
async function copy() { try {
    await navigator.clipboard.writeText(draft.value);
    say("Copied. Click in the box and paste.");
}
catch {
    say("Copy was blocked. Select the draft and copy it manually.");
} }
el("search").addEventListener("input", fillContacts);
contactSelect.addEventListener("change", showContact);
draft.addEventListener("input", () => { void chrome.runtime.sendMessage({ type: "SET_DRAFT", text: draft.value }).catch(() => { }); });
el("write").addEventListener("click", async () => {
    if (!contactSelect.value)
        return;
    try {
        say("Writing…");
        const result = await api("draft", { method: "POST", body: JSON.stringify({ contactId: contactSelect.value, channel: el("channel").value }) });
        const versions = result.versions;
        const box = el("drafts");
        box.replaceChildren();
        versions.forEach((v, i) => { const button = document.createElement("button"); button.textContent = `Version ${i + 1}: ${v.verdict}`; button.addEventListener("click", () => { void setDraft(v.body); }); box.append(button); });
        if (versions[0])
            await setDraft(versions[0].body);
        say(result.strongerQuestion || "Review your draft before sending.");
    }
    catch (e) {
        say(e.message);
    }
});
el("insert").addEventListener("click", async () => {
    if (!draft.value.trim())
        return;
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id)
            throw new Error();
        const r = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: insertDraft, args: [draft.value] });
        if (!r[0]?.result)
            throw new Error();
        say("Inserted. Review it before sending.");
    }
    catch {
        await copy();
    }
});
el("copy").addEventListener("click", () => { void copy(); });
el("save-profile").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
        const u = new URL(tab?.url ?? "");
        if (u.protocol !== "https:" || !["linkedin.com", "www.linkedin.com"].includes(u.hostname) || !/^\/in\/[a-z0-9-]+\/?$/i.test(u.pathname))
            throw new Error();
        if (!contactSelect.value) {
            say("Choose a contact first.");
            return;
        }
        await api("profile", { method: "POST", body: JSON.stringify({ contactId: contactSelect.value, profileUrl: u.toString() }) });
        say("Profile link saved.");
    }
    catch (e) {
        say(e instanceof TypeError || !(e instanceof Error) || !e.message ? "Open a LinkedIn profile before saving its link." : e.message);
    }
});
el("mark").addEventListener("click", async () => { const stage = el("outcome").value; if (!stage || !contactSelect.value)
    return; try {
    await api("outcome", { method: "POST", body: JSON.stringify({ contactId: contactSelect.value, status: stage }) });
    await load();
    say("Stage saved.");
}
catch (e) {
    say(e.message);
} });
el("clear-selection").addEventListener("click", () => { el("selection-info").hidden = true; });
chrome.runtime.onMessage.addListener(message => { if (message?.type === "PAIRED")
    void load(); if (message?.type === "SELECTION_AVAILABLE")
    void takeSelection(); if (message?.type === "INSERT_FAILED")
    void copy(); });
void load();
void takeSelection();
