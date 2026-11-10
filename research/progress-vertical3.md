# Vertical 3 (Outreach) - Progress

**Branch:** `feat/outreach-v2` (cut from `feat/combined-build`)
**Plan:** `research/build-plan-outreach.md` (U0-U20, A4 timeline units U14-U20)
**Rewritten:** 2026-11-05 from `git log` (CO-3). Earlier versions of this file were stale.
**State:** every unit is committed and verified in demo mode. Not merged. Production is untouched.

Three lines per unit: done, evidence, next. Commit hashes are on `feat/outreach-v2`.

## Units

### U0 Extension feasibility spike
- **Done:** MV3 spike (insert, side panel, pairing), `tests/fixtures/linkedin-like.html`. Folded into U10.
- **Evidence:** `npm run test:ext` 16/16 against the fixture page only.
- **Next:** A6, the 6-step check on real LinkedIn, is Aryan's.

### U1 Data model, migration 002, account storage
- **Done:** `002_outreach.sql`, `lib/outreach/contacts-db.ts`, contacts route, export, delete, cleanup.
- **Evidence:** `tests/outreach-db.test.mts` (PGlite): user scoping, double migration, URL rules.
- **Next:** run 002 and 005 on the preview database, then production (A7).

### U2 Goals, goal details, playbooks (`e196c6f`)
- **Done:** 10 goals x 3 relationships, goal details, interview defaults, `goals-db.ts` split from `goals.ts`.
- **Evidence:** `tests/outreach-goals.test.mts`; table test over all pairs.
- **Next:** none.

### U3 Draft engine v2 (`2ded17e`, fixes in `5fbc21f`)
- **Done:** playbook, evidence pack, trace guard, composer, note-vs-blank advice, `lib/facts.ts`, daily cap.
- **Evidence:** `tests/outreach-draft.test.mts`; U12 eval 0 untraced claims in 9,996 drafts.
- **Next:** wording is generic (model-scored 3.2 / 2.5 of 5): re-score by a person and from tester ratings.

### U4 Recipient brief (`b960e86`, fixes in `5fbc21f`)
- **Done:** search provider with exclusions and caps, confirm, extract, bridge, sensitive and planted-text filters.
- **Evidence:** `tests/outreach-brief.test.mts`; U12 injection and sensitive fixtures 0 failures.
- **Next:** live Exa run needs `EXA_API_KEY` on the preview.

### U5 Connections import and ranking (`7641433`)
- **Done:** in-browser parse of Connections.csv or the ZIP, ranking, IndexedDB, Add sends only name, company, role, URL.
- **Evidence:** `tests/outreach-connections.test.mts`; browser e2e O2: rows listed, 0 requests carry file data.
- **Next:** R39 "connected since" date still needs a check (lost in import).

### U6 Finder and company signals (`b49c933`)
- **Done:** LAMP ranking, search-link builders, directories, news-feed allowlist, signals route.
- **Evidence:** `tests/outreach-finder.test.mts`.
- **Next:** none.

### U7 Workspace screens (`aa63038`, demo fixes in `1417b04`)
- **Done:** goals, people board, person card, brief, drafts, connections, extension connect; tabs by switch.
- **Evidence:** `tests/outreach-ui.test.mts`; browser e2e 20/20 at 1280 and 375 px.
- **Next:** adding a real contact in a browser needs storage: check it on the Render preview (see handoff).

### U8 Follow-up and learning
- **Done:** superseded by U15 and U20.
- **Evidence:** n/a.
- **Next:** none.

### U9 Extension API (`b4f41f0`)
- **Done:** pair, revoke, contacts, draft, outcome routes; hashed tokens; CORS pinned to `LYNKR_EXT_ID`.
- **Evidence:** `tests/ext-api.test.mts`.
- **Next:** set `LYNKR_EXT_ID` once the extension has a fixed ID.

