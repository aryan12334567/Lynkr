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

## Stage 2 (built 2026-11-13, branch `feat/calendar-stage2-v2`, stacked on `feat/commenter-v2`)

Switch: the same `LYNKR_CALENDAR=v2`. A signed-in person gets the feed screens; signed-out, key-only and v1 keep today's screens, unchanged. When the feed cannot be had (no database, 404, 401), `CalendarView` renders today's grid as its fallback.

### U3 Calendar feed
- **Done:** `lib/calendar/{types,sources,feed,load,server}.ts`, `GET /api/calendar?from&to`. Plan slots, outreach steps and comment counts become one `FeedItem` list; outreach steps fill message slots by day (R9, AE2); a meeting is always an extra; comment slots are marked done from the posted count (current week only); a failed or off source is named in `sources`; the window is clamped (1 month back, 5 ahead); a missing current or next week is made once from the mix rules.
- **Evidence:** `tests/calendar-feed.test.mts` (10), `tests/calendar-feed-db.test.mts` (6, PGlite). Mutation-checked: slot fill, comment order, week creation, comment count, user scoping.
- **Next:** Posts adapter (see Not built).

### U4 Moves and undo
- **Done:** `lib/calendar/move.ts`, `POST /api/calendar/move`, `lib/outreach/move.ts` (the outreach PATCH now calls it). A plan slot keeps its time, records its old place in `moves`, and stays in its own week; an outreach step goes through its owner's supersede; a post goes through a Posts seam (404 until Posts exists). One op id moves once; undo is the reverse move with a new op id. The route asks `requireLicense` for post and outreach moves (402); plan moves need only a session.
- **Evidence:** `tests/calendar-move.test.mts` (8): AE3 with a stubbed Posts owner, op idempotency, undo, refusals, ownership, 402 with nothing changed, overlapping writes. Mutation-checked: time kept, op replay, paywall.
- **Next:** wire the real Posts reschedule when Posts lands.

### U5 Calendar screens
- **Done:** `components/calendar/{CalendarView,ItemChip,ChangeDate,UndoBar,grids,useFeed}`, `lib/calendar/grid.ts`. Week grid, month grid (3 chips, "+N more"), phone day list with a week strip, chips with type, time, status words and goal, Change date dialog, desktop drag and drop (valid days marked, past days refused), Undo bar, source notices, paywall card for gated items, loading and empty states. `WeekPlan` takes a grid slot.
- **Evidence:** `tests/calendar-grid.test.mts` (7); `tests/e2e-calendar-feed.mjs` (stubbed feed and move routes; `npm run test:e2e:calendar-feed`): paid 1280 23/23, phone 16/16, free 25/25, axe clean at 1280 and 375, no sideways scroll. Stage 1 regression 22/22, v1 6/6.
- **Next:** none.

### U7 Chat moves
- **Done:** `lib/calendar/{chat,chat-move}.ts`, `app/api/plan/route.ts`, schema and prompt. "move Thursday's post to Friday" is parsed (demo) or returned by the model, which sees only each item's weekday and kind; the server matches it to the person's own item and moves it through the same owner code as a drag; the week says "Changed by you". No match: "I couldn't find that item"; several: not guessed. A move reloads the grid and re-reads the account week so a later autosave cannot undo it.
- **Evidence:** `tests/calendar-chat.test.mts` (9): AE6, parser, "publish now" is not a move, no name or id in the prompt, ownership. Mutation-checked: changed-by-user flag, day matching.
- **Next:** live-model check of the move field (needs the key).

### U8 Today
- **Done:** `lib/calendar/today.ts`, `components/Today.tsx`. With v2 and an account: today's open items and overdue ones with how late, the ring from the feed, the plan card names the calculated mix.
- **Evidence:** `tests/calendar-today.test.mts` (4); e2e F23 to F25.
- **Next:** none.

### U9 Reminders
- **Done:** `lib/calendar/reminders.ts`, `CalendarView` buttons. One event per open item of every owner; "publishes itself" for an auto-published post, "reminder" for the rest; no attendee; in-tab reminders fire once for due, scheduled items.
- **Evidence:** `tests/calendar-reminders.test.mts` (4), e2e F26. Mutation-checked.
- **Next:** none.

