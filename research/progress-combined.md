# Lynkr combined build - Progress

**Plan:** `research/build-plan-combined.md`. **Rewritten:** 2026-11-11 from `git log` and the code. The earlier version of this file said Wave 1 was "actively executing" across five parts; only Outreach and part of Billing are built.

## State by part

| Part | Branch | State | Evidence |
|---|---|---|---|
| Interview | merged earlier (PR #13) | v1 and v2 built. LinkedIn sign-in units U10-U16 not in code. | e2e 36/36 and 9/9 |
| Outreach | `feat/outreach-v2`, PR #17 | U0-U20 built, not merged, preview live at lynkr-preview.onrender.com | `research/progress-vertical3.md`; `npm test`, e2e, a11y, eval |
| Billing | `feat/billing-v2` (on top of outreach) | B3, B5, B6b built; B6 skipped by design; B7 nothing to do yet; B2, B4, B8 need Dodo and Aryan | `tests/billing-grace.test.mts`, `tests/license-link.test.mts`; `npm test` 477/477 |
| Posts | none | not started; blocked on LinkedIn API terms answer | no `lib/posts`, no migration 003 |
| Commenter | `feat/commenter-v2` (on top of calendar) | Slice 1 and Slice 2 built: parser, options core, extension and web views, signed log, week count, Outreach link. Migration 004 unapplied; real-LinkedIn check (A6), live-model eval and browser test of the signed-in screens not done. | `research/progress-commenter.md`; tests 543, ext tests 35 |
| Calendar | `feat/calendar-v2` (on top of billing) | Stage 1 built: mix rules, why line, progress, streak, plan in the account, `LYNKR_CALENDAR`. Stage 2 (feed, grid, moves, Today, sources) not started. | `research/progress-calendar.md`; `npm test` 510/510, calendar e2e 22/22 |

## Billing detail

- **B1** sent 2026-10-31 (Aryan).
- **B3 past-due grace** (`lib/billing-grace.ts`, migration `006_billing_grace.sql`, `LYNKR_PAST_DUE_GRACE=on`): the deadline comes from the webhook, access still needs a live `past_due` lookup, and a subscription with no stored deadline gets no grace. A grace answer can be cached up to 10 minutes (VALID_TTL), so access can outlast the deadline by that long. Covers the account path only: a key-only subscriber is not covered, because the license validate call does not return the subscription id.
- **B5 Manage subscription:** the portal button existed as "Billing" and only showed for active subscriptions. It now shows for any account with a Dodo customer, so a customer with a failed card can fix it. Label is "Manage subscription".
- **B6 webhook clear for `entitlement_grant.revoked`:** skipped. The payload carries no license key, and the plan allows this. Revocation stays on the 10-minute revalidation.
- **B6b Link my license key** (`lib/license-link.ts`, migration `007_account_license.sql`, `/api/account/license`, `components/LinkLicense.tsx`): the key is stored AES-256-GCM, never returned, never exported, removed by Delete my data and with the account. **Rotating `BETTER_AUTH_SECRET` makes stored keys unreadable**, so linked accounts lose paid status until they link again. A review caught that Delete my data would have kept the key; fixed and tested.
- **B7 paywall rule in code:** existing routes already use `requireLicense`. Nothing to assemble until Posts, Commenter and Calendar exist.
- **B2, B4, B8:** need Dodo test events, a test-mode cancel and a test card. Not done.
- **B9 copy release** (Terms v4, Privacy, Landing, Refunds, paywall list): not drafted. Every line needs Aryan's approval.

## Migrations

Applied on the preview Neon branch: 001, 002, 005. Written, not applied anywhere: 006, 007. Production: none of 002-007. Order for production: 002, 005, 006, 007 (003 and 004 do not exist yet).

## Decided by the lead (reversible)

- Billing work sits on its own branch, `feat/billing-v2`, cut from `feat/outreach-v2` because both touch `lib/auth.ts` and `lib/db.ts`. Merge Outreach first.
- Link-key storage is encrypted with a key derived from `BETTER_AUTH_SECRET`, not a new secret, so there is nothing new to configure. The cost is the rotation note above.
