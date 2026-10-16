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
