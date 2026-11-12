# Commenter - Progress

**Branch:** `feat/commenter-v2` (stacked on `feat/calendar-v2`). **Plan:** `research/build-plan-commenter.md`. Switch: `LYNKR_COMMENTER=on|off` (unset: on for a preview, off elsewhere).

## Slice 1 (built, demo mode only)

- **U2 selection split** - `lib/comment/parse.ts`. Line rules (name, headline, time marker; repost, company, promoted; see-more, short, long). Tests: `tests/comment-parse.test.mts` (13). Parser is primary; no model split. **Unproven on real LinkedIn text** until A6 captures.
- **U3 comment core** - `lib/comment/{checks,prompt,mock,write,goal}.ts`. Nine per-option checks, one per angle, one retry, no-input skip with no model call, flagged sentences. Tests: `tests/comment-core.test.mts` (26), mutation-checked (leak, openers, ask).
- **U4a route** - `app/api/ext/comment/route.ts`, `/api/status` reports `commenter`. 402 on lapse, 10 a day, public-safe facts only (`factsFor("comment")` plus target companies and private-search role excluded), nothing stored or logged. Tests: `tests/comment-route.test.mts` (12), mutation-checked (cap, avoid list, switch).
- **U5 extension** - chooser, one-time consent, comment view, Insert only on `https://www.linkedin.com/`, menu limited by `documentUrlPatterns`, no silent 3,000 cut. Tests: `tests/ext-comment.test.mjs` (19) plus `tests/ext-extension.test.mjs` (16), axe clean on the options view, mutation-checked (URL checks, menu pattern).
- Unit suite: 543 tests; the two failures in the full run (`ext-api`, `vault-db`) pass alone (known Windows Node crash).

## Not built / not verified

- **U0b real-LinkedIn check (A6, Aryan):** gestures, `execCommand` in the real comment editor, panel Insert after scrolling. A dev-only "Capture selection as fixture" button exists in unpacked builds.
- **U8 copy:** the consent text, panel strings and privacy lines are drafts in code; none approved (A3). Privacy page, store listing and paywall line not touched.
- **U9a live-model eval and reader test:** needs `OPENAI_API_KEY` and raters. Quality of real options is unmeasured; demo options are templates.
- **Slice 2 (U1 log table and migration 004, U4b receipts, U6 web fallback, U7 week and Outreach links, U9b release):** not started. Starts after Slice 1 tester gates.
- `app/api/comment` (web helper) is unchanged.

## Decided by the lead (reversible)

- Rule parser is primary (no model split), so no author can be invented; no header means "Author not detected, Add".
- The no-input skip and refused selections spend no daily generation.
- Goal default: networker gives visibility; everyone else job seeker; freelancer by hand only.
