# Calendar (V4) - Progress

**Branch:** `feat/calendar-v2` (stacked on `feat/billing-v2`, which is stacked on `feat/outreach-v2`)
**Plan:** `research/build-plan-calendar.md`; Stage 1 scope from `research/build-plan-combined.md` §4.
**Rewritten:** 2026-11-11 from `git log` and the code. The earlier version listed "prepared" architecture and no code existed.

## Stage 1 (built): the free plan-slot calendar

Stage 1 is the free "This week" screen with rules, progress and a streak. Switch: `LYNKR_CALENDAR=v1|v2` (unset: v2 on a preview, v1 elsewhere). Off means today's screen, unchanged.

### U1 Goal mix rules and the why line
- **Done:** `goalFamily`, `weekMix`, `whyThisWeek`, `applyMix`, `planForPerson` in `lib/plan.ts`; `saveProfileBrief` so saving the profile or the interview keeps `outreach.goals`.
- **Evidence:** `tests/calendar-mix.test.mts` (12): AE1, family order, table within LIMITS, in-progress slots never touched (mutation-checked), the brief-merge regression.
- **Next:** none.

### U2 Plan in the account
- **Done:** `lib/calendar/plan-store.ts` (`week:` and `progress:` keys in `plan_items`, no migration, one key per write, insert-if-absent import, finished weeks frozen), `/api/calendar/plan` (session, no paywall, 401 for key-only), `useCalendar` client sync.
- **Evidence:** `tests/calendar-plan-store.test.mts` (8): AE5, overlapping writes, user scoping, frozen weeks, export and delete (mutation-checked).
- **Next:** try sign-in sync on the Render preview (no database in the browser tests).

### U6 Progress and streak
- **Done:** `lib/calendar/progress.ts`, `components/calendar/Streak.tsx`; progress line on the week screen.
- **Evidence:** `tests/calendar-progress.test.mts` (10): AE4, 70% boundary (mutation-checked), skipped week is not a reset, first week.
- **Next:** none for Stage 1.

### U10 switch
- **Done:** `lib/calendar/flags.ts`, `calendar` in `/api/status`.
- **Evidence:** `tests/calendar-flags.test.mts` (3).
- **Next:** paywall chips and the combined paid list wait for Stage 2 (no gated items yet).

### Screen
- **Done:** why line, "x of y — keep going", streak or a sign-in note on `WeekPlan`; header grammar fixed ("1 comment").
- **Evidence:** `npm run test:e2e:calendar` 22/22 on, `LYNKR_EXPECT=v1` 6/6 off, at 1280 and 375 px, axe clean. v1 regression 27/27 and 5/5, Outreach e2e 20/20 and a11y 24/24, interview v2 36/36 and 9/9. `npm test` 510/510.
- **Next:** none.

## Not built (Stage 2 and later)

- U3 feed and source adapters (posts, outreach steps, comments), U4 moves and undo, U5 month and week grid with drag, U7 chat moves, U8 Today slice, U9 reminders rework, U11 release.
- Paywall chips on gated items: nothing is gated until posts, outreach and comments feed the calendar.
- "Mark done" is the existing control (Schedule, then Mark sent or Mark posted).
- Stage 2 waits on Posts U2/U9, Outreach U16 (built), Commenter U4b.

## Decided by the lead (reversible)

- Stage 1 puts the new elements on the existing "This week" screen rather than building the grid, so free users get rules, progress and the streak now and the grid arrives with the sources.
- A person without an account gets progress but no streak (the browser keeps one week); the screen says how to get one.
- The streak counts back from the last finished week with a plan; a week with no plan is skipped, not a reset (R19).
- Existing browser plans are recalculated once on first load under v2 (they were built with the old default counts). A week the person changed is never recalculated.
