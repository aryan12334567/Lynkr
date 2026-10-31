# Terms of Service - Draft v3 (Outreach Extension)

**Draft status:** Awaiting A5 approval. Do not publish.

---

## Extension-Specific Terms

These terms apply when you use the Lynkr Chrome extension alongside the web application.

### What the Extension Does

The Lynkr Chrome extension helps you use Lynkr drafts on LinkedIn by:
- Showing your contacts and their drafts in a side panel
- Inserting a draft you choose into a LinkedIn text box you clicked
- Reading text you select and choose to send to Lynkr (through the "Write with Lynkr" menu)
- Saving a LinkedIn profile URL when you press "Save this profile link"

The extension never reads LinkedIn pages, never clicks or sends anything on LinkedIn, and never acts without you pressing a button or menu item first.

### Your Responsibility for Messages

**You are responsible for every message you send on LinkedIn.** Lynkr writes drafts for you to review and approve, but:
- You decide whether to send each message
- You confirm that what you send is accurate and appropriate
- LinkedIn's terms apply to everything you post or send through LinkedIn
- Lynkr does not send messages for you; you send them

If a draft contains an error or doesn't fit the situation, edit it before sending or don't send it.

### No Automation

The extension does not:
- Send connection requests or messages automatically
- Click buttons or links on LinkedIn
- Run actions in sequences or loops
- Scrape or collect LinkedIn profile data

Every action requires you to click or press a key. If LinkedIn asks whether you're using automation, the answer is no.

### Extension Permissions

The extension asks for these Chrome permissions:
- **activeTab:** Lets the extension insert text into the box you clicked, and read the page address when you press "Save this profile link". Chrome grants this only when you take an action (click a button, use the menu or press the shortcut).
- **contextMenus:** Adds "Write with Lynkr" to the right-click menu when you select text.
- **storage:** Saves your pairing token in the extension so you stay signed in.
- **sidePanel:** Opens the panel beside LinkedIn.
- **scripting:** Runs the insert function in the active tab when you click Insert.

The extension asks for no permission to read `linkedin.com` pages. It can only insert text and read what you explicitly select or the address when you ask.

### Token Security

When you connect the extension:
1. The web app creates a random token for this extension only
2. The token is shown once; Lynkr stores it hashed
3. The extension keeps the token in Chrome's local storage
4. You can revoke it any time from My data in the web app

Keep the token private. Anyone with it can read your Lynkr contacts and drafts. If you think it's been exposed, revoke it and pair again.

### Pairing and Subscription

The extension works only when:
- You're signed in to Lynkr with an account
- You have an active Lynkr subscription (the extension checks this on each request)
- You've paired the extension from the Lynkr web app

If your subscription ends, the extension shows an upgrade message and stops working until you renew.

### Data the Extension Sends

When you use the extension:
- The token is sent with every request to identify you
- Text you select and confirm is sent once for drafting, then discarded
- Profile URLs you save are sent to add them to your contacts
- Outcomes you mark are sent to update contact stages

The extension sends data only to Lynkr's servers (`lynkr.cloud` and its preview/local origins during development), never to other sites.

### If LinkedIn Changes Its Interface

LinkedIn can change its message boxes and text editors at any time. If insertion stops working, the extension copies the draft to your clipboard and tells you to paste it. That fallback always works.

### If LinkedIn Objects

LinkedIn has shut down extensions that read profile pages or automate actions. Lynkr's extension is designed to stay within LinkedIn's terms by:
- Never reading pages
- Never automating LinkedIn actions
- Requiring your approval for every insert

If LinkedIn still objects and removes the extension, the Lynkr web app continues to work. You can copy drafts and open profiles from the web app without the extension.

### Termination

We can revoke your extension access if:
- You use it in a way that violates LinkedIn's terms
- You automate it or run it through a script (it's designed for manual use only)
- Your Lynkr subscription ends

You can stop using the extension at any time by removing it from Chrome, or by revoking its token in My data.

### Updates

The extension updates automatically through the Chrome Web Store. If an update changes what the extension can do or read, the new permissions will require your approval in Chrome.

---

## General Terms (Existing)

The existing Lynkr Terms of Service continue to apply:
- You use Lynkr at your own risk
- Lynkr makes no warranty that drafts will get replies or results
- You're responsible for what you post or send
- The service is provided as-is
- Content you enter remains yours; Lynkr claims no ownership
- You must be 18 or older

For the full terms, see the main Terms of Service page.

---

**Last updated:** 2026-10-28 (draft)  
**Effective:** When published after A5 approval
