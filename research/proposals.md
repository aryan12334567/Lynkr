# Proposals (not done: each needs Aryan's decision)

From the end-to-end audit, 2026-11-16. Each has the evidence, a recommendation and the cost. Nothing here was changed in code.

## P1. Hinglish answers give generic drafts

- **Evidence:** facts are stored in the person's own words. The guards compare words, so an English draft written from a Hinglish fact cannot be traced to it and is rejected; the offline composer then has nothing it may quote. After the audit fix the Hinglish line is no longer pasted into an English message, but the person gets the generic version (`scripts/probe-drafts.mts`, "Hinglish fact"). Demo mode only; not run against a live model.
- **Recommendation:** store a plain-English rendering next to each fact, written by the interview's judge step and shown to the person to confirm ("We'll use this English version in your drafts. Edit it if it's off."). Drafts and guards read the English line; the original is kept.
- **Cost:** a new column or key on `facts` (data model of a shipped table), a judge-prompt change, a live-model eval. About one build unit.

## P2. "No blanks" against the first generator and the Landing line

- **Evidence:** the product principle is complete drafts with no blanks. `lib/prompts.ts` `GENERATE_SYSTEM` (headline, About, posts, the older outreach set) and `firstWinSystem` still tell the model to insert `[[blanks]]`, and the Landing page promises that anything Lynkr does not know "stays a blank only you can fill". Outreach v2 and the Commenter already write complete text.
- **Recommendation:** decide one rule. If complete text wins: change the first-win and post prompts to write around a missing fact, and change the Landing line (a public promise) in the same release.
- **Cost:** two prompt rewrites, one copy change, a live-model eval.

## P3. Prompt wording that should follow the new guards

- **Evidence:** the server now rejects invented titles, quantities, credentials, praise, a shared past and a second ask. `OUTREACH_SYSTEM` does not name these, so a live model may waste a try on a version that is then rejected (the offline version still comes back).
- **Recommendation:** add one line to `OUTREACH_SYSTEM` and to the comment prompt: "Never give the person a job title, years of experience, an award, a result or a quantity that their facts do not state. One question only." Apply only with a live-model eval before and after.
- **Cost:** two lines and one eval run (needs the key; a few rupees).

## P4. Rate limits live in memory and trust the first X-Forwarded-For value

- **Evidence:** `lib/limit.ts:1-8` keeps counts in a module-level Map, so they reset on every deploy and are not shared between instances; `clientIp` (`lib/limit.ts:22-25`) reads the first forwarded address, which the caller may be able to set. Whether Render overwrites that header was **not verified**.
- **Recommendation:** (a) check on the preview which header carries the real client address and read that one; (b) move the daily AI cap and the license-key attempts to the database (the `usage_daily` pattern already exists).
- **Cost:** half a unit; no new service.

## P5. Quota is spent before the provider is called

- **Evidence:** `first-win` takes one of 5 daily tries before the model call (`app/api/first-win/route.ts:42`); search and AI spend are counted before Exa and the model (`lib/outreach/brief.ts`). A provider outage uses up a fresher's tries.
- **Recommendation:** give the try back when the provider fails (not when a draft is rejected).
- **Cost:** small; needs a decrement next to each `takeDaily`.

## P6. A sharing image

- **Evidence:** sharing cards now have a title and description but no image (`app/layout.tsx`).
- **Recommendation:** one 1200x630 image with the wordmark and the line "Write to one person. Sound like you."
- **Cost:** a design, then one file (`app/opengraph-image.png`).

## P7. The landing page is drawn only in the browser

- **Evidence:** `components/ClientApp.tsx` loads the app with `ssr: false`. Search engines that run JavaScript see it; link previews and simple crawlers get the new noscript text only.
- **Recommendation:** render the Landing section on the server and load the app shell on top of it.
- **Cost:** a refactor of `LynkrApp`/`Landing` (they read browser storage on first paint). One unit, with the e2e suites as the safety net.

## P8. The Calendar paywall card against the decided card

- **Evidence:** `components/calendar/CalendarView.tsx:126-134` says the price in a sentence, with "See what's included" and "Not now". The decided card (`research/decisions.md:108-116`) has a headline, a one-line preview, reply proof, the paid list, "₹499/month, no trial", a value-led button and "Maybe later".
- **Recommendation:** use the one shared card everywhere. It is copy on a paywall, so it waits for the U10 copy approval.
- **Cost:** small once the copy is approved.

## P9. Points for a legal read (DPDP Act): not settled here

- Sign-in accounts (email, password hash, OAuth tokens) stay after "Delete my data" by design (`app/api/me/delete/route.ts`). Does the Privacy page say so plainly, and is a full account deletion offered?
- `billing_grace` holds a Dodo customer and subscription id with no user id; neither export nor delete covers it.
- Commenter keeps the names of post authors the person commented on (decision D-C8 is open).
- Export leaves out the linked license key on purpose (it is a credential).
- Deletion is not one transaction: a failure midway leaves part of the data.
- **Recommendation:** have these five read against the Privacy and Terms drafts before the paid launch.

## P10. Smaller items, listed and left

- Webhooks have no event-id store; replay is limited to Dodo's 5-minute signature window, and access is always re-checked with Dodo, so impact is low.
- State-changing session routes have no same-site Origin check (the extension pairing routes do). Cookie SameSite settings were not inspected.
- `app/privacy/page-uv2-privacy.tsx` is an unrouted draft file in `app/`.
- The Calendar does not move its shown week after midnight; only "today" moves.
- An outreach step moved away has no "Moved from" note or Move back button.
- `/api/outreach/signals` has no rate limit (it fetches allowlisted feeds only).
- The README still describes Vercel and "Phase 1"; `.env.example` is now the accurate list.
