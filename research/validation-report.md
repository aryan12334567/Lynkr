# Validation report: weekly plan + calendar

Date: 2026-10-16. Demo mode (no AI key). Tests are defined in `acceptance-tests.md`.

## How it was run
- Unit: `npm test` (node test runner, `tests/plan.test.mts`).
- Browser: `npm run test:e2e` (`tests/e2e-plan.mjs`, Playwright driving installed Chrome headless, fresh profile, IST time zone) against `next dev` on :3000. It goes through setup and the interview (skipping question 5) before testing the plan.
- Build: `npx tsc --noEmit`, `npx eslint .`, `npx next build`.
- Test "today" for the run was Fri 2026-10-16 IST, so the plan week was Mon 19 Oct (rule: Thu–Sun plans next week).

## Results
| ID | Result | Evidence |
|---|---|---|
| P1 | Pass | 3 messages, 2 comments, 1 post, all Mon–Fri of the plan week |
| P2 | Pass | Mon/Wed → this Monday; Thu/Fri/Sun → next Monday |
| P3 | Pass | Post tags proof/setback/observation; messages alternate referral / hiring manager |
| P4 | Pass | Scheduled item kept its status after counts changed |
| P5 | Pass | All parser cases, including "2 more posts" (+2) and an unrelated request (no change) |
| P6 | Pass | "20 posts" capped at 5 with a note; "-3 messages" and "no messages" → 0 |
| P7 | Pass | Due at 5 days, not at 4, not after a reply; follow-up added once |
| P8 | Pass | 09:00 IST on 19 Oct → `DTSTART:20261019T033000Z`; escaping and 75-octet folding |
| P9 | Pass | Google link `dates=20261019T033000Z/20261019T034500Z` |
| P10 | Pass | "Week of Mon, 19 Oct: 3 messages, 2 comments, 1 post"; 6 items, all Draft (`docs/plan-week.png`) |
| P11 | Pass | Schedule → Scheduled → Sent → Back to draft |
| P12 | Pass | Referral request moved to Fri 15:45, still there after reload |
| P13 | Pass | "2 posts, no comments" → 3 messages, 0 comments, 2 posts, with a reply line |
| P14 | Pass | October 2026 grid with 5 chips (`docs/plan-month.png`) |
| P15 | Pass | Week .ics has 5 events (5 open items); item .ics has 1; Google link correct |
| P16 | Pass | Sent message shows "Got a reply" |
| P17 | Pass | 0 px horizontal overflow at 390 px (`docs/plan-phone.png`) |
| P18 | Pass | Plan removed from localStorage by "Clear everything" |
| P19 | Pass | tsc, eslint, next build clean; setup → interview → results flow still works (exercised by the e2e run) |
| console | Pass | No page errors or console errors in the e2e run |

## Problems found and fixed during validation
- Test bugs, not app bugs: a lazily re-resolved locator pointed at the wrong card after a click; ".ics" and "Week" matched longer names by substring. Fixed with `data-item` ids and exact names.
- "Update plan" button wrapped onto two lines on desktop. Fixed.
- Empty chat text returned "write a shorter request". Message corrected.
- The chat parser would have double-counted "2 more posts". Fixed before the tests ran; covered by P5.

## Not tested
- Real AI path for "adjust by chat" (no key; the route is wired and validated with the same schema pattern as the other routes).
- Browser notifications firing at the scheduled time (needs a real wait and a permission grant; logic is a 30-second check of Scheduled items).
- Importing the .ics into Google Calendar or Outlook by hand.
- Mobile: the active "This week" tab can sit off-screen in the scrolling tab row on narrow phones; usable, not polished.

# Validation report: ask ladder

Date: 2026-10-16. Demo mode. Tests in `acceptance-tests.md` (L1–L7).

| ID | Result | Evidence |
|---|---|---|
| L1 | Pass | Demo output validates; removing `outreach.stranger` fails the schema |
| L2 | Pass | Stranger draft (blanks filled) "Ready to send" as a stranger message, no "refer", ≤ 70 words |
| L3 | Pass | Alumni draft mentions a 15-minute call, no referral ask, "Ready to send", ≤ 80 words |
| L4 | Pass | Referral draft "Ready to send" for someone who knows you; the same draft to a stranger gets "Don't send yet" |
| L5 | Pass | Picker shows "First message to a stranger" / "Message to someone from your college" / "Referral request"; follow-up always shown (`docs/ladder.png`) |
| L6 | Pass | A saved result without the new drafts shows "Rewrite drafts" instead of crashing |
| L7 | Pass | tsc, eslint, 13 unit tests, 12 browser checks (`npm run test:e2e`), next build |

Not tested: the AI path for the two new drafts (no key). The prompt rules mirror the checker's rules, so a real-key run should be checked against L2–L4 once a key exists.

# Validation report: Connect Coach

Date: 2026-10-16. Demo mode. Tests in `acceptance-tests.md` (C1–C13).

