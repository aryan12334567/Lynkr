# Commenter - Progress

**Branch:** `feat/commenter-v2` (stacked on `feat/calendar-v2`). **Plan:** `research/build-plan-commenter.md`. Switch: `LYNKR_COMMENTER=on|off` (unset: on for a preview, off elsewhere).

## Slice 1 (built, demo mode only)

- **U2 selection split** - `lib/comment/parse.ts`. Line rules (name, headline, time marker; repost, company, promoted; see-more, short, long). Tests: `tests/comment-parse.test.mts` (13). Parser is primary; no model split. **Unproven on real LinkedIn text** until A6 captures.
- **U3 comment core** - `lib/comment/{checks,prompt,mock,write,goal}.ts`. Nine per-option checks, one per angle, one retry, no-input skip with no model call, flagged sentences. Tests: `tests/comment-core.test.mts` (26), mutation-checked (leak, openers, ask).
- **U4a route** - `app/api/ext/comment/route.ts`, `/api/status` reports `commenter`. 402 on lapse, 10 a day, public-safe facts only (`factsFor("comment")` plus target companies and private-search role excluded), nothing stored or logged. Tests: `tests/comment-route.test.mts` (12), mutation-checked (cap, avoid list, switch).
- **U5 extension** - chooser, one-time consent, comment view, Insert only on `https://www.linkedin.com/`, menu limited by `documentUrlPatterns`, no silent 3,000 cut. Tests: `tests/ext-comment.test.mjs` (19) plus `tests/ext-extension.test.mjs` (16), axe clean on the options view, mutation-checked (URL checks, menu pattern).
- Unit suite: 543 tests; the two failures in the full run (`ext-api`, `vault-db`) pass alone (known Windows Node crash).

## Slice 2 (built, tests only; migration 004 not applied anywhere)

- **U1 log** - `scripts/migrations/004_comments.sql`, `lib/comment/log.ts`, `comment_log` in export and Delete my data, retention in the daily cleanup (unposted 7 days, all 12 months). Tests: `tests/comment-log.test.mts` (11), mutation-checked (ownership, receipt user, retention).
- **U4b receipts and routes** - `lib/comment/receipt.ts` (HMAC; key from `COMMENT_RECEIPT_SECRET`, else derived from `BETTER_AUTH_SECRET`, so no new variable), `/api/ext/comment-log` (POST, PATCH), `/api/comments` (GET, POST, PATCH, DELETE; GET and DELETE stay open after a lapse). Ids travel in the body, not the path.
- **U6 web** - `/api/comment/options`, `components/CommentOptions.tsx` (options, goal, reaction, Copy logs, Posted, "Comments you've written" with Undo delete). Shown only to a signed-in person when the switch is on; key-only and signed-out people keep the old helper. The shared generation is `lib/comment/serve.ts`.
- **U7 week and Outreach** - `commentsDone` in `lib/plan.ts` wired into the calendar hook; `lib/comment/link.ts`, `/api/comments/link`, `components/outreach/CommentBridge.tsx`; a confirmed link adds one line to the draft evidence (date and the person's own comment, never the author's headline). Tests: `tests/comment-link.test.mts` (6), mutation-checked.
- Extension: logs each Insert or Copy through its receipt and shows Posted / Not posted. 36 extension tests.
- Whole suite 578/578, build clean, calendar e2e 22/22, Outreach e2e 20/20.

## Not built / not verified

- **U0b real-LinkedIn check (A6, Aryan):** gestures, `execCommand` in the real comment editor, panel Insert after scrolling. A dev-only "Capture selection as fixture" button exists in unpacked builds.
- **U8 copy:** the consent text, panel strings and privacy lines are drafts in code; none approved (A3). Privacy page, store listing and paywall line not touched.
- **U9a live-model eval and reader test:** needs `OPENAI_API_KEY` and raters. Quality of real options is unmeasured; demo options are templates.
- **Migration 004 is not applied** on the preview database. Until it is, the log, week count and link routes answer empty.
- **Slice 2 UI browser-tested 2026-11-13 on the preview (signed in, live model, migration 004 applied):** options helper (author parsed from the pasted header, goal radios, reaction box), Copy shows "Did you post it?", Posted logs the entry ("Marked as posted. It counts toward your week."), "Comments you've written" lists it with Delete, adding a person named like the author shows "Is this the ... you commented on" and Link stores it ("You commented on their post on 13 Nov. Unlink"). Not seen: the one-line bridge in a drafted message, and the week count (the test comment fell on a Friday, so the plan starts next Monday and correctly did not count it). Findings: a live generation took about 40 seconds; "Why this works" reads "Anchor: ..." (prompt wording leaks); the "Add a point" option was mostly flagged lines.
- **U9b release checklist (A4) and the DPDP basis for keeping authors' names (D-C8)** are Aryan's.
- Changed from the plan: ids in request bodies instead of `[id]` routes; the web helper uses a new route, `/api/comment/options`, and `/api/comment` is unchanged.
- `app/api/comment` (web helper) is unchanged.

## Decided by the lead (reversible)

- Rule parser is primary (no model split), so no author can be invented; no header means "Author not detected, Add".
- The no-input skip and refused selections spend no daily generation.
- Goal default: networker gives visibility; everyone else job seeker; freelancer by hand only.
