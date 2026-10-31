---
title: Interview and Story Vault (Vertical 1) - Plan
type: feat
date: 2026-10-30
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Interview and Story Vault (Vertical 1) - Plan

Updated 2026-10-30 from the 2026-10-23 plan, which was a draft at that point with nothing built. V1 has since been built, merged and released to production (`research/progress-vertical1.md` "release to production"). This update records what was built, keeps the confirmed decisions, and plans what remains. The original part-by-part plan and its outcome are in the Appendix.

## Goal Capsule
- **Objective:** A new visitor creates a free account, imports or types their background, and finishes a short interview. They leave with a confirmed Story Vault and a first draft they can use straight away: a headline and one referral message. Every later Lynkr feature then reads that same context.
- **Means:** the shipped v2 engine and screens, with the remaining gaps closed (U9–U14). Free access is through `requireAccountForFree`; everything after the first win is paid (KD1).
- **Authority, highest first:** Aryan's decisions (the KDs here, `C:\OS\memory.md`), then the R-IDs, then the KTDs, then the unit text.
- **Execution profile:** one lead owns git. Work happens on a branch from `origin/master`. Progress stays in `research/progress-vertical1.md`.
- **Stop conditions:** S1–S8 from `research/build-plan-outreach.md` Working Agreement, which applies unchanged: production, money, Key Decisions, accounts, a settled decision failing, "stop", secrets, broken tests.
- **Who finishes:** the lead builds U9–U14 on a preview. Aryan does A1–A6.

---

## Working Agreement
Adopted from `research/build-plan-outreach.md` (S1–S8, "How to ask"), unchanged. Two points matter most here, because V1 already broke them once:
- Redeploy after any variable change (`build-plan-outreach.md`).
- Previews use `LYNKR_DATABASE_URL`, never production's database (`lib/dbUrl.ts`; `progress-vertical1.md` Part 8).

---

## Aryan's part
| ID | What | Source | Until done |
|---|---|---|---|
| A1 | Add `OPENAI_API_KEY` to Vercel **Preview**, with the existing OpenAI spend limit, then run five testers on the preview. The preview has its own database, so `metric_counts` holds tester data only, and real AI means testers see the real product. Today the preview has no OpenAI key and shows template drafts (`progress-vertical1.md` 2026-10-25). Report the KD4 numbers plus how many ratings were given | `progress-vertical1.md` "Next" | Success unproven |
| A2 | Tell Dodo about the free interview. The draft is in `research/dodo-message-draft.md` | `progress-vertical1.md` release "Open"; sent status **sent 2026-10-31** | Merchant-policy risk |
| A3 | LinkedIn client ID and secret, for Sign in with LinkedIn. **Only after U16 has shipped** | `progress-vertical1.md` questions 2 | LinkedIn sign-in stays off |
| A4 | Approve the [DECISION] and [VISIBLE] items below | this file | Units U9–U14 wait |
| A5 | Send a Dodo test webhook event to `/api/auth/dodopayments/webhooks` (Test Mode) | `build-plan-interview.md` 2026-10-23 gap 12; Dodo Better Auth adaptor docs | Webhook path unverified |
| A6 | Check LinkedIn's brand guidelines for "Your LinkedIn co-pilot" | 2026-10-23 gap 10 | Brand risk open |
| A7 | Approve the question bank (`lib/interview/bank.ts`). U12 edits it | Appendix Part 0 ("approval … still pending") | The bank is unapproved |

---

## Product Contract

### Summary
The interview is live. This plan closes the gaps in it:
- the first-win draft still has blanks
- "Later" questions can't be answered after finishing
- an old fact-review screen appears once after the first win
- the tester run and target check haven't happened

It also records the free and paid line exactly as Aryan set it on 2026-10-30.

