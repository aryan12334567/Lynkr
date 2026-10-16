# Feature spec: Connect Coach

Source: `CONTEXT.md`, approved spec item 11. Lynkr-only (no UpLinked equivalent on its public pages), so no evidence step. The app writes; the user finds people and sends everything in LinkedIn.

## What it does
A **Connect** tab with four parts:
1. **Who to look for:** 5–8 cards describing *kinds* of people (e.g. "Data analyst team leads at analytics firms in Pune"), each with why and a LinkedIn people-search link the user opens themselves. Never named individuals.
2. **Note writer:** the user pastes a person's headline, About or recent post, or uploads a screenshot of their profile or post. Lynkr works out who they are and one specific thing worth mentioning, then writes a connection note of 200 characters or fewer, using only that and the user's own facts, with blanks for anything missing. No pitching, no job or referral ask, never "Hi" alone. A profile URL alone can't work (Lynkr can't open LinkedIn pages), and the tab says so.
3. **Note budget:** the user sets how many personalised notes they get per month (default 3; LinkedIn's help pages disagree: 3 or 5 for free accounts). Lynkr shows "notes left this month" and advises spending notes on strangers; people who already engage with your posts can get a request without a note. A "warm up first" tip links to the comment drafts.
4. **People tracker:** add one person at a time (a label the user types, e.g. "SDR manager at a Pune SaaS firm", plus relationship and whether a note was used). States: To find → Sent → Accepted → Messaged → Replied. After Accepted, Lynkr points to the ask-ladder draft for that relationship. After Messaged, a follow-up is due at 5 days without a reply. Default cap: 5 new people per week (editable 1–20). No bulk upload.

## Data
```
GenerateReply.connect.look_for: { who: string; why: string; search: string }[]   // 5–8
Connect (localStorage) {
  monthlyNotes: number      // default 3, 0–100
  weeklyCap: number         // default 5, 1–20
  people: Person[]
}
Person { id; label; relationship: "stranger"|"alumni"|"knows_me"; withNote: boolean;
         status: "to_find"|"sent"|"accepted"|"messaged"|"replied"; addedAt: ISO; sentAt?: ISO; messagedAt?: ISO }
```
Note request (`POST /api/connect`): `{ profile, facts: string[], relationship, text?, image?: { media_type: png|jpeg|webp, data: base64 ≤ 4 MB } }` → `{ who, hook, note }`.

## Rules
1. Who-to-look-for cards describe roles, places, companies and communities only. Demo mode removes any run of two or more capitalised words from the user's "who to reach" answer before using it, so a person's full name typed there doesn't end up in a card.
2. Search links: `https://www.linkedin.com/search/results/people/?keywords=<encoded search>`. Lynkr never fetches them.
3. Note: ≤ 200 characters after the blanks are filled; copy stays locked until blanks are filled and the length fits. Pasted text and screenshots are untrusted data. Screenshots are sent to the AI for that one request and never stored.
4. Demo mode (no key) writes the note from a template and can't read screenshots; it says so instead of failing silently.
5. Budget month and cap week are in IST. A note counts against the month when a person with "used a note" is marked Sent.
6. Removing a person never refunds a note already sent.

## Out of scope
Searching LinkedIn or the web for named people, scraping, opening profile URLs, sending requests, auto-accept, bulk lists.
