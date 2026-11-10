# Context Brief (Phase 0)

Date: 2026-10-30. Sources are repo-relative to `app/` unless stated. "Not found" means I looked and found no source.

## 1. What Lynkr is
Lynkr is a LinkedIn co-pilot for Indian freshers, experienced job seekers and networkers, priced at ₹499 a month (`CONTEXT.md` line 5). It interviews the user, keeps their facts in a Story Vault, and drafts messages, posts and comments from those facts only (`CONTEXT.md` "Approved spec v1"). It mirrors UpLinked's public stack and feature set, with some features removed and job-search outreach added, shaped by Reddit pain-point research (`CONTEXT.md` line 5, `research/reddit-pain-points.md`). Production runs at www.lynkr.cloud on Vercel (Hobby plan), with Neon Postgres, Better Auth accounts, Dodo Payments and OpenAI `gpt-5-mini` (`CONTEXT.md` lines 9, 19; `research/progress-vertical1.md` "release to production"). Its promise is "get replies from real people without sounding like AI" (`CONTEXT.md` line 86).

The five parts:
- Interview (V1)
- Posts (V2)
- Comments, called the Commenter
- Outreach (V3)
- Calendar

## 2. Settled decisions

| Decision | Reason | Source |
|---|---|---|
| Interview, Story Vault and first win are free with an account; everything else paid | Let people try before paying | `research/build-plan-interview.md` §6.1; `CONTEXT.md` line 8 "Decision 1" |
| First buckets: fresher, experienced job seeker, networker | Scope | `build-plan-interview.md` §6.2 |
| Success target: 70% finish, median under 15 min, rating 4+ | Measurable bar | `build-plan-interview.md` §6.4 |
| Data kept until deleted; auto-delete after 12 months idle | Retention | `build-plan-interview.md` §6.6 |
| No age check (DPDP risk noted) | Aryan's choice | `build-plan-interview.md` §6.7 |
| Outreach KD1: the extension reads only selected text, never the page, never sends | Kleo's extension was shut down by LinkedIn in June 2025 | `research/build-plan-outreach.md` KD1 |
| Outreach KD2: complete drafts, no fill-in-the-blank, never invent | "This is not a game." | `build-plan-outreach.md` KD2; `C:\OS\memory.md` 2026-10-27 |
| KD3 outreach starts from goals · KD4 low friction · KD5 connections file kept in the browser · KD6 public-web search on named contacts · KD7 caps · KD8 no automation (amended for posts) · KD9 profile links | Per entry | `build-plan-outreach.md` lines 110–120 |
| Posts follow UpLinked: an interview before every post, complete drafts, visuals, auto-publish through the official API | "make changes as per uplinked, override" | `memory.md` 2026-10-29; `CONTEXT.md` line 3; `research/build-plan-posts.md` KD1–KD5 |
| Production auto-publish waits on LinkedIn's written answer about API Terms 3.1 | Terms risk | `memory.md` 2026-10-30; `build-plan-posts.md` KD4 |
| The posts timer is cron-job.org | GitHub Actions minutes; Vercel Pro cost | `memory.md` 2026-10-30 |
| Profile fix removed | Aryan | `memory.md` 2026-10-29 |
| Never raise deadlines | Aryan | `memory.md` 2026-10-16 |
| Build on existing plans as dated amendments | Aryan | `memory.md` 2026-10-29 |

## 3. What went wrong before, and the rules added
| What happened | Rule added | Source |
|---|---|---|
| V1 needed "many rounds of back-and-forth" | The S1–S8 stop list, batched A-list questions | `build-plan-outreach.md` Working Agreement |
| Production ran without its keys until a redeploy | Redeploy after any variable change | same |
| `APIFY_KEY` vs `APIFY_API_KEY` | Fixed variable names; `/api/status` reports presence | same |
| The preview shared the production database | `LYNKR_DATABASE_URL` guard (`lib/dbUrl.ts`) | `research/progress-vertical1.md` Part 8 |
| Fresher examples were wrong; the first win leaked the private target role | Field-aware examples; private-search rule | `progress-vertical1.md` fix rounds |
| V3 left foundations only, uncommitted, with a stale progress file; OpenAI credits ran out | — (still open) | `research/progress-vertical3.md` handoff 2026-10-29 |
| Another model wrote a posts migration that couldn't run (two primary keys) and re-added blanks | Deleted 2026-10-30; `build-plan-posts.md` rewritten | this session |

## 4. Shared patterns
- **Plans:** `ce-unified-plan/v1` structure: Goal Capsule, Working Agreement (S1–S8), Aryan's part (A-list), Product Contract (KD, R, AE), Planning Contract (KTD), Units U0–Un, Verification Contract, Definition of Done (`build-plan-outreach.md`).
- **Progress:** `research/progress-verticalN.md`, three lines per unit.
- **Switches:** `LYNKR_INTERVIEW`, `LYNKR_OUTREACH`, `LYNKR_PAYWALL` follow the pattern v2-on-preview, v1-in-production until released (`lib/interview/flags.ts`, `lib/outreach/flags.ts`).
- **Data:** migrations are `scripts/migrations/NNN_*.sql`, with user-scoped queries and the `TABLES` list for export and delete (`lib/db.ts`).
- **Tests:** `npm test` (node:test plus PGlite), Playwright e2e and a11y scripts, persona evals, mock mode for every AI route (`README.md`, `tests/`).