### U10 Chrome extension (`2f93008`, selected text in `b5ec7e4`, zip in `3207253`)
- **Done:** side panel, context menu, insert with copy fallback; `npm run ext:zip`; `LYNKR_EXT_EXTRA_ORIGINS` for tester builds.
- **Evidence:** manifest has no LinkedIn host permission and no content scripts; `test:ext` 16/16.
- **Next:** Chrome Web Store account deferred; testers install the zip unpacked.

### U11 Legal, listing and tester copy (`4ca6098`)
- **Done:** v2 privacy draft, `extension/store/listing.md`, tester brief, copy-change list.
- **Evidence:** drafts only; nothing published.
- **Next:** A5, Aryan approves them.

### U12 Evaluation and safety (`5fbc21f`)
- **Done:** four failures fixed in U3/U4; 20 samples regenerated and model-scored; report rewritten.
- **Evidence:** `npm run eval:outreach` 0 failures; evaluation tests 28/28.
- **Next:** one live-model run with `OPENAI_API_KEY` before testers see drafts.

### U13 Release (`1417b04`, `3207253`)
- **Done:** browser e2e (20/20) and a11y (24/24) at both widths; extension zip; `lynkr-preview` service in `render.yaml`; env docs.
- **Evidence:** `npm test` 464/464; `tsc` clean; `npm run build` ok; interview v2 e2e 36/36 and 9/9; v1 regression 27/27 and 5/5; eval 0 failures.
- **Next:** PR is open; Aryan's go-live list A1-A7 is in the PR and `research/handoff.md`.

### U14 Timeline data, migration 005 (`9056b4d`)
- **Done:** `outreach_events`, `transaction()`, `recordEvent`, summary rewrite.
- **Evidence:** `tests/outreach-timeline.test.mts`.
- **Next:** none.

### U15 Next-step rules (`aad008a`)
- **Done:** question-first rules, superseding, R43 table, meeting and goal-reached rates.
- **Evidence:** `tests/outreach-followup.test.mts` (21 tests; AE9, AE12).
- **Next:** none. On Windows this file can crash Node ("jit_page") inside the full run; it passes alone.

### U16 Timeline, calendar and to-do routes (`de7b4bf`)
- **Done:** timeline, calendar feed, Monday to-do; reads stay open for lapsed users.
- **Evidence:** `tests/outreach-timeline-routes.test.mts` (AE10, AE11).
- **Next:** none.

### U17 Person card timeline and meeting card (`aa63038`)
- **Done:** timeline, meeting card, record taps, states.
- **Evidence:** `tests/outreach-ui.test.mts`.
- **Next:** none.

### U18 Timeline drafts (`fff1e90`)
- **Done:** thank-you, follow-up, reschedule, check-in, referral steps; notes stay behind `LYNKR_OUTREACH_NOTES_IN_DRAFTS`.
- **Evidence:** `tests/outreach-draft.test.mts`; eval timeline intents 0 failures.
- **Next:** none.

### U19 Extension outcome taps (`2f93008`)
- **Done:** meeting, goal reached and close taps through `recordEvent`.
- **Evidence:** `tests/ext-api.test.mts`.
- **Next:** none.

### U20 Today, Monday to-do, weekly plan gate (`b435048`)
- **Done:** outreach items in Today, v2 gate on the old follow-ups.
- **Evidence:** `tests/plan.test.mts`; browser e2e O6.
- **Next:** none.

## Decided by the lead (reversible)

- **Example person without an account (R37):** goals confirm for the visit when storage answers 401/409/503, and the example's drafts come from the offline composer through the draft route. No model, database or user data is involved. Other contacts still need the license and account checks.
- **Preview service:** free plan, paywall off (`LYNKR_PAYWALL=0`), Dodo test mode, `VERCEL_ENV=preview` so `DATABASE_URL` is ignored and only `LYNKR_DATABASE_URL` is used.
- **Browser e2e scope:** no database is available locally, so the browser journey uses the example person. Adding a real contact and recording steps are covered by PGlite route tests and must be tried on the preview.
- **Regression counts:** the plan says 31 for the v1 e2e suite; it has 27 checks in `tests/e2e.mjs`, unchanged by this work.