### Code review fixes (commit `3be215a`, 2026-11-14)
A full review of Stage 2 found nine defects; each was reproduced with a failing test first (`tests/calendar-review.test.mts`, R1 to R13), then fixed:
- Undo of an outreach move targets the replacement step (the move response carries the live item).
- A drag keeps the step's time; a done slot is never replaced by a due step; a replaced item keeps its place, struck through, with where it went.
- The month header names the right month; a move date must be real and inside the Calendar's range; an op id belongs to one slot; the move uses the injected clock; a second concurrent outreach move is refused.
- A move cancels a pending autosave and re-reads the week; a stale whole-week save is refused (409); one request counter makes the feed reload last-answer-wins.
- Evidence: 13 regression tests (3 mutation-checked), browser configs green. Still open and listed under Not built.

### UI rounds after the preview check (commits `a50747d`, `c51a4e6`, 2026-11-16)
Aryan used the preview and said an item looked like it was on two days. The reference was UpLinked's public calendar demo (REA; `research/feature-evidence-calendar.md`): a compact card with a status badge and the title, no link rows per card.
- **One item, one place.** The grids no longer draw replaced items. A moved plan slot carries `movedFrom` (where it started); its chip says "Moved from Thu, 12 Nov" with a **Move back** button that sends the reverse move with the original time; moved back home, the note goes away. (R15 test; e2e F4, F8a, F9b, F9c at 1280 and 375.)
- **Quieter chips.** The `.ics` and Google Calendar links fold into one "Add to calendar" control per open chip. A slot moved several times keeps one ghost in the feed data (R14), though the grids hide it.
- **Preview.** Render does not auto-deploy this branch: after a push press Manual Deploy, "Deploy latest commit". The preview service `lynkr-preview` builds `feat/calendar-stage2-v2`.
- **Not done:** an outreach step moved away has no "Moved from" note or Move back button (only plan slots do).

### Whole-stage verification
`npx tsc --noEmit` clean; `npm test` 638 (the `outreach-timeline` file crashes Node on Windows in a full run and passes alone, 14/14); `npx next build` clean; `npm run lint` 1 error, the old `MondayTodo.tsx` refs one (not from this work). Browser (fresh server per run, `LYNKR_INTERVIEW=v2` needed): paid 1280 29/29, phone 20/20, free 30/30 (with the drag-state checks F13a and F13b); Stage 1 22/22, v1 6/6 as of the review round.

### U10 copy and U11 release (drafts only, nothing published)
- **[VISIBLE] strings in code, not approved:** the paywall card ("<item> is part of the subscription. The Calendar, your week, progress and reminders are free. Drafting posts, comments and outreach messages is ₹499 a month." with "See what's included" and "Not now"); "Download week (.ics)", "Remind me in this tab"; "Sign in to move items by chat."; "I couldn't find that item."; "Nothing planned. Change the plan by chat or add a post."
- **Still to draft for Aryan (B9):** Landing free list line "Your weekly LinkedIn calendar"; the combined paid list in `Paywall.tsx`; the note "Nothing is posted or sent for you" stays until Posts' D-P1.
- **Release steps (Aryan):** deploy the branch to the preview (Render branch `feat/calendar-stage2-v2`), sign in, open "This week", drag and use Change date on a plan slot, try a chat move, check Today. Production: merge after #17 to #20, then `LYNKR_CALENDAR=v2`.

## Not built


- **Posts source:** the feed reports `posts: "off"`; the move route has a `PostsOwner` seam that answers 404 until Posts exists. Post items, their statuses (Failed, Overdue, Check LinkedIn) and the real reschedule are wired when Posts U2 and U9 land.
- **Plan slots stay in their week** when moved (decided below); moving across weeks is not built.
- **Not browser-tested against a real database:** the feed and moves are tested with PGlite and with a stubbed feed in the browser; the signed-in preview run is Aryan's release step.
- "Mark done" is the existing control (Schedule, then Mark sent or Mark posted).
- Stage 2 Posts part waits on Posts U2/U9.

## Decided by the lead (reversible)

- Stage 1 puts the new elements on the existing "This week" screen rather than building the grid, so free users get rules, progress and the streak now and the grid arrives with the sources.
- A person without an account gets progress but no streak (the browser keeps one week); the screen says how to get one.
- The streak counts back from the last finished week with a plan; a week with no plan is skipped, not a reset (R19).
- Existing browser plans are recalculated once on first load under v2 (they were built with the old default counts). A week the person changed is never recalculated.
- Stage 2: plan slots move only inside their own week (a drag to another week is refused with a reason); undo is the reverse move; the paywall card links to the landing page's pricing section until a proper checkout hand-off is chosen.
- Stage 2: free accounts see post, outreach and comment items and can open a plan slot only to the paywall card; they can still move plan slots.
- Stage 2: when the feed shows, the plan-only "Download week" and "Remind me" buttons step aside, so there is one of each, covering every owner.
