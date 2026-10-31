# Chrome Web Store Listing Draft - Lynkr Outreach Extension

**Draft status:** Awaiting A5 approval. Do not publish (S1).

Every statement below must match the shipped extension (`extension/manifest.json`) and the Privacy Policy draft (`app/privacy/page-uv2-privacy.tsx`). The table at the end maps each claim to a requirement.

---

## Name and summary (max 132 characters)

**Name:** Lynkr Draft Assistant

**Summary:** Put a Lynkr draft into the LinkedIn box you clicked and track each contact. You review and send everything yourself.

---

## Single purpose

Lynkr Draft Assistant lets you review a message that Lynkr wrote for a contact and put it into the LinkedIn message or comment box you clicked, then record what happened with that contact. It never reads LinkedIn pages and never sends anything.

---

## Description

Lynkr helps you write to people on LinkedIn with messages that are specific, truthful and complete. You choose a goal (a job, a referral, clients, a mentor and so on), add the person, and Lynkr writes two or three finished versions from facts you confirmed. This extension brings those drafts to where you write.

**What the extension does**

- Shows your contacts and their ready drafts in a side panel.
- Puts the draft you choose into the LinkedIn box you clicked. If that does not work, it copies the draft and tells you to paste it.
- Adds "Write with Lynkr" to the right-click menu. Lynkr receives the text you selected, not the page.
- Saves a LinkedIn profile address when you press "Save this profile link". Lynkr receives the address of the tab, nothing from the page.
- Lets you tap what happened (invite sent, accepted, message sent, reply, meeting booked, meeting done, goal reached, close). Each tap adds a dated step to that person's timeline, and Lynkr suggests the next step with its reason.

**What it never does**

- It never reads LinkedIn pages or any page content, and never scrapes or crawls LinkedIn or social networks.
- It never sends a message, comment or connection request. It never clicks anything on the page. You press insert, and you press send.
- It never reads your LinkedIn messages, inbox or calendar.
- It asks for no access to linkedin.com pages.

**Requirements:** a Lynkr account and an active Lynkr subscription (Outreach is part of the paid plan). The extension checks your subscription on each request. Drafts are written by an AI model and can contain mistakes: read and edit them before you send.

---

## Key features

### 1. Goal-based drafts

Choose what you want:
- Find a job
- Get a referral
- Learn and network
- Find a mentor
- Win clients or close a deal
- Hire someone
- Raise funding
- Buy a business
- Find a partner
- Reconnect with people you know

Lynkr tailors each message to your goal and how you know the person.

### 2. Facts you can trace

Every claim in a draft comes from a fact you confirmed or from the person's role and company. Facts about the person come only from:
- public pages outside LinkedIn that you confirmed are about them
- text you selected
- what you typed

Each fact shows its source and date. If Lynkr finds no hook, it says so and writes from role and company only.

### 3. Two or three complete versions

Each version is a complete message that fits the channel (connection note, first message, DM, InMail, email). No blanks or placeholders.

### 4. A timeline for each contact

Why you connected, invite, accepted, message, reply, meeting, how it went, and the next step. Lynkr suggests each next step from a fixed rule and shows the reason. Lynkr asks before it assumes (it never reads a missing record as "no reply"). Steps can be added to your own calendar as a Google Calendar link or an .ics file.

---

## Permissions justification

### activeTab
**Purpose:** Puts a draft into the text box you clicked, and reads the tab address when you press "Save this profile link".

Chrome grants `activeTab` only when you act (click a button, use the menu or press the shortcut). The extension reads only the tab's address, not its content.

### contextMenus
**Purpose:** Adds "Write with Lynkr" to the right-click menu.

When you select text and choose it, Lynkr receives that selected text, not the page.

### storage
**Purpose:** Keeps your pairing token in the extension, so it stays paired.

### sidePanel
**Purpose:** Opens the Lynkr panel beside the page, with your contacts, drafts and the one-tap records.

### scripting
**Purpose:** Runs the insert in the active tab.

It runs only when you press Insert, in the box you clicked. It does not read the page.

### Host access: lynkr.cloud (and localhost for development)
**Purpose:** Lets the extension reach Lynkr's servers to fetch your contacts and drafts and to send your selections, saved addresses and records. The extension is also reachable from the Lynkr web app so you can pair it.

### No host permission for linkedin.com
The extension asks for no access to LinkedIn pages. It can only insert text into a box you clicked, receive text you selected, and read the tab address when you ask.

---

## Data and privacy disclosures (for the Web Store privacy tab)

### What is collected and stored in your Lynkr account

- Personally identifiable information: your name and email (account), and the names, companies, roles and profile addresses of the people you add as contacts.
- User content you create: your drafts, goals and goal details, "why you connected" lines (up to 200 characters), up to 3 facts per contact with their sources and dates, and optional one-line meeting notes (up to 280 characters, shown only to you).
- Activity you record: the dated steps of each contact's timeline.
- Authentication information: your extension pairing token, stored hashed by Lynkr and kept by the extension in Chrome's local storage.

Not collected: page content, browsing history, LinkedIn messages, your LinkedIn password or cookies, and location.

### What is sent, and to whom

