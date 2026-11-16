# Final audit report (end-to-end check and improvement run)

Started and checkpointed 2026-11-16. Three states are kept apart everywhere: **run** (verified by running it), **demo** (verified in demo mode only: no model, key or network), **not verified**.

## Status (five lines, kept current)

1. **Done:** dimensions 1 (draft quality), 3 (reliability), 4 (security, the code-level part), 5 (paywall check), 8 (SEO and sharing), parts of 11 and 12 (runbook, `.env.example`). Five audit commits on top of `f20a48c`.
2. **In progress:** nothing. The run stopped here on purpose: the usage window was closing.
3. **Blocked (Aryan):** merges #17 to #20 and the Interview LinkedIn branch; production variables and migrations; live Dodo; Posts (LinkedIn API terms answer); copy approvals; the live-model eval; the real-LinkedIn check (A6).
4. **Branch and commit:** `feat/calendar-stage2-v2`; see "Commits" below for the head.
5. **Next command:** Render, `lynkr-preview`, Manual Deploy, "Deploy latest commit"; then time one comment generation on the preview (it was 49 s before the change).

## What was checked and what changed

| # | Dimension | Result |
|---|---|---|
| 1 | Draft quality | **Changed.** The outreach guard let 11 of 12 invented drafts through; now 12 of 12 are rejected and 5 of 5 honest drafts pass (demo). Comments use the same check. The composer no longer pastes Hinglish into an English message or uses two facts that contradict each other. |
| 2 | Time to first value | **Not measured.** No screen, tap or second counts were taken. |
| 3 | Reliability | **Changed.** Model, email and database calls now give up in bounded time with a plain message. Comment retry only after a quick first answer. Two client actions no longer claim success on failure. |
| 4 | Security and privacy | **Changed in part.** No route reads another person's rows (every query read is scoped by user). Fixed: unbounded body read, extension-only users looking inactive, license slot left taken on delete. Open points are in `proposals.md` P4, P9, P10. |
| 5 | Paywall and billing | **Checked, no code change.** Every paid route is gated before its paid work; no client-only gate; no countdown, auto-opened paywall or guilt copy found. The production blueprint still allows test payments (Aryan's step). Not tried against a running server. |
| 6 | Interface and accessibility | **Not done in this run.** The Calendar screens were checked with axe at 1280 and 375 px earlier; nothing else was. |
| 7 | Copy | **One line.** The daily-limit message no longer says "free demo". No public promise was touched. |
| 8 | Landing, SEO and sharing | **Changed.** Title, Open Graph and Twitter text, robots, sitemap, canonical, noindex on previews, a no-JavaScript fallback. No sharing image; the page is still drawn in the browser (P6, P7). |
| 9 | Performance | **Not done.** One earlier change counts: the Calendar feed reads its weeks in 1 query, was about 27. |
| 10 | Chrome extension | **Not done.** |
| 11 | Observability and operations | **Runbook written** (`research/runbook.md`). No cost counter was added. Limits are still in memory (P4). |
| 12 | Tests and developer experience | **Changed.** `.env.example` now names every variable the code reads. Four new test files. README is still stale (P10). |

The numbers, with before and after, are in `research/improvement-scoreboard.md`.

## Verification

- `npx tsc --noEmit`: clean (run).
- `npx next build`: compiles, 48 pages, `/robots.txt` and `/sitemap.xml` present (run).
- New and affected unit tests, run file by file: `draft-hard-cases` 24, `reliability` 4, `security-audit` 3, `seo` 2, plus the outreach, comment, persona, calendar, ext-api and route suites they touch: all pass (run).
- Full `npm test`: see "Full suite" below.
- Browser e2e: **not re-run** after the audit commits. The last green runs (desktop 30/30, phone 20/20, free 31/31) were at `f20a48c`. The audit commits touch `CommentOptions.tsx` and `app/layout.tsx`, which those runs cover only in part.
- Live model: **nothing in this run called a model.** The Commenter's lower reasoning effort and stricter "add a point" rule are unit-tested only.
- Preview: still on an older build; not redeployed.

## Full suite

`npm test` at the end of the run: **686 tests, 686 pass, 0 fail** (run, 2026-11-16, after commit `8b759d9`). No file crashed this time.

## Commits (this run, newest last)

- `a7c167f` fix(drafts): the guards catch the invented thing itself
- `7a7a1a2` fix(reliability): slow or dead providers end in a plain answer, not a hung request
- `62c9047` fix(security): capped body reads, extension activity, license slot on delete
- `8b759d9` feat(seo): sharing cards, robots, sitemap, a no-JavaScript fallback; complete .env.example
- docs: proposals, runbook, this report (the commit after this file was written)

Each is a separate commit, so any one can be reverted with `git revert <id>`.

**Commits to look at first if something feels off** (behaviour a person can notice):
- `a7c167f`: more model drafts are rejected, so the offline version shows more often until the prompt is tuned (P3).
- `7a7a1a2`: outreach gives the model 25 seconds before falling back to the offline version.
- `8b759d9`: page titles and the no-JavaScript text.

## Proposals

Ten, in `research/proposals.md`, each with evidence, a recommendation and the cost. In order of value: P1 Hinglish facts, P2 "no blanks" against the first generator and the Landing line, P3 prompt lines for the new guards, P4 limits in memory, P5 quota spent before the call, P7 server-rendered landing, P9 points for a legal read.

## Aryan's action list (in order)

1. **Deploy the preview.** Render, `lynkr-preview`, Manual Deploy, "Deploy latest commit". Worked when: `https://lynkr-preview.onrender.com/robots.txt` shows `Disallow: /`.
2. **Time one comment.** On the preview, Posts & comments, paste a post, write a reaction, generate. Worked when: it returns in clearly under 49 seconds and no option is mostly flagged lines. If it is slow or thin, tell the next session: the effort setting is one line in `lib/comment/write.ts`.
3. **Run the live-model eval once** (costs a few rupees of AI credit): in a terminal in the app folder, with the AI key in `.env.local`, `node --no-warnings --import ./tests/register.mjs scripts/eval-personas.mts`. Worked when: it prints a table and adds a dated section to `research/eval-personas-results.md`. Read five drafts.
4. **Answer the open decisions** in `research/proposals.md` (P1, P2 and P9 first) and the copy approvals already waiting (paywall card, Landing free-list line).
5. **Merge in order:** #17, #18, #19, #20, then the Interview LinkedIn branch. Worked when: each shows "Merged" and the next has no conflicts.
6. **Production variables in Render** (names in `.env.example`): the AI key, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://www.lynkr.cloud`, `RESEND_API_KEY`, `EMAIL_FROM`, Google and LinkedIn client pairs, `CRON_SECRET`, the feature switches. Add the production redirect addresses in Google Cloud and LinkedIn. Worked when: `/api/status` on the real site shows `mock: false` and the switches you set.
7. **Production database:** run the migrations with the production connection set in your terminal (`npm run db:migrate`). Worked when: it lists each migration as applied.
8. **Payments, last:** in Render production set `DODO_ENVIRONMENT=live_mode`, delete `LYNKR_ALLOW_TEST_PAYMENTS`, confirm `LYNKR_PAYWALL` is not `0`. Pay ₹499 once yourself. Worked when: your account shows as subscribed and a paid feature opens.
9. **Legal read** of Privacy and Terms against P9. Worked when: each of the five points has a sentence in the published text or a decision not to.
10. **Tester round and the real-LinkedIn check (A6)** as written in `research/handoff.md`; the Chrome Web Store listing only when paying users must install from the store.

## Decided by the lead (reversible)

- Audit commits go on `feat/calendar-stage2-v2`, the top of the stack, because it is the only branch that holds every part. Splitting fixes back onto each stacked branch would mean rebasing four open PRs.
- No prompt wording was changed in this run without a live eval (P3), except the Commenter's "add" line changed earlier the same day, which is unit-tested only.
- Database pools use a client-side query timeout, not `statement_timeout`, because Neon's pooled endpoint refuses it as a startup parameter.
- The Render preview was not redeployed during the run.
