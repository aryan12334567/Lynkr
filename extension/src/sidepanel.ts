import { insertDraft } from "./insert.js";
import { ApiError, ORIGIN_PATTERN, PROFILE_MESSAGES, TAP_LABEL, checkProfileTab, createClient, formatIST, tapSaved, tapsFor, type PanelState, type TapAction } from "./api.js";

type Contact = { id: string; name: string; company: string | null; role: string | null; profileUrl: string | null; goal: string; intent: string; status: string };
type Version = { body: string; angle: string; verdict: string };
type Selection = { text: string; truncated: boolean };

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = el<HTMLParagraphElement>("status");
const contactSelect = el<HTMLSelectElement>("contact");
const draft = el<HTMLTextAreaElement>("draft");
const words = (text: string) => text.replaceAll("_", " ");

let token = "", origin = "", contacts: Contact[] = [], selection: Selection | null = null;
const client = createClient({
  auth: () => (token && origin ? { token, origin } : null),
  onUnauthorized: async () => { token = ""; await chrome.storage.local.remove("token"); view("unpaired"); },
  onLapsed: () => view("unpaid"),
});

function say(message: string) { status.textContent = message; }
function view(name: PanelState) { for (const n of ["paired", "unpaid", "unpaired"] as const) el(n).hidden = n !== name; }
const current = () => contacts.find(c => c.id === contactSelect.value);

// ---- contacts ----

function fillContacts() {
  const query = el<HTMLInputElement>("search").value.trim().toLowerCase();
  const previous = contactSelect.value;
  contactSelect.replaceChildren();
  for (const c of contacts.filter(c => `${c.name} ${c.company ?? ""} ${c.role ?? ""}`.toLowerCase().includes(query))) {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = [c.name, c.role, c.company].filter(Boolean).join(" · ");
    contactSelect.append(option);
  }
  if ([...contactSelect.options].some(o => o.value === previous)) contactSelect.value = previous;
  showContact();
}
function showContact() {
  const c = current();
  el("contact-details").textContent = c ? `Goal: ${words(c.goal)} · Intent: ${words(c.intent)} · ${words(c.status)}` : "No contacts found. Add one in Lynkr.";
  el<HTMLButtonElement>("write").disabled = !c;
  renderTaps();
}
async function loadContacts() {
  const data = await client.request<{ contacts: Contact[] }>("contacts");
  contacts = data.contacts;
  view("paired");
  fillContacts();
}
async function load() {
  const saved = await chrome.storage.local.get(["token", "apiOrigin"]);
  token = typeof saved.token === "string" ? saved.token : "";
  origin = typeof saved.apiOrigin === "string" ? saved.apiOrigin : "";
  client.reset();
  if (!token || !ORIGIN_PATTERN.test(origin)) { view("unpaired"); return; }
  try { await loadContacts(); say(""); } catch (e) { say((e as Error).message); }
}

// ---- selected text (held in this panel's memory only) ----

function showSelection() {
  const card = el("selection-card");
  card.hidden = !selection;
  if (!selection) return;
  el("selection-text").textContent = selection.text;
  const note = el("selection-note");
  note.hidden = !selection.truncated;
  note.textContent = selection.truncated ? "Only the first part of a long selection is used." : "";
}
async function takeSelection() {
  const r = await chrome.runtime.sendMessage({ type: "TAKE_SELECTION" }).catch(() => null) as Selection | null;
  if (r?.text) { selection = { text: r.text, truncated: !!r.truncated }; showSelection(); say("Choose who this is for, then write your draft."); }
}

// ---- drafts ----

async function setDraft(text: string) { draft.value = text; await chrome.runtime.sendMessage({ type: "SET_DRAFT", text }).catch(() => {}); }
async function copy() {
  try { await navigator.clipboard.writeText(draft.value); say("Copied. Click in the box and paste."); }
  catch { say("Copy was blocked. Select the draft and copy it manually."); }
}
function showVersions(versions: Version[]) {
  const box = el("drafts");
  box.replaceChildren();
  el("versions-title").hidden = !versions.length;
  versions.forEach((v, i) => {
    const card = document.createElement("article");
    card.className = "card version";
    const title = document.createElement("h3");
    title.textContent = `Version ${i + 1}: ${v.verdict}`;
    const body = document.createElement("p");
    body.textContent = v.body;
    const use = document.createElement("button");
    use.textContent = `Use version ${i + 1}`;
    use.addEventListener("click", () => { void setDraft(v.body); say(`Version ${i + 1} is in the draft box.`); });
    card.append(title, body, use);
    box.append(card);
  });
}
el("write").addEventListener("click", async () => {
  const c = current();
  if (!c) return;
  const use = selection ? (document.querySelector<HTMLInputElement>('input[name="selection-use"]:checked')?.value ?? "contact") : null;
  try {
    say("Writing…");
    const result = await client.request<{ versions: Version[]; strongerQuestion?: string; notesLeft?: number }>("draft", {
      body: { contactId: c.id, channel: el<HTMLSelectElement>("channel").value, ...(selection ? { selection: selection.text, selectionUse: use } : {}) },
    });
    // The selection was used once, for this request. It is gone from the panel now.
    if (selection) { selection = null; showSelection(); }
    showVersions(result.versions);
    if (result.versions[0]) await setDraft(result.versions[0].body);
    const left = el("notes-left");
    left.hidden = typeof result.notesLeft !== "number";
    left.textContent = typeof result.notesLeft === "number" ? `Connection notes left this month: ${result.notesLeft}` : "";
    say(result.strongerQuestion || "Review your draft before sending.");
  } catch (e) {
    say(selection && e instanceof ApiError && e.status === 400 ? "Lynkr could not write from the selected text. Discard the selection to write without it." : (e as Error).message);
  }
});
el("insert").addEventListener("click", async () => {
  if (!draft.value.trim()) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("no tab");
    const r = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: insertDraft, args: [draft.value] });
    if (!r[0]?.result) throw new Error("not inserted");
    say("Inserted. Review it before sending.");
  } catch { await copy(); }
});
el("copy").addEventListener("click", () => { void copy(); });
el("clear-selection").addEventListener("click", () => { selection = null; showSelection(); say("Selection discarded."); });