## 5. Built or planned, per part
| Part | State | Source |
|---|---|---|
| Interview | v2 merged and live in production (`LYNKR_INTERVIEW=v2`); testers not yet run. The plan file still says "draft … Nothing built" | `progress-vertical1.md` release entry; `build-plan-interview.md` line 3 |
| Posts | Old v1 code live (3 drafts with blank locks). New plan `build-plan-posts.md` (2026-10-30), nothing built | `components/DraftCard.tsx`; `build-plan-posts.md` |
| Comments | Paste-a-post `CommentHelper` plus 2 generic drafts (v1). No Commenter plan. No JetWriter study: not found | `components/CommentHelper.tsx`; `prod/lynkr-posts-comments-intelligence-execution-plan.md` §3.3 |
| Outreach | Plan U0–U13. About 1,100 lines of foundations, uncommitted, behind `LYNKR_OUTREACH` | `build-plan-outreach.md`; `progress-vertical3.md` |
| Calendar | v1 "This week" plan in localStorage (`lib/plan.ts`, `components/WeekPlan.tsx`, `lib/ics.ts`). Outreach has a separate per-contact reminder log (`lib/outreach/calendar.ts`) | `research/feature-spec.md`; `validation-report.md` (19/19) |

## 6. Free and paid today, and the conflicts
- **Production as recorded:** ₹499/month including taxes, Dodo live checkout (`CONTEXT.md` line 9). Paywall on; interview v2 free with an account; signed-out interview returns 401 (`progress-vertical1.md` release evidence).
- **Gated by `requireLicense`:** `app/api/{comment,connect,generate,interview,plan,review,vault}` and `app/api/outreach/{brief,contacts,draft,goals}`.
- **Free with an account (`requireAccountForFree`):** `app/api/interview2`, `app/api/first-win`.
- **Extension:** `app/api/ext/pair` and `lib/outreach/ext-auth.ts` call `subscriptionActive` directly.
- **License keys:** 3 activations each (`CONTEXT.md` line 17). The account route reports `subscribed` (`app/api/account/route.ts`).
- **Terms:** `app/terms/page.tsx` switches on `interviewVersion()`. On v2 the text is free interview, first win and daily limits, with everything else paid and no trial of paid features. It also says "does not post or send anything for you" (§1).

**Conflicts:**
1. `CONTEXT.md` line 17 and the feature matrix say "no free tier or trial", but production runs the free interview (`progress-vertical1.md`), as do `build-plan-interview.md` §6.1 and `build-plan-outreach.md` R34.
2. `CONTEXT.md` line 8 says V1 "not merged", but `progress-vertical1.md` says merged and deployed.
3. Dodo approved the site as "pay first, no free tier". The message telling Dodo about the free tier is drafted and sent (`research/dodo-message-draft.md`; `progress-vertical1.md` "Open: tell Dodo"). Sent status: sent 2026-10-31.
4. Terms §1, the privacy page (lines 22–23 "cannot post, comment or send messages for you") and Landing (`PROMISES` "Nothing posted for you", line 263) all conflict with the posts auto-publish decision. This is not yet raised as a copy [DECISION].
5. Landing still promises "Blanks, never guesses" (line 263, line 361, line 482), which conflicts with the no-blanks decisions for outreach and posts.

## 7. Boundary confirmations
1. **No secrets in code or chat.** Confirmed in `build-plan-outreach.md` S7. **Not found** in `C:\OS\CLAUDE.md` or `C:\OS\memory.md` as a standing instruction; the S7 source holds.
2. **No production, live Dodo, Vercel Production or production database changes without a yes.** Confirmed in `build-plan-outreach.md` S1. Not in `CLAUDE.md` or `memory.md` as such.
3. **No deadlines.** Confirmed in `memory.md` 2026-10-16.
4. **Public promises.** Confirmed in `components/Landing.tsx` lines 263, 374, 479 and `app/privacy/page.tsx` lines 22–23. Already in tension with the posts auto-publish decision (conflict 4), which must become a copy [DECISION].
- **Possibly missing boundary:** LinkedIn API Terms 3.1 ("automate posting") and 4.4 (delete data on request) bind any posting or comment insertion. Source: LinkedIn API Terms page captured in this session's research.

## 8. Conflicts and gaps
- The conflicts in §6 (1–5).
- `research/build-plan-interview.md` status line is stale.
- `research/progress-vertical3.md` unit statuses are stale: U1 shows "Agent spawned" while code exists.
- Comments: no competitor study and no plan. JetWriter evidence: not found.
- Unconfirmed assumptions in `build-plan-posts.md` (30 pictures a month, 6-hour late cutoff, Quick 3 / Thorough 7, brief source) need Aryan's [DECISION].
- **The new free/paid offer (Aryan, 2026-10-30): "Keep today's split."** Free with an account: the interview, Story Vault and first win (a headline plus one referral message). Paid ₹499/month: everything else. No trial. This is the source of truth for Stage A and B, and it settles conflict 1 in favour of the production state: `CONTEXT.md`'s "no free tier" lines are stale.
