# Decisions: all parts, decided

Date: 2026-10-30. Aryan asked the lead to decide every open item from the evidence gathered, and to use the plugins: REA (JetWriter and UpLinked), Compound Engineering reviews, and the marketing `paywalls` skill.

**How to read this:**
- Each row is **decided**, with the reason and its source.
- Every part plan's "lead default" is now a decision.
- Rows marked **(changed)** differ from the plan's earlier recommendation.
- **Your action** marks a step only Aryan can take: money, accounts, legal, or production.

## Settled earlier by Aryan
- **Free/paid:** "Keep today's split". Free with an account: the interview, Story Vault and first win. Everything else is ₹499 a month, with no trial.
- **The Calendar:** free for every user; what fills it stays paid.
- **Posts follow UpLinked:** auto-publish waits for LinkedIn's written answer, and the timer is cron-job.org.
- **Outreach:** a contact timeline.
- **The Calendar:** UpLinked style, goal-based weeks, and a streak earned at 70% of real actions.
- **Nothing auto-sends** except posts.
- **Profile fix** is removed.

## Cross-part (`build-plan-combined.md`)

| ID | Decision | Why |
|---|---|---|
| D-X1 | **Move to Vercel Pro before more paying users. Keep cron-job.org as the posts timer.** **Your action:** upgrade the team plan, about $20 a month | Vercel: "the Hobby plan restricts users to non-commercial, personal use only" (https://vercel.com/docs/plans/hobby). Pro doesn't change the timer choice: a per-minute Vercel cron would poll the database and keep Neon awake, which the Posts plan rejected (Posts KTD1) |
| D-X2 | **Delete the stray `003_posts.sql`** in Wave 0, after the preview-database check | Its foreign-key types mismatch. Posts U1 writes the real 003 |
| D-X3 | **Approve the combined paid list,** with the posts line following `LYNKR_AUTOPUBLISH` | It only promises what ships. The paywalls skill: "Focus on what they get" |
| D-X4 | **Send Dodo the message before the free Calendar goes live.** **Your action:** send it (draft in `dodo-message-draft.md`) | Dodo approved "pay first, no free tier" (`context-brief.md` §6) |
| D-X5 | **Reply bar: at least 20% of Lynkr-drafted first messages marked "replied" within 14 days,** with at least 10 sent. Warm outreach must also beat cold (Commenter D-C6) | No benchmark in the repo (not found). 20% is a deliberately modest floor for freshers messaging mostly strangers. Recruiter silence is the top complaint (`reddit-pain-points.md`: 87 mentions). Revisit after the tester round |
| D-X6 | **Yes: a free "Got a reply" tap on the first-win message,** and the paywall card names the reply when there is one | Paywalls skill: "Value before ask … after 'aha moment'". A reply is Lynkr's promise made real |
| D-X7 | **Yes: build "Link my license key"** (B6b) | Key-only payers have already paid. Without it they lose account-only features |
| D-X8 | **Budget = (expected paid users × $0.50) + $3 for free use, reviewed monthly.** Separate free-route counter, plus a "Writing is paused" state. **Your action:** set the OpenAI project limit (S2) | $0.24 per user at most for pictures (D-P4) plus text calls. Credits ran out once already (`context-brief.md` §3) |
| D-X9 | **The primary user for all copy is Indian freshers** | The target segment (`CONTEXT.md`); the Reddit research weighted toward freshers and job seekers |

## Interview (`build-plan-interview.md`)

| ID | Decision | Why |
|---|---|---|
| D-I1 | **A: complete first-win drafts with an optional question.** Landing's "Blanks, never guesses" changes | Matches the no-blanks rule everywhere else (`memory.md` 2026-10-27) |
| D-I2 | **Wait for tester data, with the trigger fixed:** move core questions first if fewer than 4 of 5 finish, or the median is 15 minutes or more | A numeric rule. The current estimate is 11.9 minutes against UpLinked's 5 |
| D-I3 | Retire v1 after the testers pass | v2 is live |
| D-I4 | Defer "Update my story" | The Posts interview gathers new facts |
| D-I5 | **Past-due grace until `past_due_ends_at`,** following Dodo's live status (B3) | Dodo: past_due "keeps full access" |
| D-I6 | **Access until the end of the paid period,** confirmed in Test Mode (B4) | Matches the Refunds page and is fairer to users |
| D-I7 | "Manage subscription" button through the Dodo portal | Self-serve cancel builds trust (paywalls skill: "Respect the No") |
| D-I8 | Landing changes to "Never asks for your LinkedIn password" when LinkedIn sign-in lands | Stays true |
| D-I9 | Key holders without an account keep the free interview | They have paid |
| D-I10 | The tester run gates only removing the v1 code | v2 is already live |

## Posts (`build-plan-posts.md`)

| ID | Decision | Why |
|---|---|---|
| D-P1 | **A: change the six live promise lines in the same release that turns auto-publish on.** New line: "Posts only what you scheduled, at the time you chose. Never messages, comments or connection requests for you." | Boundary 4: never break a public promise quietly |
| D-P2 | Weekly slot briefs from type plus Story Vault, editable | UpLinked's planned-post brief (feature-evidence-calendar #11) |
| D-P3 | Quick 3 questions, Thorough 7 | Short enough for freshers. UpLinked's numbers were not found |
| D-P4 | 30 AI pictures a month | About $0.24 per user at most. Carousels are free |
| D-P5 | A post more than 6 hours late fails as late | A morning post at night reads wrong |
| D-P6 | Expiry warnings at 14 and 3 days | LinkedIn tokens last 60 days with no refresh |
| D-P7 | Images only, up to 6 MB | Enough for proof screenshots |
| D-P8 | Public visibility | Visibility is the goal |
| D-P9 | No paid picture top-up | One flat price; no new Dodo product |
| D-P10 | **Yes: failure and expiry emails** | A missed public post must reach the user in time. There's no app to push from |
| D-P11 | **Testers may auto-publish on the preview with written consent,** before LinkedIn answers | It's the only way to verify publishing; the consent records the risk |
| D-P12 | **LinkedIn "allows" auto-publish only with an explicit written yes.** No reply means no | A conservative reading of API Terms 3.1 |
| D-P13 | Approve both bars: 3 of 5 publish their weekly count in week 2; 12 of 15 versions rated "I'd post this with light edits" | Numeric |
| D-P14 | A Monday .ics, plus an email (since D-P10 is yes) | Brings users back weekly, like UpLinked's Monday |
| D-P15 | Posts serve the reply promise: "Each post gives the people you're reaching out to a credible proof point" | It ties posts to replies |

## Commenter (`build-plan-commenter.md`)

| ID | Decision | Why |
|---|---|---|
| D-C1 | **A: select, then right-click.** Move to one-click reading only if fewer than 3 of 5 testers still use it in week 2 and 2 or more of them blame selecting, or the median selection time is over 15 s | JetWriter's `<all_urls>` approach carries ban risk. Keeping KD1 costs no new permissions |
| D-C2 | Freelancer, picked by hand | The brief requires it; there's no interview bucket for it yet |
| D-C3 | 10 generations a day | Matches the weekly plan's scale; protects the budget |
| D-C4 | Don't store the post's first line | Keeps "post text never stored" true |
| D-C5 | "Write with Lynkr", then a Comment / Message chooser | One menu item; fewer permissions to explain |
| D-C6 | Approve: warm beats cold (at least 5 warm messages); 3 of 5 still using it in week 2; under 60 s to insert | Numeric |
| D-C7 | A lapsed user keeps read, export and delete | Consistent across parts (combined §2) |
| D-C8 | **Store the minimum:** name and headline of posted comments only, 12 months, disclosed in privacy and tester consent. The tracking slice (Slice 2) ships only after a legal check. **Your action:** ask whoever reviews the Terms | The legal basis under the DPDP Act is not found in any source. Slice 1 (writing comments) needs no stored author data, so it isn't blocked |
| D-C9 | **Keep it paid. No free comment allowance** | Changing the free/paid split is yours, and the paywalls skill favours showing value through the first win and Calendar instead. Revisit only if fewer than 2 of 5 testers use it unprompted |

## Outreach (`build-plan-outreach.md`)

| ID | Decision | Why |
|---|---|---|
| D-O1 | Internship is a detail under Job | Matches the goal screen |
| D-O2 | Approve the after-meeting timings | Simple and editable per step |
| D-O3 | **Meeting notes are shown only, never sent to the AI** | Same open legal basis as D-C8 |
| D-O4 | Approve: 80% of meeting cards answered within 7 days; 60% of due steps acted on | Counts only what users did |
| D-O5 | Calendar export only, plus the D-P14 Monday email | One email channel, already chosen |
| [VISIBLE] | Approve the privacy note line and the paywall line | Accurate |

## Calendar (`build-plan-calendar.md`)

| ID | Decision | Why |
|---|---|---|
| D-K1 | Approve the mix table | Rules from goals and time, as UpLinked calculates its plans (#5) |
| D-K2 | 70% | Your streak choice |
| D-K3 | No subscription link yet | It needs a secret URL. The .ics and Google links cover reminders |
| D-K4 | **Approve, run as two groups:** 3 paid and 2 free testers | Tests both the product and the free-to-paid step |
| D-K6 | Self-reported "Mark done" counts, with the link-sample truth check | Matches how you defined "done" |
| [VISIBLE] | Approve Today's mix card and Landing's free-list line | Accurate under KD6 |

## Paywall behaviour (from the `paywalls` skill)
- **The card shows on each tap of a locked item.** It's a feature gate the user asked for, which the skill treats as the right moment ("When user clicks a paid-only feature").
- **No unprompted upgrade pop-ups** during the interview, Calendar or onboarding ("When NOT to show: during onboarding … when they're in a flow").
- **The card's structure:**
  1. a headline for the tapped feature ("Write this week's post with Lynkr")
  2. a one-line preview of what it does
  3. the reply proof if there is one (D-X6)
  4. the paid list
  5. "₹499/month, no trial"
  6. a value-led button ("Start writing")
  7. "Maybe later", which returns to the Calendar
- **No countdowns or guilt copy** (the skill's anti-patterns).

## Your actions only (everything else is decided)
1. **Upgrade to Vercel Pro** (D-X1).
2. **Send the Dodo message** (D-X4).
3. **Set the OpenAI budget** by the D-X8 formula.
4. **Get a legal check on D-C8** before the Commenter's tracking slice.
5. **The production steps** in `build-plan-combined.md` §5 (B10–B12), and LinkedIn's written answer for auto-publish.