### Problem Frame
V1 shipped the v2 interview to production on 2026-10-27 (`progress-vertical1.md`). Three known gaps remain:
- "Later" enrichment questions can't be answered after finishing.
- After the first win, the person passes the old fact-review screen once.
- The first-win draft keeps `[[blanks]]` that lock Copy (`progress-vertical1.md` Part 5 and "Known gaps"; `components/v2/FirstWin.tsx` line 53).

The blanks conflict with the no-blanks rule Aryan set for outreach and posts (`memory.md` 2026-10-27, 2026-10-29). The tester run against the success target hasn't happened (`progress-vertical1.md` "Next"). The estimated median time is 11.9 minutes, but that figure comes from five demo personas, not real people (`research/eval-vertical1.md`).

### Key Decisions
Confirmed by Aryan on 2026-10-24 (2026-10-23 plan §6), carried forward:
- KD1. **The interview, Story Vault and first win are free with an account; everything else is paid at ₹499/month with no trial.** (session-settled: user-directed, 2026-10-30 "Keep today's split" — chosen over a free tier with limits, a trial, and new tiers.) Governs R12–R14.
- KD2. **Buckets first: fresher, experienced job seeker, networker;** career switcher and founder/freelancer later. Governs R2.
- KD3. **One estimate follow-up is allowed,** labelled as an estimate, and "not measured" is accepted. Governs R5.
- KD4. **Success target:** 70% of starters finish, median under 15 minutes, average summary rating 4 or higher. Governs R15.
- KD5. **Retention:** data is kept until the person deletes it, and auto-deleted after 12 months of inactivity. Governs R10.
- KD6. **No age check,** with the DPDP risk noted. Governs none.
- KD7. **The old interview stays behind the switch until the new one passes the tester run.** What actually happened: v2 went live in production on 2026-10-27, before the tester run (`progress-vertical1.md` release entry). KD7 now gates only the removal of v1 code (R16, U14, U17). Aryan to confirm this reading (D-I10). Governs R16.

Decided by the lead, not by Aryan, and reversible:
- KD8. **License-key holders without an account may use the free interview and first win** (`progress-vertical1.md` "Decided by the lead"). Aryan to confirm (D-I9). Governs R13.

### Requirements
**As built (keep).** Each has its evidence in `progress-vertical1.md`.
- R1. Sign up with an email code, password, passkey, Google or Apple. LinkedIn is off until A3 (`lib/auth.ts`).
- R2. Bucket choice, then import: LinkedIn "Save to PDF" read in the browser and never uploaded, structured paste for phones, a "continue on laptop" email, or the data archive (`components/ImportStep.tsx`, `lib/pdf`, `lib/linkedinExport.ts`).
- R3. One question per screen from a typed bank per bucket. The server picks every question; the model only reflects, judges vagueness and phrases follow-ups (`lib/interview/bank.ts`, `engine.ts`, `judge.ts`).
- R4. Skip is offered on sensitive questions only. "Not sure yet" parks a question; "Later" is offered on enrichment questions. The stuck ladder goes rephrase, then examples, then park. An example answer must be edited before it can be saved.
- R5. At most two follow-ups per core question. The estimate follow-up follows KD3.
- R6. Voice input through browser speech, with typing always available (`components/useSpeech.ts`).
- R7. A live Story Vault panel. Facts come with a confidence level and a link to their source answer. Outreach-only kinds never appear in public drafts.
- R8. A read-back card with Fix and Remove on every line, plus an optional 1–5 rating (`components/v2/ReadBack.tsx`).
- R9. A first win: a headline and one referral message, built from confirmed facts only (`components/v2/FirstWin.tsx`, `app/api/first-win`).
- R10. Context stored in the account: export, two-step delete, a "save answers" switch, and a 12-month cleanup cron (`lib/db.ts`, `app/api/me/*`, `app/api/cron/cleanup`).
- R11. Count-only metrics (`lib/metrics.ts`).

