# Outreach Tester Brief - Draft v3 (U11)

**Draft status:** Awaiting A5 approval. Do not publish.

**Testers:** 5 people with existing Lynkr accounts or willing to sign up for free tier

**Environment:** Chrome desktop, Lynkr preview (or production if v2 is live)

**Test duration:** Over your first 3 days of using Outreach

---

## Purpose of Testing

This brief explains what to test, what to look for, and any known limitations. The goal is to check that:
- Your trips from opening a contact to a ready message take 60 seconds or less (median)
- Your drafts are specific, truthful, and reference real facts
- The extension insertion works reliably on LinkedIn
- The briefs and drafts from public pages are accurate
- You can complete the 6-step check from Aryan's plan without surprises

---

## Test Profile

**Time needed:** ~30 minutes over 3 days

**What to bring:**
- Chrome browser
- Lynkr account (free tier is fine)
- Gmail account (optional, to verify syncing)
- Minutes to write short feedback after each test

**How to report:**
- Brief note: did it work? how long did it take? any surprises?
- Any blocked actions or failed steps
- Priorities: what felt broken vs. what felt amazing

---

## 6-Step Check (from Aryan's U13 Release plan)

**Only run this ONCE during testing.** It confirms the extension works with real LinkedIn.

### Step 1: Pair the extension

1. Open the Lynkr web app (preview or production)
2. Go to your profile or settings
3. Look for "Connect the Chrome extension"
4. Follow the prompts:
   - The web app shows a pairing token once
   - Copy it
   - The browser extension should ask for the token
   - Paste it and accept
5. Confirm the extension panel shows your name, subscription status, and pairs successfully

**What to look for:**
- The token appears on screen only once
- The extension panel opens with your contact list
- You see "Paired" or "Connected" status

**Known limitation:** If you're on unpaid Lynkr tier, the extension will show an upgrade card instead of contacts until you subscribe

---

### Step 2: Save a profile link

1. Open a LinkedIn profile URL: `https://www.linkedin.com/in/<your-profile>/`
2. Open the Lynkr extension panel
3. Click "Save this profile link"
4. On a real LinkedIn page, add yourself as a contact and see it appear in the panel

**What to look for:**
- The extension reads ONLY the address, not the profile
- The browser asks for confirmation before saving
- The contact appears in your Lynkr account (check in the web app)
- Only LinkedIn profile URLs (`linkedin.com/in/...`) are accepted

**Known limitation:** If you paste a profile link from `linkedin.com/company/`, the extension shows a message that only profile pages work

---

### Step 3: Insert a draft into a message box

1. In Chrome, open LinkedIn and go to a message box
2. Click into the box (it has focus)
3. Open the Lynkr extension panel
4. Click a contact profile
5. Click a draft version (any of the 2–3)
6. Click the "Insert" button in the panel

**What to look for:**
- The draft text appears in the LinkedIn message box
- You DID NOT need to select any LinkedIn page content first for this insert
- The panel shows "Inserted" or "Copied to clipboard" text
- On a keyboard, use the shortcut (you can set it during pairing)

**Known limitation:** If LinkedIn's current text editor changes how insert works, the extension copies the text to your clipboard and tells you to paste it manually

---

### Step 4: Use "Write with Lynkr" with a comment

1. Open a LinkedIn post
2. Click into a comment box
3. Select 2–3 lines of the post text (like "This is a great example of...")
4. Right-click and choose "Write with Lynkr"
5. Choose "Comment on this"
6. Pick a contact and version
7. Insert into the comment box

**What to look for:**
- Lynkr receives only the selected text (not the whole page)
- The draft references the selected text meaningfully
- The panel shows 2–3 versions for a comment (not for a connection or friend message)
- You can see the selected text shrink in the panel when you choose "Comment on this"

**Known limitation:** If you right-click without selecting any text, Lynkr offers to start a new draft (no contact) instead of drafting around nothing

---

### Step 5: Confirm nothing was sent

