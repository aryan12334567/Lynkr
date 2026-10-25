# Progress: Vertical 1, Interview and Story Vault

Branch `feat/interview-v2` from `origin/master` (fe6ba9c). Started 2026-10-24.
Source of truth: `research/build-plan-interview.md` (section 6 decisions are final) and `research/interview-questions-draft.md`.

## Repo state at start
- `git status`: the Vercel CLI's `.gitignore` change (`.vercel`, `.env*`) and two untracked research files. Committed first (138c7f5). `.env.example` stays tracked (an existing `!.env.example` rule).
- `gh pr list`: no open pull requests (PR #6 to #11 are merged). No overlap.
- `C:\OS\lynkr\logo`: seven logo files (SVG and PNG), outside the app. Not touched. No app file references them yet, so no overlap. The tab icon is still the default (build plan gap 13); left for the logo work.

## What exists (checked in code)
| Piece | Where | Plan |
|---|---|---|
| Setup form (goal, role, field, background, stage, readers, keep private, pasted profile) | `components/Setup.tsx`, `ProfileInput` | Keep for v1. v2 replaces it with the import step and bucket choice. |
| Interview: model picks up to 9 questions, one story, Skip on every question | `app/api/interview`, `components/Interview.tsx`, `INTERVIEW_SYSTEM`, `lib/mock.ts` | Keep as v1 behind the switch. v2 is a new engine (`lib/interview/*`) and new routes. |
| Voice input | `components/useSpeech.ts` | Reuse as is. |
| Story Vault extraction with grounding guards (`overlap`) | `app/api/vault`, `VAULT_SYSTEM`, `lib/clean.ts` | Reuse the guards for per-answer facts. |
| Draft writer (confirmed facts only, `[[blanks]]`) | `GENERATE_SYSTEM`, `mockGenerate` | Reuse its rules for the first-win draft. |
| LinkedIn archive reader (browser only) | `lib/linkedinExport.ts` | Reuse as the optional archive path. |
| Accounts: Better Auth on Neon (password, email code, passkeys, Google) | `lib/auth.ts` | Add the LinkedIn provider (off until keys exist) and a magic-link plugin used only for "continue on laptop". |
| Paywall: every AI route calls `requireLicense` | `lib/billing.ts` | v2 interview routes need a signed-in account instead; everything else stays paid. |
| Limits: in-memory per instance | `lib/limit.ts` | Keep, plus durable per-user daily caps in Postgres. |
| Migrations: Better Auth tables only | `scripts/db-migrate.mts` | Extend with versioned SQL files. |

## Reuse / change / risk
- **Reuse:** `callStructured` and demo mode, `overlap` grounding guard, `GENERATE_SYSTEM` rules, `useSpeech`, `ui.tsx` components, archive reader, `sendEmail`, `sessionUser`.
- **Change:** `ProfileInput` (new optional fields), `FACT_KINDS` (five new kinds), `StoryFact` (confidence, source question), prompts (bucket-aware wording, outreach-only kinds), `LynkrApp` (v2 flow behind the switch), `/api/account` (LinkedIn flag), existing AI routes (read facts from the account when signed in).
- **Risks to existing features:**
  1. Old saved sessions: new fields are optional with defaults; `migrate()` is covered by a test.
  2. New fact kinds reaching `mockGenerate`, the checker or Connect: kinds are additive; rule 5 in `GENERATE_SYSTEM` widened so private kinds never go public.
  3. Preview shares the production database: v2 code only uses the new tables if they exist (`cloudReady()`), and never migrates on its own. Until a Neon preview branch is approved, preview falls back to browser storage.
  4. Paywall: the v2 interview opens before payment. Production keeps v1 until the switch is flipped, so the published Terms ("no free trial") stay true.
  5. e2e tests target v1: v1 stays the local default; v2 gets its own e2e run.

## Switch
`LYNKR_INTERVIEW=v1|v2`. Default: v2 on Vercel preview builds, v1 in production and local runs. Production only changes when Aryan sets `LYNKR_INTERVIEW=v2` there.

## Plan, part by part
- **Part 0:** question bank as typed data for fresher, experienced and networker; acceptance tests (I-series) in `research/acceptance-tests.md`.
- **Part 1:** data model: `ProfileInput` fields, fact kinds and confidence, old-session migration test.
- **Part 1b:** SQL migration 001 (lynkr_user, context_brief, facts, interview_answers, drafts, plan_items, usage_daily, metric_counts), `lib/db.ts` repository with every query scoped to the user, `/api/me/*` (brief, facts, export, delete, browser import), authorization tests on an in-process Postgres (PGlite), durable caps, cleanup cron.
- **Part 2:** import step: PDF guide plus browser parsing (pdfjs-dist, lazy), structured paste for phones, "continue on laptop" email, archive option, LinkedIn provider (off until keys).
- **Part 3:** engine: server picks questions; model only reflects, judges vagueness and phrases follow-ups; skip, park, stuck ladder, stop rule, estimate follow-up, "should" probe, idempotent saves.
- **Part 4:** screens: one question per screen, editable example, reflection, live vault panel, progress bar, voice, 375px, keyboard and screen reader.
- **Part 5:** read-back card with fixable lines and a rating, then a headline plus one referral message.
- **Part 7:** count-only metrics (logs plus a counts table).
- **Part 8:** switch, preview, PR.
- **Evaluation:** five personas (2 fresher, 2 experienced, 1 networker) plus a PDF with a planted instruction.

## Tools and services considered
| Tool | Use | Decision |
|---|---|---|
| pdfjs-dist 6.4.299 (Apache-2.0) | Read the profile PDF in the browser | Added, lazy-loaded |
| @electric-sql/pglite 0.5.8 (Apache-2.0) | Real Postgres in unit tests (authorization tests) | Added as a dev dependency |
| Better Auth LinkedIn provider | Sign in with LinkedIn | Built in, off until keys exist |
| Better Auth magic link plugin | Single-use "continue on laptop" link | Built in, no new service |
| Resend | Sends that link | Already configured |
| Vercel Cron | 12-month inactivity cleanup | Free on Hobby (daily) |
| Neon branch | Separate preview and development database | Needs Aryan's approval (question 1) |
| Paid transcription | Voice upgrade (Part 6) | Not built; only after asking |
No new paid service proposed.

## Skills used or installed
- Found with `npx skills find` (10 topics). Installed (markdown only, no scripts): `supabase/agent-skills@supabase-postgres-best-practices` (schema, indexes, user scoping), `anthropics/knowledge-work-plugins@ux-copy` (interview copy), `anthropics/knowledge-work-plugins@accessibility-review` (screen checks).
- Not installed: `anthropics/skills@webapp-testing` (ships scripts; Playwright already in the repo), `vercel-labs/agent-skills@web-design-guidelines` (fetches its rules from the network on every run).
- Already available and used: customer-research, interview-me, onboarding, conversational-ux ideas via the question draft, frontend-design.

## Questions for Aryan (collected, asked at the end)
1. **Neon preview branch** (approval needed before any schema change reaches a shared database).
2. **LinkedIn client ID and secret** for Sign in with LinkedIn.
3. **Your own LinkedIn PDF** for the parser check (4 made-up ones are in the tests).
4. **Terms draft** for free interview before the paywall (not published).
5. Marketing copy "No LinkedIn login, ever" conflicts with Sign in with LinkedIn once it's switched on.

## Part log
(Three lines per part: done, evidence, next.)

### Parts 0 and 1: spec and data model (2026-10-24)
- **Done:** question bank as typed data (`lib/interview/bank.ts`: 3 buckets, sections A to E, tags, examples, rephrase, extra examples, feeds, brief field or fact kind, follow-up triggers, time per question); pure engine (`lib/interview/engine.ts`); `ProfileInput` gains bucket, goals, mustHaves, privateSearch (default true), weeklyTime; 5 new fact kinds and `FactConfidence`; an "experienced" stage; prompts name the bucket, and rule 5 keeps all private kinds out of public drafts; I-series acceptance tests (I1 to I25).
- **Evidence:** `tsc` clean; `eslint` clean; unit 82/82 (15 new); `next build` compiled; existing e2e 31/31 and accessibility 5/5 in demo mode (v1 unchanged).
- **Next:** Part 1b, account storage. **Part 0's check (Aryan approves the bank, tags and tests) is pending:** the bank is data and easy to change.

### Takeover by session 478e144a (2026-10-24, 22:30 IST)
- **State found:** branch at 3f1a002 (parts 0, 1, 1b, 2, 3 server side, 7 server side, personas). `lib/interview/client.ts` uncommitted (browser state for v2, no screens yet). Earlier session idle since 15:23 UTC on another topic, so no overlap.
- **Evidence at takeover:** `tsc` clean; lint 0 errors (7 warnings, pre-existing kinds); unit 112/112. Open PRs: none. Master is at 7da1ac6 (PR #12, hero wordmark; touches `Landing.tsx`, `layout.tsx`, `HeroWordmark.tsx`, none of which the branch edits).
- **Remaining:** Part 4 screens, Part 5 screens, the v2 flow wired into `LynkrApp` behind the switch, account data screens (consent, download, delete, move browser data), regression tests for existing features with accounts, docs, persona run, v2 e2e and accessibility, rebase on master, PR.
- **Work split (parallel agents, one owner per file, only the lead commits):** A question screen and vault panel; B read-back and first win; C flow, store and app wiring; D account data screens; E backend review and regression tests; F docs; G persona and PDF-injection evaluation; H v2 e2e and accessibility (after A to D).

### Part 4: interview screens (agent A, 2026-10-24)
- **Done:** `components/v2/QuestionScreen.tsx` (one question per screen, section and minutes left, editable example that can't be saved unedited, Skip on sensitive only, "Not sure yet" parks, "Later" on enrichment, stuck ladder rephrase → examples → park, follow-up label, voice, Ctrl/Cmd+Enter), `VaultPanel.tsx` (brief and facts by kind with confidence hints, live count), `ProgressBar.tsx`.
- **Evidence:** tsc clean; eslint clean; `tests/v2-ui.test.mts` 7/7, including "anything Save allows, validateAnswer accepts" across every question in every bucket.
- **Next:** browser check at 1280 and 375 px (agent H).

### Part 5: read-back and first win (agent B, 2026-10-24)
- **Done:** `ReadBack.tsx` (six sections, Fix and Remove per line, put back, private label from the schema's single list, optional 1–5 rating), `FirstWin.tsx` (headline and referral through the existing `DraftCard`, blanks lock Copy, facts used listed, 401 → sign-up link).
- **Evidence:** `tests/v2-readback.test.mts` 7/7; only confirmed, switched-on facts reach `/api/first-win`.
- **Next:** browser check (agent H).

### Flow, store and switch (agent C, 2026-10-24)
- **Done:** `InterviewFlow.tsx` and `BucketChoice.tsx` (bucket → import → interview → read-back → first win, resume at the saved phase); `Saved.v2` with migration for old saves; `LynkrApp` renders the flow before the paywall when `/api/status` says `interview: "v2"`; v1 untouched. "Answer more" in v2 reopens the read-back (lead fix).
- **Evidence:** `tests/store-v2.test.mts` 5/5 (old save loads, round trip, malformed fallback, time cap).
- **Known gaps:** answering the "Later" enrichment questions after finishing isn't built (the read-back reopens instead); after the first win, the person passes the old fact-review screen once before full drafts.

### Account data screens (agent D, 2026-10-24)
- **Done:** `MyData.tsx` (consent note, save-answers switch, download JSON, two-step delete then clear browser), `MoveToAccount.tsx` (newest edit wins, shows added / updated / kept), consent line on sign-up.
- **Evidence:** `tests/mydata.test.mts` 3/3.
- **Known gap:** the browser-import route caps at 60 facts per move.

### Backend review (agent E, 2026-10-24)
- **Done:** license holders without accounts reach the free part; with accounts off and the paywall on, the free routes now need payment (402) instead of being open; stale follow-up facts pruned on edit; constant-time cron check. Lead: the AI error log now records only status and error code.
- **Evidence:** `tests/routes.test.mts` 5/5 (every old request shape works in demo mode; free vs paid gating in three configurations); `tests/vault-db.test.mts` 13/13 on PGlite (user A/B isolation for read, change and delete; delete removes all 7 tables; migration re-run safe; no console calls with answer text).
- **Not covered:** a route test of the signed-in account path (needs a faked Better Auth session); covered at the storage layer instead.

### Docs (agent F) and evaluation (agent G), 2026-10-24
- **Done:** privacy page corrected (account storage, us-east-1, retention, export and delete, LinkedIn scopes, Resend link), `.env.example`, README, CONTEXT, Terms draft with sections 3 and 6 (not published). Persona run in demo mode: `research/eval-vertical1.md`.
- **Evidence:** 5/5 personas finish; core fields 100%; expected facts 34/34; median estimated time 11.9 min; no example answers or untraced facts in the vault; planted-instruction PDF stays inside a quoted data block (lead fixed the fencing) and creates no fact.
- **Next:** completion rate and rating need the five real testers on the preview.

### Questions for Aryan (current)
1. **Neon branch for preview and development:** approve creating one, so the preview never shares production's database. Recommended: yes.
2. **LinkedIn client ID and secret:** needed to switch on Sign in with LinkedIn.
3. **Terms change** (`research/terms-draft.md`): approve before the v2 switch is turned on in production.
4. **Your own LinkedIn PDF** for one more parser check (optional).
5. **Landing copy "No LinkedIn login":** change once Sign in with LinkedIn is on.
Decided by the lead (reversible): license-key holders without an account may use the free interview and first win, since they have paid.

### Part 8: release checks (2026-10-25)
- **Done:** e2e and accessibility for v2 (agent H; ReadBack buttons wrap at 375 px); engine fix (vague follow-ups on brief-only questions no longer become facts); Terms approved by Aryan and applied, shown only when `LYNKR_INTERVIEW=v2`; Neon preview branch approved by Aryan; preview database guard (`lib/dbUrl.ts`): previews use `LYNKR_DATABASE_URL` and, without it, get no database instead of production's.
- **Evidence:** tsc clean; lint 0 errors; unit 148/148; build compiled; v2 e2e 36/36 (18 at 1280 px, 18 at 375 px); v2 accessibility 9/9; v1 e2e 31/31 and accessibility 5/5 with `LYNKR_INTERVIEW=v1`.
- **Next:** Aryan signs in to the Neon CLI once; lead creates the schema-only `preview` branch, pipes its connection strings into Vercel (Preview and Development only, never printed), runs migrations on the branch, redeploys the preview; five testers.

### Questions for Aryan (updated 2026-10-25)
1. ~~Neon preview branch~~ approved. Needs one `neonctl auth` sign-in by Aryan.
2. LinkedIn client ID and secret: Aryan is getting them.
3. ~~Terms~~ approved and applied behind the switch.
4. Dodo reviewed the site against "pay first, no free tier": tell Dodo before switching production to v2 (their merchant policy may require it).
5. Landing copy "No LinkedIn login": change when Sign in with LinkedIn goes on.

### Preview database and accounts (2026-10-25)
- **Done:** Neon branch `preview` (schema only, no production rows) in project neon-carmine-cave, us-east-1; `LYNKR_DATABASE_URL` and `_UNPOOLED` set for Preview only (piped, never printed); migrations applied to the branch (`001_vertical1.sql`), re-run clean; preview auth uses the preview's own address. Aryan added a preview-only `BETTER_AUTH_SECRET` and extended `RESEND_API_KEY` and `EMAIL_FROM` to Preview. OpenAI stays production-only, so preview drafts are templates.
- **Evidence:** preview `/api/status` interview v2; `/api/account` accounts true; free interview without sign-in returns 402/401 as designed; production database host differs from the branch host.
- **Next:** five testers on the branch URL; read metrics; then merge (Aryan), migrate production, set `LYNKR_INTERVIEW=v2`, tell Dodo.

### Browser run and fix round (2026-10-25, in progress)
- **Browser run (Chrome, local build, accounts on a throwaway PGlite DB, paywall on, v2):** sign-up by email code ✓, bucket choice ✓, paste import and prefill ✓, progress above zero ✓, example can't be saved unedited ✓, Skip only on sensitive ✓, "Not sure yet" parks and returns ✓, Later on enrichment ✓, "we" follow-up ✓, stuck ladder ✓, reload resumes ✓, answers and facts saved to the account ✓, read-back with Fix ✓, rating ✓, first win ✓, paywall after first win ✓. Hosted preview: landing, sign-up and the signed-out redirect ✓ (no account created on the hosted preview).
- **Findings being fixed by parallel agents (uncommitted until reviewed):** (1) landing copy for v2 free start and "Saved to your account" label — Landing, LynkrApp, chrome, InterviewFlow; (2) number heuristic ("two short steps" counted as a result), A2 reflection grammar, field-aware examples — engine, bank; (3) demo first-win headline leaked the private target role and stitched truncated facts; fact list shows ids — mock, FirstWin; (4) Ctrl/Cmd+Enter on chip questions — QuestionScreen.
- **Lead fix (uncommitted):** Paywall copy no longer says the vault stays in the browser; signed-in free users get My data (download, delete) on the paywall.
- **Next:** review and commit each agent's work; rebuild; re-run the browser check (My data download and delete via the paywall); run all gates; push (updates PR #13 and the preview).
- **Resume from a new session:** read this file, `git status` on `feat/interview-v2`, then continue from "Next".