**Access (KD1):**
- R11b. Two more count-only events, `first_win_copied` and `paywall_checkout_started`, reported with A1 as information and not as pass/fail [SAFE].
- R12. The interview and first win need a signed-in account and no payment (`requireAccountForFree` in `app/api/interview2`, `app/api/first-win`). The one exception is KD8: a valid license key without an account.
- R13. Daily caps: 150 answers and 5 first wins per user (`app/api/interview2/route.ts` line 13, `app/api/first-win/route.ts` line 15). For license-key holders without an account, the caps key on the existing per-IP limits (`checkLimits`), because there's no user id to count against.
- R14. The paywall appears after the first win, for the paid tools only. Its list of paid benefits never includes the free Story Vault or the first win; today it does (`components/Paywall.tsx` line 11) [VISIBLE]. "My data" stays available on the paywall screen (`progress-vertical1.md` fix rounds).
- R21. An unpaid person with a finished interview always has a free home: their Story Vault (with its "Later" questions) and their first win. It's reachable from the paywall ("Back to my Story Vault") and on every return visit [VISIBLE].

**Remaining:**
- R15. Five real testers start the interview (A1), and their count-only metrics are read against the three KD4 thresholds. For five testers that means at least 4 of 5 finish, the median (the 3rd of 5) is under 15 minutes, and the average rating is 4 or higher.
- R16. The v1 interview route and screens are retired once R15 passes, per KD7 and D-I3. This happens in two releases: first flip the default, then delete the code, so rollback stays a variable change (U14, U17).
- R17. "Later" questions can be answered after finishing, from the Story Vault. Today the read-back reopens instead (`progress-vertical1.md` "Known gaps").
- R18. After the first win the person goes straight to the paid tools or the paywall. The old fact-review screen is no longer shown (same source).
- R19. The first-win draft follows D-I1.
- R20. Fresher examples cover B2 and B3 beyond the five fields already done (`progress-vertical1.md` release "Open").
- R22. Turning on Sign in with LinkedIn can't link a LinkedIn sign-in into an existing account unless LinkedIn reports the email as verified. Today `lib/auth.ts` line 80 lists `linkedin` in `trustedProviders`. Better Auth skips the email-verified check for trusted providers (`node_modules/better-auth/dist/oauth2/link-account.mjs` line 139). LinkedIn's provider maps `email_verified ?? false` (`node_modules/@better-auth/core/dist/social-providers/linkedin.mjs` line 63). So a LinkedIn account claiming an existing user's email could take over their account.

### Acceptance Examples
- AE1. Covers R18. A person confirms the read-back and sees the first win. Their next click goes to the paywall or the paid tools; the fact-review screen does not appear.
- AE2. Covers R17. A person who sent two enrichment questions to "Later" opens the Story Vault. They see both, answer one, and it becomes a candidate fact.
- AE3. Covers R19 under D-I1 option A. No confirmed fact has a company name, so the referral message is complete without one and offers one optional question to make it stronger. Copy is never locked.

### Success Criteria
KD4 measured on five real testers (A1), not on personas.

### Scope Boundaries
- Not built, considered: paid transcription (2026-10-23 Part 6; only if browser voice fails often); career switcher and founder buckets (KD2, later).
- **Deferred to Follow-Up Work:**
  - The "Update my story" mini-interview with a 90-day reminder (2026-10-23 gap 2). Built status: **not found**. See D-I4.
  - The 60-fact cap on browser import (`progress-vertical1.md` "Known gap").

---

## Planning Contract

