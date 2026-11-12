import { insertDraft } from "./insert.js";
import {
  ANGLE_LABEL, ApiError, MESSAGE_SELECTION_MAX, ORIGIN_PATTERN, PROFILE_MESSAGES, SELECTION_PROBLEM_TEXT, TAP_LABEL,
  checkProfileTab, commentBody, commenterOn, createClient, flagSegments, formatIST, isLinkedInTab, selectionProblem, tapSaved, tapsFor,
  type CommentAuthor, type CommentGoal, type CommentOption, type CommentResult, type PanelState, type TapAction,
} from "./api.js";

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

// ---- which view is showing (Commenter plan U5 state table) ----
// message: the Outreach flow, as before. choose: a selection is waiting and Comment is switched on.
// consent: the one-time notice before the first comment. comment: the options.
type Mode = "message" | "choose" | "consent" | "comment";
let mode: Mode = "message", commenter = false, consented = false;
function render() {
  const show = (id: string, on: boolean) => { el(id).hidden = !on; };
  show("chooser", mode === "choose");
  show("consent", mode === "consent");
  show("comment-view", mode === "comment");
  show("message-view", mode === "message");
}
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
  try {
    await loadContacts();
    say("");
    commenter = await commenterOn(origin);
    consented = (await chrome.storage.local.get(["commentConsent"])).commentConsent === true;
    if (!commenter && mode !== "message") mode = "message";
    render();
  } catch (e) { say((e as Error).message); }
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
  if (!r?.text) return;
  selection = { text: r.text, truncated: !!r.truncated || r.text.length > MESSAGE_SELECTION_MAX };
  showSelection();
  if (commenter) {
    // A new selection starts a fresh choice. The old options and reaction are gone.
    mode = "choose";
    el("chooser-text").textContent = r.text.length > 400 ? `${r.text.slice(0, 400)}…` : r.text;
    comment = { goal: null, edited: undefined, parsed: null, picked: 0, options: [] };
    el<HTMLTextAreaElement>("c-reaction").value = "";
    render();
    say("Choose what to do with the selected text.");
    el("choose-comment").focus();
  } else {
    say("Choose who this is for, then write your draft.");
  }
}

// ---- drafts ----

async function setDraft(text: string) { draft.value = text; await chrome.runtime.sendMessage({ type: "SET_DRAFT", text }).catch(() => {}); }
async function copyText(text: string, done: string) {
  try { await navigator.clipboard.writeText(text); say(done); }
  catch { say("Copy was blocked. Select the text and copy it manually."); }
}
async function copy() { await copyText(draft.value, "Copied. Click in the box and paste."); }
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
      body: { contactId: c.id, channel: el<HTMLSelectElement>("channel").value, ...(selection ? { selection: selection.text.slice(0, MESSAGE_SELECTION_MAX), selectionUse: use } : {}) },
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

// ---- comments (Commenter plan U5): the selection stays in this panel; each option is inserted or copied by the person ----

let comment: { goal: CommentGoal | null; edited: CommentAuthor | undefined; parsed: CommentAuthor; picked: number; options: CommentOption[] } = { goal: null, edited: undefined, parsed: null, picked: 0, options: [] };
const note = el("c-note");
const reaction = el<HTMLTextAreaElement>("c-reaction");

function authorShown(): CommentAuthor { return comment.edited ?? comment.parsed; }
function showAuthor() {
  const a = authorShown();
  el("c-author").textContent = a ? `${a.name}${a.headline ? ` · ${a.headline}` : ""}` : "Author not detected";
  el("c-author-edit").textContent = a ? "Edit" : "Add";
}
function setGoal(goal: CommentGoal) {
  comment.goal = goal;
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="c-goal"]')) r.checked = r.value === goal;
}
function busy(on: boolean) {
  for (const id of ["c-regen", "c-back"]) el<HTMLButtonElement>(id).disabled = on;
  for (const r of document.querySelectorAll<HTMLInputElement>('input[name="c-goal"]')) r.disabled = on;
  reaction.disabled = on;
}
function pick(i: number) {
  comment.picked = i;
  document.querySelectorAll<HTMLElement>(".opt").forEach((c, n) => c.classList.toggle("on", n === i));
  const option = comment.options[i];
  if (option) void setDraft(option.body);
}
function showOptions(options: CommentOption[]) {
  const list = el("c-options");
  list.replaceChildren();
  comment.options = options;
  el("c-options-title").hidden = !options.length;
  el("c-footer").hidden = !options.length;
  options.forEach((o, i) => {
    const item = document.createElement("li");
    item.className = "opt";
    const id = `c-opt-${i}`;
    const label = document.createElement("label");
    label.htmlFor = id;
    const radio = document.createElement("input");
    radio.type = "radio"; radio.name = "c-opt"; radio.id = id; radio.checked = i === 0;
    radio.addEventListener("change", () => pick(i));
    label.append(radio, document.createTextNode(ANGLE_LABEL[o.angle]));
    const text = document.createElement("p");
    for (const seg of flagSegments(o.body, o.flags)) {
      if (!seg.flagged) { text.append(document.createTextNode(seg.text)); continue; }
      const mark = document.createElement("span");
      mark.className = "check";
      mark.textContent = seg.text;
      const tag = document.createElement("span");
      tag.className = "check-tag";
      tag.textContent = " (Check this line)";
      text.append(mark, tag);
    }
    const why = document.createElement("p");
    why.className = "why";
    why.textContent = `Why this works: ${o.why}`;
    const actions = document.createElement("div");
    actions.className = "actions";
    const insert = document.createElement("button");
    insert.type = "button"; insert.className = "primary"; insert.textContent = "Insert";
    insert.setAttribute("aria-label", `Insert ${ANGLE_LABEL[o.angle]} option`);
    insert.addEventListener("click", () => { radio.checked = true; pick(i); void insertComment(o.body); });
    const copyBtn = document.createElement("button");
    copyBtn.type = "button"; copyBtn.textContent = "Copy";
    copyBtn.setAttribute("aria-label", `Copy ${ANGLE_LABEL[o.angle]} option`);
    copyBtn.addEventListener("click", () => { radio.checked = true; pick(i); void copyText(o.body, "Copied. Click in the comment box and paste."); });
    actions.append(insert, copyBtn);
    item.append(label, text, why, actions);
    list.append(item);
  });
  if (options.length) pick(0);
}

