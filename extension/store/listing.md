# Chrome Web Store Listing Draft - Lynkr Outreach Extension

**Draft status:** Awaiting A5 approval. Do not publish.

---

## One-line Description

Write better LinkedIn messages. Lynkr drafts personalized outreach messages from your facts and sends them to LinkedIn.

---

## Overview

Lynkr helps you reach people on LinkedIn with messages that are specific, truthful and tailored to the person. Select text from LinkedIn, pull in facts from public pages outside LinkedIn, or add recipients from your own connections. Lynkr writes complete drafts for you to review, and the Chrome extension lets you insert them into LinkedIn's message box with one click.

---

## What Lynkr Does

- **Gather facts about the person**: See their background, recent activity, and what they're working on
- **Build a tailored brief**: Get a one-screen summary of who they are and why they're relevant
- **Write personalized drafts**: Choose goals like "find a job", "win clients", or "find a mentor", and Lynkr writes complete messages tailored to that goal
- **Pick the best version**: View 2–3 different angles for each message, then choose the one that feels right
- **Send from LinkedIn**: Insert drafts into LinkedIn's message box, or copy-paste them manually

---

## Key Features

### 1. Goal-Based Drafts

Choose what you want to achieve:
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

Lynkr tailors each message to your goal and your relationship to the person.

### 2. Fact-Based Writing

Lynkr's drafts are grounded in facts:
- Text you select on LinkedIn
- Public pages you confirm (outside LinkedIn)
- Your own notes and context in the Story Vault

No "no magic" placeholders. Every claim traces to an actual fact or is explicitly hypothetical.

### 3. Multiple Angles

See 2–3 complete message versions with different openings and angles. Choose the one that fits your situation, or style of connection.

### 4. Chrome Extension

The extension brings Lynkr's drafts into LinkedIn:
- Select text on any page
- Use "Write with Lynkr" to send it to Lynkr for drafting
- Insert the chosen draft into a LinkedIn message box with one click

---

## Permissions Justification

### activeTab
**Purpose:** Inserts a draft into the text box you clicked.

Chrome grants `activeTab` only when you take an action (click a button, use the menu, or press the shortcut). The extension uses it to:
- Type the selected draft into LinkedIn's message or comment box
- Save the address of the page you're on when you press "Save this profile link"
- Read only the current tab's URL, not its page content

### contextMenus
**Purpose:** Adds "Write with Lynkr" to the right-click menu.

When you select text and right-click, Lynkr receives that selected text without ever reading the page. This lets you turn selected text into a draft source.

### storage
**Purpose:** Keeps your pairing token in the extension.

When you connect the extension, Lynkr gives it a token so the extension can identify you. The token is stored locally in the browser and used with every request to Lynkr's servers.

### sidePanel
**Purpose:** Opens the Lynkr panel beside LinkedIn.

The panel shows your contacts, goals, and drafts so you can browse them and choose which draft to insert into LinkedIn.

### scripting
**Purpose:** Runs the insert function in the active tab.

This executes the browser's insert-text command to type the draft text into the focused text box on LinkedIn. It runs only when you click Insert and requires no access to page content.

### No host permissions for linkedin.com

The extension asks for no permission to access LinkedIn pages. It can only:
- Insert text into boxes you clicked
- Receive selected text through the context menu
- Save the tab address when you press "Save this profile link"

These are minimal bindings to LinkedIn's interface for manual insertion.

---

## Data and Privacy

### What Lynkr Stores About You

When you use the extension:
- Your contacts (name, company, role, profile URL, relationship, goal, etc.)
- At most 3 facts per contact with their sources (public pages, your selections, notes)
- Your drafts (organized by contact and channel: connection note, first message, DM, InMail, email)
- Your extension pairing token (stored hashed)

All of this is stored in Lynkr's account database and only belongs to you.

### Data Use

- Text you select and send is used once for drafting, then discarded
- Profile URLs you save are used to add contacts and briefs
- Drafts are sent to OpenAI for drafting (your subscription covers this)
- Public pages you search and confirm are fetched only for those results (domains are excluded like linkedin.com, x.com, etc.)

OpenAI handles your text under its own terms. You're responsible for what you enter—no passwords, government IDs, or other people's private information.

### What Lynkr Never Does

