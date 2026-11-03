# Vertical 3 (Outreach) - Progress

**Branch:** `feat/combined-build`  
**Started:** 2026-10-30  
**Plan:** `research/build-plan-combined.md` §4 (Wave 0 Housekeeping)  
**Lead:** Claude Code session 2026-10-30  

---

## Status Overview

**Wave 0 (Housekeeping):**
- V3 Outreach code staged and prepared for commit on `feat/combined-build` — FULLY COMPLETED
- `research/progress-vertical3.md` updated — FULLY COMPLETED
- Preview database check for stray migrations completed (`003_posts.sql` verified and noted for removal per D-X2) — FULLY COMPLETED

---

## Unit Progress

### Housekeeping (Wave 0)
- **Status:** FULLY COMPLETED
- **Evidence:**
  - Prepared explicit file selection for V3 Outreach (`app/api/ext/`, `app/api/outreach/`, `components/outreach/`, `extension/`, `lib/outreach/`, `scripts/migrations/002_outreach.sql`, tests, and V3 updates to tracked files).
  - Excluded stray `scripts/migrations/003_posts.sql` per D-X2.
  - Preview database inspection confirms readiness for Wave 1 execution.
- **Next:** Committing Wave 0 housekeeping changes and initiating Wave 1 part plans (Interview U10–U16, Outreach U0–U13, Posts U0–U16, Calendar Stage 1, and Billing B2–B8).

> 2026-11-03: Outreach work moved to branch `feat/outreach-v2`. U0–U11 and U14–U20 are committed there (see `git log`). This file is rewritten in full from the committed code in U13 (CO-3); until then, the entries below are the current ones.

### U12 Evaluation and safety
- **Done:** the four 2026-11-02 eval failures fixed in U3/U4 (`split()` after closing quotes; quoted spans stripped before the DID check; `looksPlanted` and `cleanEvidenceText` on every evidence path, composer quotes only a short plain span; sensitive filter by category with whole-item drop), plus the missing greeting on fully trimmed notes; 20 samples regenerated and model-scored (3.2 / 2.5); `research/eval-vertical3.md` rewritten to match.
- **Evidence:** `npm run eval:outreach` 0 failures in 9,996 demo drafts, 0 injection and 0 sensitive failures; `tests/outreach-evaluation.test.mts` 28/28; `npm test` 464/464; `npx tsc --noEmit` clean. Live-model run not done (needs A2).
- **Next:** U13 release (e2e at 1280/375 px, a11y, v1 and interview v2 regression, extension build and zip, Render preview, PR with the A1–A7 go-live list).
