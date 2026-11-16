# Final audit report (end-to-end check and improvement run)

Started 2026-11-16. Checkpointed after each dimension. Three states are kept apart everywhere: **run** (verified by running it), **demo** (verified in demo mode only), **not verified**.

## Status (five lines, kept current)

1. **Done:** Calendar Stage 2 with its code review and follow-ups (`f20a48c`, pushed); Commenter speed and "Add a point" changes (unit-tested, not re-timed live); Google and LinkedIn sign-in on the preview.
2. **In progress:** dimension 1, draft quality (prompts, checkers, eval hard cases).
3. **Blocked (Aryan):** merges #17 to #20 and the Interview LinkedIn branch; production variables and migrations; live Dodo; Posts (LinkedIn API terms answer); copy approvals; real-LinkedIn check (A6).
4. **Branch and commit:** `feat/calendar-stage2-v2` at `f20a48c` (top of the stack: holds Outreach, Billing, Calendar, Commenter).
5. **Next command:** `node --no-warnings --import ./tests/register.mjs --test tests/<file>.test.mts` per changed area; the full `npm test` was stopped by low machine memory on 2026-11-16 and is **not verified** since `c51a4e6`.

## Decided by the lead (reversible)

- Audit commits go on `feat/calendar-stage2-v2`, the top of the stack, because it is the only branch that holds every part. Splitting fixes back onto each stacked branch would mean rebasing four open PRs; not worth the risk. Each commit names the part it touches.
- The Render preview is not redeployed during the run unless a live measurement needs it (manual deploy only).

## Dimensions

(filled as each one closes; the table is in `research/improvement-scoreboard.md`)
