# Posts - Progress

Built 2026-11-17 on `feat/calendar-stage2-v2` (commits `852b8b2`, `7bfa8ab`). Switch: `LYNKR_POSTS=v1|v2` (unset: v2 on a preview, v1 elsewhere). Publishing switch: `LYNKR_AUTOPUBLISH`, off unless exactly `on`. Everything below ran in demo mode or against stubs: **no live model and no live LinkedIn call.**

## Units (done, evidence, next)

### U1 Migration and store
- **Done:** `scripts/migrations/003_posts.sql` (posts, post_answers, post_versions), `008_posts_publish.sql` (publish columns), `lib/posts/db.ts`. Export and "Delete my data" cover the tables.
- **Evidence:** `tests/posts-db.test.mts` (6): re-runnable migration, user B cannot read, change or delete user A's post.
- **Next:** run 003 and 008 on the preview database, then on production (Aryan).

### U2 Slots and briefs
- **Done:** `lib/posts/slots.ts`: the week's post slots from the plan, a brief from the post type and a confirmed fact, editable.
- **Evidence:** `tests/posts-core.test.mts`.
- **Next:** none.

### U3 Per-post interview
- **Done:** `lib/posts/interview.ts`: fixed question bank (7 per type), Quick 3, Thorough 7, one extra question after thin answers, "Write it now".
- **Evidence:** `tests/posts-core.test.mts`.
- **Next:** none.

### U4 Versions and grounding
- **Done:** `lib/posts/write.ts`, `checks.ts`, `prompt.ts`, `mock.ts`: 2 or 3 complete versions, no blanks, 90 to 180 words; a version with an invented credential, outcome, quantity, title or praise is rejected; one retry only after a quick first answer; if nothing passes the person is asked one more question.
- **Evidence:** `tests/posts-core.test.mts` (42 in the file): 11 invented versions rejected, 4 honest kept.
- **Next:** live-model eval (Aryan's key).

### U5 Editor
- **Done:** `lib/posts/edit.ts`, `serve.ts`: refine by instruction, hand edits, restore; every change is a new version row.
- **Evidence:** `tests/posts-core.test.mts`, `tests/posts-routes.test.mts` (8).
- **Next:** none.

### U6 Visuals
- **Not built.** Text posts only. Pictures, carousels and PDFs need storage and an image budget; see `proposals.md` P12.

### U7, U8 LinkedIn connection and publisher
- **Done:** `lib/posts/linkedin.ts`: reads the token Better Auth stored at LinkedIn sign-in; `canPublish` needs the switch on, the `w_member_social` scope and an unexpired token; the Posts API request with the reserved-character escaper. `lib/auth.ts` asks for `w_member_social` only when the switch is on.
- **Evidence:** `tests/posts-publish.test.mts`: the exact request, no token in any output.
- **Next:** **not verified live.** Aryan's smoke test (plan A6) on his own profile; the API version constant (`LINKEDIN_API_VERSION`, default 202609) and the response header are from the public docs.

### U9 Scheduler
- **Done:** `lib/posts/schedule.ts`, `lib/posts/run.ts`, `GET /api/posts/run` (cron secret). Atomic claim; refusal is "failed"; timeout, 429 or 5xx after sending is "unknown" and never retried; stuck publishing becomes "unknown"; more than 6 hours late is "failed: late". A scheduled post is locked against edits.
- **Evidence:** `tests/posts-publish.test.mts` (16): published once across repeated and overlapping runs.
- **Next:** point a pinger at `/api/posts/run` every 5 minutes (Aryan; only matters with the publishing switch on).

### U10, U11 Screen and the post-it-yourself path
- **Done:** `components/posts/`: slots, interview, versions, editor, refine, history, approve, copy, "Open LinkedIn", reminder or schedule, "I posted it". Shown above today's posts cards when v2 is on and the person is signed in.
- **Evidence:** `tests/e2e-posts.mjs` against faked routes: 1280 px 35/35, 375 px 36/36, axe clean.
- **Next:** a signed-in run on the preview against the real routes (needs the migrations); the "unknown" state has no browser check.

### U12 Data lifecycle
- **Done:** export and delete cover the three tables. **Not done:** the 12-month cleanup was not re-checked for posts beyond `deleteAll`.

### U13 Copy and legal
- **Not approved.** Every string of the screen is listed in the worker's report and in `components/posts/words.ts`; none changes a public promise. The Landing, Terms and Privacy lines that publishing would break (D-P1) are untouched, and the publishing switch stays off.

### U14 Metrics and evaluation, U15 Release
- **Not done.** No Posts metrics. Release steps are in `final-audit-report.md`.

### U16 Emails
- **Done:** one "notice" email for a failed or unconfirmed post: no post text, at most 3 a day (`lib/posts/notify.ts`).
- **Evidence:** `tests/posts-publish.test.mts`.

## Decided by the lead (reversible)

- The plan was written for Vercel. No Vercel Blob, no cron-job.org client, no new dependency: one run route that any pinger calls.
- Reminder-first: with publishing off, scheduling is a reminder and the person posts it themselves. This is the released path until LinkedIn answers the terms question (`research/linkedin-terms-question.md`).
- Text posts only in this pass.
- The recommended option of D-P2 to D-P15 was taken each time. D-P1 (public promises) is not decided: nothing public was changed.
- Posts slots follow the plan's own week (`planWeekStart`).
