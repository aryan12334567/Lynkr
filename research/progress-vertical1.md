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