### Keep / Change / Replace
| Part | Verdict | Why |
|---|---|---|
| v2 engine, bank, judge (`lib/interview/*`) | KEEP | Shipped and tested (unit 160/160, v2 e2e 36/36, `progress-vertical1.md` 2026-10-26). Also reused by the Posts per-post interview (`research/build-plan-posts.md` KTD6). |
| Screens (`components/v2/*`) | KEEP, CHANGE FirstWin | FirstWin locks Copy on blanks, which conflicts with D-I1 |
| Account storage (migration 001, `/api/me/*`) | KEEP | Live in production |
| Free gate (`requireAccountForFree`) and caps | KEEP | Matches KD1 |
| v1 interview (`app/api/interview`, `components/Setup.tsx`, `components/Interview.tsx`) | REPLACE (retire) after R15 | KD7. It still calls `requireLicense`, so it's a paid path to the same thing |
| Old fact-review step (`components/VaultReview.tsx`, after the first win) | REPLACE | R18 |
| Paywall placement (`components/Paywall.tsx` after the first win) | KEEP | KD1 |

### Key Technical Decisions
- KTD1. **The first win reuses the outreach draft composer's complete-draft path** (`lib/outreach/draft.ts` `generateOutreach`, the grounding guard and the optional "stronger" question) if D-I1 picks option A. Otherwise it keeps the `GENERATE_SYSTEM` blanks.
- KTD2. **"Later" answers reuse `/api/interview2` with the parked question ids.** Answering one sets the same candidate fact path (`upsertAnswerFacts`).
- KTD3. **v1 retirement happens in two releases.**
  - U14 flips the unset default in `lib/interview/flags.ts` to v2 and keeps the v1 code, so rollback is setting `LYNKR_INTERVIEW=v1`.
  - U17, in a later release, deletes the v1 routes, screens and the switch.
- KTD4. **The free first-win route never becomes a free outreach tool** (KD1).
  - The request schema stays profile and facts only.
  - The route hard-codes relationship `knows_me` and intent referral, and takes no recipient name, role or company from the request.
  - For signed-in users with account storage, only the account's confirmed facts are used, and the route refuses when there are none. Today `mergeFacts` in `lib/context.ts` line 20 falls back to browser-sent facts.
- KTD5. **LinkedIn links only on a verified email.** `linkedin` is removed from `accountLinking.trustedProviders` in `lib/auth.ts`. Google and Apple stay trusted. Governs R22.

### Payments and access changes
- **The offer doesn't change for this part.** KD1 matches production today (`progress-vertical1.md` release evidence; `app/terms/page.tsx` v2 text). No Dodo product change is needed.
- **Gated routes:**
  - Free with an account: `app/api/interview2`, `app/api/first-win`.
  - Paid: the v1 `app/api/interview`, `app/api/vault`, `app/api/generate` (`requireLicense`).
  - The paywall screen is `components/Paywall.tsx`.
