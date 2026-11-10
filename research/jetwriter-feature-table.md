# JetWriter (jetwriter.ai): feature table for the Commenter

Date 2026-10-30. Public sources only. Nothing here is JetWriter code, prompts or text to reuse.

**Evidence:**
- REA `inspect_web_page` of https://jetwriter.ai/ (evidence `ev_88128b6a…`).
- The Chrome Web Store listing https://chromewebstore.google.com/detail/jetwriter-ai-reply-emails/pdnenlnelpdomajfejgapbdpmjkfpjkp: version 2026.10.29, 500,000 users, 4.1 from 1.4K ratings.
- A static reading of the public extension package's `manifest.json` and content script, with REA `analyze_javascript_application` (evidence `ev_bcc1f73a…`). The package was unpacked in its own folder outside the repo and never executed.

| Feature | How it works (observed) | What Lynkr adopts | What Lynkr does differently |
|---|---|---|---|
| Where the comment tool appears | A MutationObserver adds an AI button to each LinkedIn comment box toolbar, beside the emoji picker. Selectors: `button[data-view-name="comment-emoji-picker"]`, fallback `button.comments-comment-box__emoji-picker-trigger` (content script) | A button in or beside the comment box, the lowest-friction entry point | Injecting needs host permission on linkedin.com, which Lynkr's KD1 rules out. See the Commenter plan's [DECISION] |
| Data it collects for a comment | `linkedInCommentMetadata`: `postAuthorName` (`update-components-actor__title`), `postAuthorDescription` (`…actor__description`), `postContent` (`expandable-text-box` / `update-components-text`), `postComments` (`comments-comment-list__container`), `writeCommentAs` | The same inputs: post text, author name and headline, the thread so far, and who writes | Add the user's goal and Story Vault facts. JetWriter's "profile" is free text (store listing). Read only the one post the user acts on |
| Permissions | `host_permissions: ["<all_urls>"]`, a content script on `<all_urls>`, `storage`, `scripting`, `contextMenus` (`manifest.json`) | — | Lynkr's extension has `activeTab`, `sidePanel`, `scripting`, `storage`, `contextMenus`, with hosts lynkr.cloud and localhost only (`extension/manifest.json`). Reading every site feeds the ban fear users describe (`research/reddit-pain-points.md` rows 13–16) |
| How text reaches the box | Clears the box's `innerHTML`, focuses it, then `execCommand("insertText")` (content script) | The same insertion method. Lynkr's `extension/src/insert.ts` already uses `execCommand("insertText")` | Never wipe what the user typed. Insert at the cursor and never post |
| Generation | JetWriter's server (`jetwriter.ai`, Firebase), or the user's own OpenAI, Anthropic or Google key (`background.js` URLs) | Server-side generation with guards | Grounded in the Story Vault, with the outreach grounding checks (`lib/outreach/draft.ts` `draftProblem`) |
| Personalisation | "Teach the AI about you", writing styles, saved prompts, response length (store listing) | Writing style and rules, shared with Posts | Goal-aware output (job seeker, freelancer, visibility builder) with a "why this works" line |
| Telemetry | Mixpanel `api.mixpanel.com/track` (`background.js`). Events such as `response_inserted` carry the user's prompt (content script) | Count-only events | Never send prompt or comment text to analytics (`lib/metrics.ts` rule) |
| Breadth | Gmail, WhatsApp Web, LinkedIn, Outlook, Zoho, Slack, Freshdesk, Zendesk (home page) | — | LinkedIn only, focused on job and visibility goals |
| Pricing | Free plan with limited monthly responses; paid unlimited; bring-your-own key (store listing) | — | Paid only, in the ₹499 plan. Free means the interview only (`research/context-brief.md`) |

**Weak or risky points:**
1. Blanket `<all_urls>` access means it runs on every page.
2. It depends on LinkedIn's class names. It has fallbacks, but those break when LinkedIn redesigns.
3. It wipes the comment box before inserting.
4. Prompts reach Mixpanel.
5. Nothing ties output to the user's goals or checks claims, so it's generic by design. That's the AI tell readers complain about (`research/reddit-pain-points.md` rows 1–9).

**Not found:**
- JetWriter's comment prompt and its quality checks (server-side).
- Whether it shows several options or one.
- Its LinkedIn-specific limits.