/** Puts the option in the comment box the person clicked, only on LinkedIn. Anything else copies it (R10, R11). */
async function insertComment(text: string) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isLinkedInTab(tab.url)) throw new Error("not linkedin");
    const r = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: insertDraft, args: [text] });
    if (!r[0]?.result) throw new Error("not inserted");
    say("Inserted. Review it, then press Post on LinkedIn.");
  } catch { await copyText(text, "Copied. Click in the comment box and paste."); }
}

async function generate() {
  if (!selection) return;
  const problem = selectionProblem(selection.text);
  if (problem) { note.textContent = SELECTION_PROBLEM_TEXT[problem]; say(SELECTION_PROBLEM_TEXT[problem]); showOptions([]); return; }
  busy(true);
  note.textContent = "";
  say("Writing options…");
  // The reaction box is disabled while writing, so focus moves there only after it is enabled again.
  let toReaction = false;
  try {
    const result = await client.request<CommentResult>("comment", { body: commentBody(selection.text, comment.goal, reaction.value, comment.edited) });
    setGoal(result.goal);
    comment.parsed = result.author;
    showAuthor();
    if (result.status === "skip") {
      showOptions([]);
      if (result.reason === "no_input") { note.textContent = result.why; toReaction = true; }
      else if (result.reason === "off_topic") { note.textContent = `${result.why} Add your reaction and try again.`; toReaction = true; }
      else note.textContent = `${result.why} Press Regenerate to try again.`;
      say("No comment written.");
    } else {
      showOptions(result.options);
      note.textContent = result.options.length === 1 ? "The other options didn't pass Lynkr's checks." : "";
      say(`${result.options.length} ${result.options.length === 1 ? "option" : "options"} ready. Nothing is posted for you.`);
      el("c-options-title").focus();
    }
  } catch (e) {
    showOptions([]);
    const err = e as Error;
    note.textContent = err.message;
    say(err instanceof ApiError && err.status === 429 ? err.message : `${err.message} Your selection is kept. Press Regenerate to retry.`);
  } finally { busy(false); if (toReaction) reaction.focus(); }
}

function startComment() {
  mode = "comment";
  render();
  showAuthor();
  showOptions([]);
  el("c-note").textContent = "";
  void generate();
}
el("choose-comment").addEventListener("click", () => {
  if (consented) { startComment(); return; }
  mode = "consent"; render(); el("consent-title").focus();
});
el("choose-message").addEventListener("click", () => { mode = "message"; render(); say("Choose who this is for, then write your draft."); });
el("consent-yes").addEventListener("click", () => { consented = true; void chrome.storage.local.set({ commentConsent: true }); startComment(); });
el("consent-no").addEventListener("click", () => { mode = "choose"; render(); el("choose-comment").focus(); say("Nothing was sent."); });
el("c-back").addEventListener("click", () => { mode = "choose"; render(); el("choose-comment").focus(); });
el("c-regen").addEventListener("click", () => { void generate(); });
for (const r of document.querySelectorAll<HTMLInputElement>('input[name="c-goal"]')) r.addEventListener("change", () => { if (r.checked) comment.goal = r.value as CommentGoal; });

// The author line: edits change what is shown and sent next time; they never start a generation by themselves (R3).
const authorForm = el<HTMLFormElement>("c-author-form");
el("c-author-edit").addEventListener("click", () => {
  const a = authorShown();
  el<HTMLInputElement>("c-name").value = a?.name ?? "";
  el<HTMLInputElement>("c-headline").value = a?.headline ?? "";
  authorForm.hidden = false;
  el("c-name").focus();
});
authorForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = el<HTMLInputElement>("c-name").value.trim();
  comment.edited = name ? { name, headline: el<HTMLInputElement>("c-headline").value.trim() } : undefined;
  authorForm.hidden = true;
  showAuthor();
  el("c-author-edit").focus();
});
el("c-author-cancel").addEventListener("click", () => { authorForm.hidden = true; el("c-author-edit").focus(); });

// An unpacked (developer) build can save a selection as a test fixture (plan A6). The Chrome Web Store adds update_url to an installed manifest, so a store build never shows this button.
const unpacked = typeof chrome.runtime.getManifest === "function" && !("update_url" in chrome.runtime.getManifest());
el("capture").hidden = !unpacked;
el("capture").addEventListener("click", () => { if (selection) void copyText(selection.text, "Selection copied to the clipboard as a fixture."); });

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