Verify that NO message was sent automatically:
- Check LinkedIn's sent items (message requests, outbox, sent messages) — you should NOT see a new message
- Check LinkedIn's connection requests — you should NOT see a new invite automatically sent
- Check LinkedIn's notifications — you should NOT see a "message sent" or "invitation sent" notification for a message you didn't initiate

**What to look for:**
- Lynkr clearly marks each button as "inserts text" or "copies to clipboard" — nothing says "sends message"
- Extension instructions: "Insert text into the box you clicked" or "Copied. Paste it."
- You are solely responsible for sending everything on LinkedIn

**Known limitation:** This is impossible to verify automatically during testing; you must do it manually each session

---

### Step 6: Revoke the extension

1. Go to your Lynkr profile or settings
2. Find "Connected apps" or "Extension pairing" (look for "Revoke" or "Unpair")
3. Click Revoke and confirm
4. Open the extension panel and verify it shows an unpaired state

**What to look for:**
- Revoking stops all calls from the extension to Lynkr's servers
- The next time you open LinkedIn, the panel can't fetch contacts or drafts
- You can pair again by following Step 1 again (create a new token)

**Known limitation:** Revocation doesn't delete your contacts or briefs — those stay in your Lynkr account. They can be deleted anytime from My data

---

## What to Test (Beyond the 6-Step Check)

### Goal Setup

- [ ] When you open Outreach for the first time, you see goal chips pre-selected (from your interview)
- [ ] Each goal chip (find a job, win clients, etc.) is clickable
- [ ] Selecting a chip and saving it changes your goal
- [ ] The existing Outreach/Connect tabs behave as they did before v2 (when you switch peg to v1)

### Finding People