// ---- the profile link: the tab's address is read only here, when pressed ----

el("save-profile").addEventListener("click", async () => {
  const c = current();
  if (!c) { say("Choose a contact first."); return; }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const check = checkProfileTab(tab?.url);
  if (!check.ok) { say(PROFILE_MESSAGES[check.reason]); return; }
  try {
    await client.request("profile", { body: { contactId: c.id, profileUrl: check.url } });
    c.profileUrl = check.url;
    say("Profile link saved.");
  } catch (e) { say((e as Error).message); }
});

// ---- outcome taps (R40): only the ones for the chosen contact's current stage ----

const pendingOps = new Map<string, string>();
const NEEDS_DETAILS: TapAction[] = ["meeting_booked", "meeting_done"];
let detailsFor: TapAction | null = null;

function renderTaps() {
  const c = current();
  const box = el("taps");
  box.replaceChildren();
  closeDetails();
  const taps = c ? tapsFor(c.status) : [];
  el("stage").textContent = !c ? "" : taps.length ? `Stage: ${words(c.status)}` : `Stage: ${words(c.status)}. This contact is finished.`;
  for (const action of taps) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.action = action;
    b.textContent = TAP_LABEL[action];
    b.addEventListener("click", () => { if (NEEDS_DETAILS.includes(action)) openDetails(action); else void sendTap(action, {}); });
    box.append(b);
  }
}
function openDetails(action: TapAction) {
  detailsFor = action;
  el("tap-details").hidden = false;
  el("happened-row").hidden = action !== "meeting_done";
  el("rating-row").hidden = action !== "meeting_done";
  el("next-row").hidden = action !== "meeting_done";
  el("meeting-row").hidden = action === "meeting_done";
  el("meeting-label").textContent = "Meeting date and time (IST)";
  el<HTMLButtonElement>("tap-save").textContent = `Save ${TAP_LABEL[action].toLowerCase()}`;
  (action === "meeting_done" ? el("happened") : el("meeting-at")).focus();
}
function closeDetails() {
  detailsFor = null;
  el("tap-details").hidden = true;
  el<HTMLFormElement>("tap-details").reset();
}
el("happened").addEventListener("change", () => {
  const moved = el<HTMLSelectElement>("happened").value === "moved";
  el("meeting-row").hidden = !moved;
  el("meeting-label").textContent = "New date and time (IST)";
});
el("tap-cancel").addEventListener("click", () => { closeDetails(); say(""); });
el("tap-details").addEventListener("submit", e => {
  e.preventDefault();
  if (!detailsFor) return;
  const value = (id: string) => el<HTMLInputElement | HTMLSelectElement>(id).value;
  if (detailsFor === "meeting_booked") void sendTap("meeting_booked", { meetingAt: value("meeting-at") });
  else void sendTap("meeting_done", {
    happened: value("happened") || undefined, rating: value("rating") || undefined, next: value("next") || undefined,
    meetingAt: value("happened") === "moved" ? value("meeting-at") : undefined,
  });
});
async function sendTap(action: TapAction, fields: Record<string, string | undefined>) {
  const c = current();
  if (!c) return;
  // A retry after a failed send reuses its id, so the step is recorded once.
  const key = `${c.id}:${action}`;
  const opId = pendingOps.get(key) ?? crypto.randomUUID();
  pendingOps.set(key, opId);
  try {
    const result = await client.request<{ contact: { status: string }; event?: { meetingAt?: string | null }; goalReachedSuggested?: boolean }>("outcome", {
      body: { contactId: c.id, status: action, opId, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) },
    });
    pendingOps.delete(key);
    c.status = result.contact.status;
    closeDetails();
    renderTaps();
    showContact();
    const moved = action === "meeting_done" && fields.happened === "moved";
    say(moved ? `Meeting moved to ${formatIST(result.event?.meetingAt ?? "")}. Undo it in Lynkr.` : tapSaved(action, result));
  } catch (e) {
    if (e instanceof ApiError && e.status > 0 && e.status < 500) pendingOps.delete(key);
    say((e as Error).message);
  }
}

// ---- wiring ----

el("search").addEventListener("input", fillContacts);
contactSelect.addEventListener("change", showContact);
draft.addEventListener("input", () => { void chrome.runtime.sendMessage({ type: "SET_DRAFT", text: draft.value }).catch(() => {}); });
chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "PAIRED") void load();
  if (message?.type === "SELECTION_AVAILABLE") void takeSelection();
  if (message?.type === "INSERT_FAILED") void copy();
});
void load().then(() => takeSelection());