| ID | Result | Evidence |
|---|---|---|
| C1 | Pass | 6 demo cards; all LinkedIn people-search links; "Rahul Sharma" typed in the who-to-reach answer appears in no card; company name kept |
| C2 | Pass | Default 3; two noted sends this IST month → 1 left; last month's and note-less sends not counted; floor at 0 |
| C3 | Pass | Cap reached at 5 people this IST week; last week's not counted |
| C4 | Pass | to_find → sent → accepted → messaged → replied and back; follow-up due at 5 days, not 4, not after reply; going back un-sends |
| C5 | Pass | Demo note ≤ 200 characters, starts "Hi [[", no referral or job ask |
| C6 | Pass | png/jpeg/webp accepted; gif and > 4 MB rejected with clear messages |
| C7 | Pass | 6 cards, each with a LinkedIn people-search link |
| C8 | Pass | Copy locked until blanks filled; 120 / 200 characters (`docs/connect.png`) |
| C9 | Pass | Screenshot upload in demo mode shows "needs an AI key" |
| C10 | Pass | To find → Sent lowers notes left 3 → 2 → Accepted shows the stranger-rung hint; survives reload |
| C11 | Pass | Cap set to 1 with one person this week: Add disabled, cap message shown |
| C12 | Pass | "Clear everything" removes people; 0 px overflow at 390 px |
| C13 | Pass | tsc, eslint, 19 unit tests, 18 browser checks, next build |

## Fixed during validation
- Demo mode showed raw `[[...]]` markers for "who they are" and "worth mentioning"; now says plainly that demo mode doesn't read profiles.
- Number inputs stretched full width; now narrow.
- The "places you named" search used the whole sentence; now role plus up to two named places or companies.
- The browser console check now ignores only the deliberate 422 from C9.

## Not tested
- The AI path: note writing from pasted text or a screenshot, and the who-to-look-for cards from the model (no key). The prompt forbids naming people, but only the demo path is verified to never name anyone.
- Notes that exceed 200 characters after a real AI reply (the UI blocks copying them; not exercised).

# Phase 4 (quality) progress

Date: 2026-10-16. Build plan `research/build-plan.md`, Phase 4.

| Task | Status | Evidence |
|---|---|---|
| 1. Unit tests: checker, slots, specificity, limits, schemas | Done | `tests/core.test.mts` (6 tests); checker determinism checked over 10 runs; every AI prompt keeps the "data, not instructions" rule. 26 unit tests in total. |
| 2. End-to-end tests | Done in demo mode | `npm run test:e2e`: 18 flow checks + 5 accessibility/phone checks. Real-key run blocked (no API key). |
| 3. Draft evaluation, 5 profiles | **Blocked** | Needs an AI key. Demo drafts are templates, so evaluating them would prove nothing. |
| 4. Accessibility | Done | Keyboard-only setup and interview (Tab + Enter); visible 2 px focus outline on every control; every input, textarea and select labelled on all 7 tabs; text and button colours ≥ 4.5:1 in light and dark (`tests/contrast.test.mts`). |
| 5. Mobile at 375 px | Done | No horizontal scroll on any tab; the active tab scrolls into view. |
| 6. Browsers | Partly | Chrome and Edge pass both suites. Firefox and Safari aren't installed here: typing fallback untested there. Voice input untested everywhere (no microphone in automation). |

Fixed in this pass:
- `faint` text failed contrast in both themes (3.0–4.2:1) and `warn` was 4.46:1 on muted; darkened/lightened tokens.
- Primary buttons had white text on the dark-mode accent (≈ 2.9:1); now use the background colour.
- Text inputs suppressed the focus outline (`focus:outline-none` with a 20% ring); removed so they get the shared 2 px outline.
- On phones the active tab could sit off-screen; clicking a tab now scrolls it into view.
- Note: a stale dev-server CSS cache hid the focus fix at first; the loose "outline isn't none" check passed on Chrome's default ring. The check now requires the real `solid 2px` outline.

# Phase 5 (hardening) progress

Date: 2026-10-16. Build plan `research/build-plan.md`, Phase 5.

| Task | Status | Evidence |
|---|---|---|
| 1. Rate limits | Done | Server pointed at a local fake AI with `LYNKR_DAILY_CAP=3`: requests 1–3 returned 200, request 4 returned 429 "This free demo has reached its daily limit." Per-visitor hourly cap unit-tested (7th generate call refused, other visitors unaffected). |
| 2. Spend check | **Blocked** | Needs an AI key and a provider spend cap. |
| 3. Fresh clone runs from the README | Done | Cloned the private repo, `npm ci`, `npm run build`, `npm test` (26 pass), `next start` → home 200, `/api/status` demo mode. |
| 4. Demo script | Done | `research/demo-script.md`, 3 minutes, fictional test profile. |
| 5. Privacy copy vs spec step 9 | Done | Footer said answers "are sent to the AI" even in demo mode, where nothing reaches an AI. Now matches the mode, and names everything kept in the browser (vault, plan, tracker). Server code logs nothing (no `console` calls in `app/` or `lib/`). |

Also hardened (from the plan's security rules):
- Request bodies are size-capped before parsing (`lib/http.ts`): 32 KB interview, 64 KB generate, 4 KB plan, 6 MB connect. Oversize → 413, malformed JSON → 400. Checked with curl.

Known limit, not fixed:
- Per-visitor limits key on `x-forwarded-for`, which a client can set unless a hosting proxy overwrites it. The daily cap and the provider's spend limit are the real protection. Recheck on whatever host Lynkr is deployed to.