- Text you select is sent once to Lynkr for drafting, and Lynkr does not save the raw selection.
- To write a draft, Lynkr sends OpenAI your goal and goal details, your confirmed facts, up to 3 facts about the person with their sources, the "why you connected" line, and any text you selected. Meeting notes are not sent to OpenAI.
- To find public pages about a person, Lynkr sends the search words (usually a name and company) to Exa, and fetches only the results you confirm. Searches leave out LinkedIn, Facebook, Instagram, X, Threads and Reddit.
- Nothing is sold or shared for advertising. Nothing is used for creditworthiness or lending.

Only profile addresses you save and records you tap are written to your account from the extension.

### Retention, export and deletion

Kept until you delete it, and removed automatically after 12 months without activity. "Download my data" includes contacts, timelines and notes. "Delete my data" and deleting a contact remove them, including their facts, drafts, timeline steps and notes. If your subscription lapses you can still read, download and delete them. Revoking the extension from My data stops its token at once. Calendar items you exported stay in your own calendar.

### User guidance

Do not enter other people's private information such as health, money, family or ID details. A short, factual meeting note is fine. You are responsible for what you enter and for every message you send.

---

## Limitations

- **Paid subscription required.** The extension works only with an active Lynkr subscription.
- **LinkedIn's editors change.** If inserting fails, the extension copies the draft to your clipboard and tells you to paste it.
- **Search limits.** 20 public-page searches per user per day, and 2,000 a month across all users by default.
- **LinkedIn's terms.** You must follow LinkedIn's Terms of Service. Lynkr does not automate LinkedIn actions.
- **AI drafts.** Drafts are written by AI and can contain mistakes. Read and edit them.
- **No promise of replies.** Lynkr does not promise replies, referrals or jobs.

---

## Who it is for

People who write to people on LinkedIn for a reason (a job, a referral, clients, hiring, funding, a mentor) and want each message to be specific, true, and sent by themselves.

---

## Questions

- Support and privacy requests: write to the contact address on the Lynkr Contact page (www.lynkr.cloud/contact).
- Privacy policy: www.lynkr.cloud/privacy

---

## Legacy note

Earlier versions of Lynkr kept the people you wrote to in the browser only. With Outreach v2 they are saved to your Lynkr account so you can use them on any device.

---

**Last updated:** 2026-10-31 (draft)
**Effective:** When published after A5 approval (S1)

---

### Mapping each claim to a requirement (for Aryan's review)

Requirement IDs are from `research/build-plan-outreach.md`. KD and KTD are the plan's key decisions.

| Claim in this listing | Requirement | Where it is true in the build |
|---|---|---|
| Reads only selected text and the tab address on request | R21, R22, KD1 | Extension permissions and menu; Privacy "What is read" |
| Never reads page content, clicks or sends | R21, R29, KD8 | No host permission for linkedin.com; insert only on user action |
| Insert into the box you clicked, otherwise copy and paste | R20, R23 | Extension insert with clipboard fallback |
| Everything also works in the web app | R24 | Copy draft and open profile in the web app |
| Save this profile link reads only the address; only /in/ addresses | R8, R21 | Profile-link save |
| Facts come only from confirmed public pages, selections or typed text, each with source and date | R10, R11, R16 | Brief builder |
| "No hook found" is valid; role and company only | R12 | Brief and draft |
| No sensitive details kept as facts | R13 | Brief rules (`lib/outreach/brief.ts`) |
| Two or three complete versions, no placeholders | R15, R17, R19 | Draft engine and checker |
| Ten goals | R2 | `lib/outreach/goals.ts` |
| Search excludes LinkedIn and social networks; only confirmed results fetched | R7, R31, KD6 | `lib/outreach/search.ts` |
| 20 searches a day per user, 2,000 a month | R32, KTD6, KTD13 | Search caps |
| Contacts, facts, drafts, timeline and notes stored per account | R30, R38, R40, R41, R47 | Outreach tables |
| Timeline steps and one-tap records; Lynkr asks before it assumes | R38, R40, R42, KD13 | Person card and `followup.ts` |
| Lynkr suggests the next step from a fixed rule with its reason | R42, R43, KD12 | `lib/outreach/followup.ts` |
| Calendar export (link or .ics); Lynkr cannot remove exported items; sends no invitation | R44 | `lib/ics.ts`, `lib/outreach/calendar.ts` |
| Never reads LinkedIn messages, inbox or calendar | R27, KD13 | No such access exists |
| Meeting notes shown only to the user, not sent to OpenAI | R41, KTD18, D-O3 B | Switch stays off |
| What is sent to OpenAI and to Exa | R33, R11 | Draft and search routes |
| Retention 12 months idle; download, delete contact, delete all | R30, R47 | `lib/cleanup.ts`, My data |
| Lapsed subscribers can read, download and delete | R47, R34 | Reads need a session, writes need a subscription |
| Outreach is part of the paid plan; checked on each request | R34, KTD12 | `extensionAuth` |
| Pairing token stored hashed by Lynkr | R29, KTD8 | Extension pairing |
| Host access only to lynkr.cloud and localhost | R29, KTD8 | `extension/manifest.json` |
| Drafts can contain mistakes; user sends everything | R17, KD8, Terms | Terms draft v3 |
| Privacy page describes exactly what is read, stored and sent | R33 | `app/privacy/page-uv2-privacy.tsx` |
