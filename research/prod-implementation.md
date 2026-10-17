# Prod plans: what was built (17 October 2026)

Source plans: `prod/lynkr-message-checker-outreach-build-plan.md`, `prod/lynkr-outreach-intelligence-plan.md`, `prod/lynkr-profile-fix-intelligence-plan.md`, `prod/lynkr-posts-comments-intelligence-execution-plan.md`. Everything below runs in demo mode with no AI key. The AI paths are wired, but they have **not** been run against a real provider.

## Built

| Plan | Item | Where |
|---|---|---|
| Posts §3.1 | Content profile: function domain (suggested from the role text only, user can change it), stage, up to two readers, optional specialisation, industry, market and "keep private" | `components/Setup.tsx`, `lib/roles.ts`, `ProfileInput` |
| Posts §3.1 | Evidence-first interview: 7 areas, at most 2 follow-ups, "not measured" accepted, optional questions say so | `lib/mock.ts`, `INTERVIEW_SYSTEM` |
| Posts §3.1, §4.2 | Two-step drafting: `/api/vault` returns candidate facts with source answers; the user confirms, edits, excludes or removes each; `/api/generate` gets confirmed facts only | `app/api/vault`, `components/VaultReview.tsx`, `lib/store.ts` |
| Posts §4.1 | Full-text draft editing with reset; edits saved locally; copy locked while an edit has a `[[blank]]`; stale-edit notice after a rewrite | `components/DraftCard.tsx` |
| Posts §3.3, §4.3 | Comment on a post you found: text only, up to 3 facts, own thought, skip when there's nothing real; server checks anchor, fact ids, 30–70 words, no blanks; one retry then skip; excerpt never stored | `app/api/comment`, `lib/comment.ts`, `components/CommentHelper.tsx` |
| Posts §3.2 | Post prompts: reader, first-hand detail, useful point, optional close; angles with no supporting fact stay blank and say so | `GENERATE_SYSTEM`, `mockGenerate` |
| Checker §6 | Contact decision before wording (good / need detail / other route / hold) | `lib/packet.ts` |
| Checker §6 | Checks by channel (note in characters, messages in words, configurable); referral rules only for a real referral ask; greeting and easy out are advice; exact spans; one-click smallest edits; unsupported numbers and unconfirmed shared history flagged; new verdict wording | `lib/checker.ts`, `components/Checker.tsx` |
| Checker §5, Outreach §4 | Relevance packet shared by Connect and the checker; at most two picked facts sent, never the whole vault | `components/ConnectCoach.tsx`, `ConnectRequest` |
| Checker Phase 4 | Optional AI review (opt-in, data notice, demo says unavailable) | `app/api/review` |
| Outreach §5 | Search cards: known people first (1st-connection search), shared link, role-pattern public-work cards, company-only marked weak; editable keywords; other user-run routes | `lib/connect.ts` `lookFor` |
| Outreach §6 | Note output contract: fitStatus, why relevant, fact refs; missing anchor returns a question, not praise | `ConnectReply`, `composeNote` |
| Outreach §7, Checker Phase 3 | Tracker funnel: considered, invited, accepted, messaged, replied (email skips invitation); outcomes; mature cohorts (14 / 7 days); counts below 5; "where is it stuck" advice | `lib/connect.ts`, tracker UI |
| Profile §5, §8 | Structured findings per section with status, evidence, confidence and action; top 3 "Fix first"; photo and visibility are manual, technical-only checklists | `lib/profileAudit.ts`, `components/ProfileFix.tsx` |
| Profile §6 | Versioned role pack with sources and check date (hand-curated, not mapped code by code) | `lib/roles.ts` |
| Profile §4 | LinkedIn export import in the browser: allowlisted profile files only, personal columns dropped, preview and untick, never saved | `lib/linkedinExport.ts` |
| Profile §6 | Optional job description: skill gaps shown as learning goals, not profile edits | `jdTerms` |

Saves from older versions migrate: old vault items become confirmed facts, tracker statuses map to the new stages.

## Not built, and why

- Every plan's Phase 0 user interviews and the pilots: these need real people.
- Real-AI quality evaluation: blocked on a capped provider key.
- Curated reference profiles (profile plan Phase 3): need written permission from real practitioners.
- Photo analysis: deliberately left as a manual technical checklist.
- Any shared database, scraping, connections import or automation: out of scope in every plan.

## Tests

`npm test`: 43 unit tests. `npm run test:e2e`: 27 flow checks and 5 accessibility checks, Chrome, demo mode.