- No scraping or automation of LinkedIn
- No sending messages for you—you send everything
- No reading LinkedIn pages or scraping profile data
- No collecting your LinkedIn connections file
- No selling or sharing your data with third parties

### Search Exclusions

When Lynkr searches for a person on public pages outside LinkedIn, it excludes:
- LinkedIn, Facebook, Instagram, X (formerly Twitter), Threads, Reddit

Only pages you confirm are about this person are fetched.

### Data Retention

Your contacts and briefs are kept while you're a Lynkr user. You can download and delete all your data at any time through the app. Contacts are removed automatically after 12 months of inactivity.

---

## Limitations

- **Paid subscription required:** The extension works only with an active Lynkr account and subscription
- **LinkedIn’s interface:** If LinkedIn changes its text editors, the extension may need to copy to clipboard as fallback
- **Search limits:** Daily search limits apply (20 searches per user per day, 2000 across all users by default)
- **LinkedIn terms:** You must comply with LinkedIn's Terms of Service. Lynkr does not automate LinkedIn actions.
- **AI drafts:** Drafts are generated by AI. You're responsible for accuracy and appropriateness.

---

## Chrome Web Store Safety Guidelines Compliance

The extension:
- Is a single-purpose productivity tool for LinkedIn messaging
- Is not a browser hijacker or security risk
- Does not collect excessive permissions
- Clearly explains in the Privacy Policy what it reads and stores
- Does not display ads, track users without consent, or compromise privacy

---

## Who Should Use Lynkr

This extension is for professionals who:
- Network on LinkedIn and want to write more thoughtful messages
- Run out of ideas on what to say when reaching out
- Want their outreach to be specific, not generic
- Manage LinkedIn as a sales or hiring channel

---

## Should You Use This?

Ask yourself:
- Do I send LinkedIn messages regularly?
- Do I struggle to know what to write in a post-first message?
- Do I want my outreach to be based on real facts about the person?
- Am I willing to review and approve each message before sending?

If you answer yes, Lynkr's extension can help you write better LinkedIn messages.

---

## Questions?

- Visit the forum at ask.lynkr.cloud
- Email support at hello@lynkr.cloud
- See the privacy policy at www.lynkr.cloud/privacy
- See the full documentation at docs.lynkr.cloud

---

## Requirements

- Google Chrome browser (applicable at the time of this listing)
- An active Lynkr account with subscription
- Assistant (AI provider) access: drafts are written by OpenAI, which requires an active subscription

---

## Legacy Acknowledgment

Lynkr earlier versions (v1) used a browser-only tracker. This extension stores contacts in your Lynkr account so you can use them on any device. If you're still using v1 contacts, they appear in your account after you first sign in.

---

**Last updated:** 2026-10-28 (draft)  
**Effective:** When published after A5 approval

---

### Mapping to Requirements (for Aryan's review)

| Claim in Listing | Requirement ID | Notes |
|---|---|---|
| Only reads selected text, never LinkedIn pages | R21, R29, KD1 | Explicit on permission page and in-take |
| No automation of LinkedIn actions | R29, KD8 | Listed in No Automation and Requirements |
| Inserts text you approve before sending | R23, R24 | "Insert into LinkedIn's message box with one click" |
| Recipient briefs from public pages outside LinkedIn | R11, KD6 | "Public pages you confirm (outside LinkedIn)" |
| User is responsible for message content | Terms §Your Responsibility | Explicit statement |
| Extension asks for no permission to read linkedin.com host | KTD8 manifest | No host_permissions for linkedin.com |
| Caps: 20 searches/day, 2000/month | R32, KTD6, KTD13 | Listed in Limitations |
| Contacts and briefs stored per user account | R30, KTD1 | "All of this is stored in Lynkr's account database" |
| Delete my data and Download my data available | R30 | Implied by "You can download and delete... at any time" |
| Extension drafts require paid subscription (checking) | KTD12 | Extension checks subscription on each request |
| Search excludes linkedin.com and social networks | R31, KTD6 | "Excludes: LinkedIn, Facebook, Instagram, X, Threads, Reddit" |
| Privacy page describes exactly what is read/stored | R33, KD1 | Separate privacy policy visibility |
| No Facebook/Twitter/X scraping even if URLs contain them | KD6 | Exclusion list explicit |