- **Dodo items found during review.** They affect every part, so they're **owned by the combined plan** (`research/build-plan-combined.md`), not built here. This plan only depends on A5. Notes for that plan, from this review:
  - `past_due_ends_at` exists only on webhook payloads (`dodopayments` 2.55.0, `webhooks.d.ts`), not on the subscription list response. Grace needs the deadline stored when the webhook arrives (a migration), or Dodo's subscription detail call. The existing rule "access is always re-checked against Dodo" (`lib/auth.ts` lines 96–98) has to be reconciled with that.
  - An `entitlement_grant.revoked` payload carries `customer_id` at the top level of `data`. License validity sits in a separate cache keyed by license key (`lib/billing.ts` line 110), so revocation needs its own `forgetLicense`.
  - Caches are per serverless instance: a webhook clears only the instance that receives it. Other instances re-check within the 10-minute TTL, which is the accepted maximum delay.

  The items:
  1. **Grace period.** `subscriptionActive` counts only `status: "active"` (`lib/billing.ts` line 168). Dodo's `subscription.past_due` "opens a grace period; the customer keeps access until the deadline", and its payload has `past_due_ends_at` (https://docs.dodopayments.com/developer-resources/webhooks/intents/subscription). Lynkr cuts these users off early. See D-I5.
  2. **Webhook untested.** The Better Auth Dodo webhook is at `/api/auth/dodopayments/webhooks` (https://docs.dodopayments.com/developer-resources/better-auth-adaptor). Lynkr's handler only clears the cache (`lib/auth.ts` lines 96–98). No test event has ever been received (2026-10-23 gap 12). Covered by A5.
  3. **License-key revocation.** Dodo recommends handling `entitlement_grant.revoked` and validating keys against the API (https://docs.dodopayments.com/features/license-keys). Lynkr validates with a 10-minute cache (`CONTEXT.md` line 17), which follows the "validate against the API" advice. No webhook-based revocation exists [SAFE to add].
  4. **Cancellation conflict.** `app/refunds/page.tsx` line 13 says a cancelled key works until the paid month ends. `CONTEXT.md` line 17 says Dodo switches keys off on cancel. When Dodo actually ends access after a cancel: **not found**. See D-I6.
  5. **No customer portal UI.** `portal()` is registered (`lib/auth.ts`), but no screen calls it (grep of `components/`). Cancellation is email-only (`app/refunds/page.tsx`). See D-I7.
- **Copy:**
  - Terms v2 already describes the free interview.
  - Landing "Blanks, never guesses" (`components/Landing.tsx` lines 263, 361, 482) becomes untrue under D-I1 option A [VISIBLE].
  - "No LinkedIn login" changes when A3 lands (`progress-vertical1.md` questions 5) [VISIBLE].

---

## Implementation Units

### U0–U8. Built (2026-10-24 to 2026-10-27)
Parts 0–8 of the 2026-10-23 plan. Done, with the evidence in `research/progress-vertical1.md`. Not reopened, except where U9–U14 change them.

### U9. First win without blanks (if D-I1 = A)
- **Requirements:** R19, KTD1, KTD4. **Dependencies:** D-I1, and V3's `lib/outreach/draft.ts` being committed and stable.
- **Files:** `app/api/first-win/route.ts`, `lib/outreach/draft.ts`, `lib/grounding.ts`, `lib/prompts.ts`, `components/v2/FirstWin.tsx`, `components/Landing.tsx`, `tests/v2-firstwin.test.mts`.
- **Approach:**
  1. **Referral message:** goes through `generateOutreach` (relationship `knows_me`, intent referral) with a first-win option. That option keeps the referral ask in the mock and fallback paths: `composeDrafts` swaps a referral for a learning question (`lib/outreach/draft.ts` line 22). Outreach's default doesn't change.
  2. **Facts passed in:** proof kinds first (`project`, `contribution`, `evidence`, `offer`), highest confidence first. Other confirmed facts are used only if fewer than two proof facts exist. `generateOutreach` reads only `facts.slice(0, 2)`.
  3. **Headline:** `firstWinSystem` (`lib/prompts.ts` line 252) leaves the proof point out instead of writing a `[[blank]]`. The headline is checked with the placeholder, number and name checks extracted from `draftProblem` into a shared helper. If it fails, the headline is the target role alone.
  4. **Screen:** Copy is always enabled. The intro line "Fill any blanks…" is replaced. The optional question sits below the referral card and is skipped by default. Answering it regenerates only the referral message, keeps the current draft usable while loading or on failure, and counts toward the 5-a-day cap.
  5. **Landing:** the three "Blanks, never guesses" lines (`components/Landing.tsx` lines 263, 361, 482) are updated, held for Aryan's approval [VISIBLE].
- **Test scenarios:**
  - Covers AE3.
  - No output contains `[[`.
  - A number not found in the facts is rejected.
  - A private-kind fact never reaches the headline.
  - The mock and fallback referral bodies both contain a referral ask.
  - Extra recipient or goal fields in the request body are ignored.
  - A signed-in user with no confirmed facts is refused.
  - Optional question skipped, answered, and failed: each leaves a copyable draft.
  - Regenerated text is announced through a status region.
- **Verification:** unit tests pass, and the v2 e2e is updated and green at 1280 and 375 px.

> **Amendment 2026-10-30 (`build-plan-combined.md` X1):** fact filtering uses the shared `lib/facts.ts` `factsFor(use)`. Add `lib/facts.ts` to this unit's Files, and call `factsFor` instead of filtering locally.

### U10. Answer "Later" questions from the Story Vault
- **Requirements:** R17. **Files:** `components/v2/VaultPanel.tsx`, `lib/interview/client.ts`, `tests/v2-later.test.mts`.
- **Approach:** the Story Vault screen gets an "Answer later" group with a count. Picking one opens the same single-question screen (`QuestionScreen`) inline, with the normal vague-answer follow-up and loading and error states. On save, the new candidate fact appears in the group of facts waiting to be confirmed, and focus returns to the list. When there are no Later questions, the group is hidden.
- **Test scenarios:** covers AE2. Answering a "Later" question creates a candidate, not a confirmed fact. A vague answer gets the normal follow-up. An error keeps the typed answer.
- **Verification:** tests pass, plus a browser check at 375 px.

### U11. After the first win: no review step, a free home, honest paywall
- **Requirements:** R14, R18, R21. **Files:** `components/v2/InterviewFlow.tsx`, `components/LynkrApp.tsx`, `components/Paywall.tsx`, `tests/e2e-interview.mjs`.
- **Approach:**
  - Skip the old review step.
  - Unpaid users land on the paywall, which has a "Back to my Story Vault" link. Return visits open the Story Vault with the first win.
  - Remove "Your Story Vault, saved to your account" from the paywall's paid list, and add a line saying the Story Vault and first draft stay free [VISIBLE].
- **Test scenarios:**
  - Covers AE1.
  - A returning paid user lands on Today, not on review.
  - A returning unpaid user lands on their Story Vault and first win.
  - The paywall's paid list doesn't mention the Story Vault.
  - Focus moves to the new screen's heading.
- **Verification:** v2 e2e and accessibility pass at 1280 and 375 px.

### U12. Fresher examples for B2 and B3
- **Requirements:** R20. **Files:** `lib/interview/bank.ts`, `tests/interview.test.mts`.
- **Test scenarios:** every field and bucket has an example that can't be saved unedited.
- **Verification:** the bank test passes.

### U13. (moved)
Subscription grace, cancellation and webhook revocation moved to the combined plan, which owns billing for every part. The ID is kept so it isn't reused.

### U14. Make v2 the default (after R15 and D-I3)
- **Requirements:** R16, KTD3. **Files:** `lib/interview/flags.ts`, `tests/interview.test.mts`.
- **Test scenarios:** with `LYNKR_INTERVIEW` unset you get v2. With `LYNKR_INTERVIEW=v1` you still get v1.
- **Verification:** full test suite green.

### U15. First-win and paywall counts [SAFE]
- **Requirements:** R11b. **Files:** `lib/metrics.ts`, `components/v2/FirstWin.tsx`, `components/Paywall.tsx`, `tests/metrics.test.mts`.
- **Test scenarios:** both events are accepted with no text fields. A text field is rejected.
- **Verification:** tests pass.

### U16. LinkedIn links only on a verified email (before A3)
- **Requirements:** R22, KTD5. **Files:** `lib/auth.ts`, `tests/auth-linking.test.mts`.
- **Test scenarios:**
  - A LinkedIn profile with `email_verified=false`, using an existing verified user's email, doesn't link and doesn't sign that user in.
  - `email_verified=true` links.
  - Google and Apple linking is unchanged.
- **Verification:** tests pass. A3 is done only after this ships.

### U17. Delete v1 (a release after U14)
- **Requirements:** R16, KTD3. **Files:** `app/api/interview`, `components/Setup.tsx`, `components/Interview.tsx`, `lib/interview/flags.ts`, `tests/e2e.mjs`.
- **Test scenarios:** the removed routes return 404. Outreach, Posts and the plan still read the account context.
- **Verification:** full test suite green.

---

## Verification Contract
| Gate | Command |
|---|---|
| Types, lint | `npx tsc --noEmit`, `npm run lint` |
| Unit, DB, route | `npm test` |
| E2E | `npm run test:e2e:v2` (and `npm run test:e2e` until U14) |
| Personas | `scripts/eval-personas.mts --demo` |
| Real use | A1's five testers against KD4 |

## Definition of Done
- R11b and R14–R22 are met or explicitly deferred by Aryan. R22 (U16) ships before A3.
- Every gate above is green.
- `research/progress-vertical1.md` is updated.
- No production change happened without Aryan's yes.

---

## Decisions for Aryan
- **D-I1 [DECISION] First-win blanks.**
  - A: complete drafts with an optional question, as outreach does (recommended, per `memory.md` 2026-10-27).
  - B: keep the blanks.
  - Landing copy "Blanks, never guesses" changes under A [VISIBLE].
- **D-I2 [DECISION] Shorter path to the first win.** An estimated 11.9 minutes before any value (`eval-vertical1.md`), against UpLinked's stated 5-minute onboarding (`research/feature-evidence.md` fact 1).
  - A: wait for A1's tester data, then decide by a trigger Aryan confirms (recommended). Proposed trigger: do B if fewer than 4 of 5 testers finish, or if the median is 15 minutes or more.
  - B: move core questions first and enrichment after the first win now.
- **D-I3 [DECISION] Retire v1 after the testers pass** (recommended), or keep it indefinitely.
- **D-I4 [DECISION] "Update my story" and the 90-day reminder.**
  - Defer (recommended). The Posts per-post interview gathers new facts.
  - Build now.
- **D-I9 [DECISION] License-key holders without an account** can use the free interview and first win (KD8, decided by the lead). Keep (recommended, since they have paid), or require an account.
- **D-I10 [DECISION] KD7's meaning.** Confirm that the tester run now gates only the removal of v1 code, since v2 is already live (recommended). Or treat the early go-live as a mistake and switch production back to v1 until testers pass.

Owned by the combined plan, listed here because the Interview review surfaced them:
- **D-I5 [DECISION] Past-due access.**
  - Keep access until `past_due_ends_at`, as Dodo describes (recommended).
  - Cut off at the first failed renewal (today).
- **D-I6 [DECISION] Access after cancelling.**
  - Until the end of the paid period, matching the Refunds page (recommended). Needs a Dodo Test Mode check of when the status changes.
  - Immediate (then the Refunds copy changes) [VISIBLE].
- **D-I7 [VISIBLE] A "Manage subscription" button** using Dodo's customer portal (`portal()` already registered), alongside the email route (recommended).
- **D-I8 [VISIBLE] Landing "No LinkedIn login"** changes to "Never asks for your LinkedIn password" when A3 lands (`research/terms-draft.md` "Other lines").

---

## Appendix: the 2026-10-23 parts and what happened
| Part (2026-10-23) | Outcome | Evidence |
|---|---|---|
| 0 Lock the spec | Built. Aryan's approval of the bank is still pending | `progress-vertical1.md` Parts 0–1 |
| 1 Data model | Built | same |
| 1b Account storage | Built, migration 001 on production | release entry |
| 2 Import step | Built. LinkedIn sign-in off (A3) | Part 2 log |
| 3 Engine | Built | Part 3 log |
| 4 Screens | Built | Part 4 log |
| 5 Read-back and first win | Built, with blanks (U9) | Part 5 log |
| 6 Paid transcription | Not built (optional) | — |
| 7 Metrics | Built (count-only) | Part 7 log |
| 8 Release | Production 2026-10-27. Testers pending (A1) | release entry |
| Gaps 11–14 (Apify, Dodo webhook, favicon, uncommitted research) | 12 is A5. 11, 13 and 14 status: **not found** | 2026-10-23 §5 |