- [ ] "Add from finder" shows target companies and search links
- [ ] "Add from connections" lets you import your Connections.csv (don't upload, just parse in browser)
- [ ] Adding a contact from your own connections → a ready message in 3 clicks (exact requirement: from import → Add → Write, draft is ready without typing)

### Recipient Briefs

#### From Public Pages

- [ ] Type a name and company → Lynkr searches public pages (Exa, not LinkedIn)
- [ ] You see 5–8 results with titles, URLs and snippets
- [ ] Each result has a "Not this person" or "Not sure" option
- [ ] You click a result and confirm it belongs to that person
- [ ] Lynkr lists 1–3 facts from that page with sources (URL + date)
- [ ] The brief shows the bridge between you and the person

**Known limitation:** If you have no `EXA_API_KEY`, briefs use fixtures; the UI shows "not connected yet" in search results

**Known limitation:** If LinkedIn/X/Reddit URLs appear in results, they're filtered before you see them

#### From Selected Text

- [ ] On LinkedIn, select a person's current role
- [ ] Right-click → Write with Lynkr → "Reply to this"
- [ ] You see 2–3 versions that reference the selection
- [ ] If you select nothing, the draft is grounded only on role + company (no hook found)

### Drafts

- [ ] Each message is COMPLETE — no placeholders like `[[blank]]`, no `TODO`, no brackets
- [ ] Every claim about you traces to a confirmed fact in the Story Vault
- [ ] Every claim about the recipient traces to a confirmed fact in the brief or your own words
- [ ] You see 2–3 complete versions with different angles
- [ ] The "Make it stronger" question appears if a goal detail is missing
- [ ] Answering the question saves it as a `goal_detail` fact, never asked again

### Extension Side Panel

- [ ] When paired, the panel shows: contact picker → goal/intent → drafts → notes left → Save link → outcome taps
- [ ] The contact picker has search so you can find recent contacts quickly
- [ ] Each contact shows goal and intent chips
- [ ] "Save this profile link" only works on `linkedin.com/in/` URLs
- [ ] Mark a sent message as "Mark sent" and you see the invited/attempted stage date update

---

## Known Limitations (Documented in U11)

When reporting bugs during testing, classify by these documented limitations:

1. **No page reading in the extension:** The extension never reads `linkedin.com` pages. It only:
   - Inserts text into boxes you clicked
   - Receives selected text through context menu
   - Saves addresses when you press "Save this profile link"

   If your test expects LinkedIn page content to be visible in the extension, that's by design.

2. **No automation of LinkedIn actions:** The extension does not send connection requests or messages. It only gets text ready for you to send. If your test expects auto-send, that's not built.

3. **Daily and monthly search caps:** 20 searches per user per day, 2000 across all users by default. If you hit the limit during testing, search is paused. You can raise the cap in code (environment variable `LYNKR_SEARCH_MONTHLY_CAP`).

4. **Selected text is not stored:** The extension receives selected text once, uses it for drafting, and then discards the raw selection. You're responsible for saving anything you want to keep in Lynkr's vault.

5. **Extension insertion failure fallback:** If LinkedIn changes its text editor and insertion fails, the extension copies the draft to your clipboard and tells you to paste it. This fallback always works.

6. **Briefs from public pages only:** Brief facts come from public pages outside LinkedIn (Exa, directories, news) that you confirm. Lynkr does not crawl LinkedIn or social networks for personal data.

7. **Breaking with v1 behavior:** If `LYNKR_OUTREACH=v1` in Preview or Production, everything behaves as before: separate Outreach and Connect tabs, browser-tracker people, no goals in the brief. v2 only activates on v1 when you set `LYNKR_OUTREACH=v2` manually (Aryan) or preview auto-detects it.

---

## Reporting Template

For each test session (at least 3 sessions total), report:

**Session #:** (1/3, 2/3, 3/3)

**What I tested:** (short list: e.g., "Briefing, Drafting, Extension Insert")

**Time to complete:** (minutes from start to ready message)

**Successes:** (2–3 things that worked well, felt amazing)

**Surprises:** (2–3 unexpected notes, good or bad)

**Bugs found:** (only documented limitations; if there's something NOT in the list above, note it)

**Improvements:** (what would make this feel more like "me" or more helpful?)

**Replies/Outcomes:** (if you sent any drafts, did they get replies? note any patterns)

---

## Success Criteria (from Build Plan)

Your tests count as passing Outreach if:

- **Median time:** ≤60 seconds from opening a contact to a ready message (count-only timing)
- **Draft specificity:** 10 drafts from 10 goals score "like a person" rating of 4 or higher (via cold-email skill's AI-tells list)
- **Testers:** 4 out of 5 testers send 3+ drafts and rate "sounds like me" ≥4
- **Accuracy:** 0 claims that can't be traced to facts, 0 placeholders, 100% of drafts within channel limits
- **Extension:** Insertion works on real LinkedIn without unexpected failures
- **Briefing:** At least 1 contact where briefs from public pages are accurate and useful

---

## What If Testing Confirms Broken Behavior

If you hit a major issue that stops your testing, report it immediately:

1. **Type:** "blocked" or "unresponsive"
2. **What:** exactly what you tried and what happened
3. **Environment:** Chrome version, OS, Lynkr preview or production, `LYNKR_OUTREACH=v1` or `v2`
4. **Screenshot:** if you can capture the error screen/panel

Valid blocks:
- You cannot pair the extension (no token shown or not accepted)
- The extension crashes when you try to insert
- A LinkedIn page is loading indefinitely or showing a 403/429
- Your account is charged without consent
- Something reads LinkedIn page content (verify in DevTools → Network tab)

Invalid blocks (these are by design):
- You selected nothing and expected a hook
- You tried to read a company page URL (`linkedin.com/company/`) and it failed
- Daily search cap blocked briefing
- LinkedIn's message box doesn't accept the insert command (expect clipboard fallback)

No need to blame — just report the same details above, and Aryan will decide if it's a blocker.

---

**Last updated:** 2026-10-28 (draft)  
**Effective:** When published after A5 approval

---

### Notes for Tester (Aryan)

This brief documents everything testers need to know about the extension. Send it to your 5 testers after they install Chrome and before their first session. It includes:

1. The 6-step check they must run ONCE (to verify extension integrity on real LinkedIn)
2. The checklist beyond the 6-step check (primary testing territory)
3. All documented limitations (what to expect vs. what feels like a bug)
4. A simple reporting template
5. Success criteria they help confirm

If the 6-step check passes and your testers rate "sounds like me" 4+, you're in good shape for release.