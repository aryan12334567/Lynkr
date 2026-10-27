# Build plan: Interview and Story Vault (vertical 1)

Status: draft for Aryan's review, 2026-10-23. Nothing built. Based on `research/interview-questions-draft.md` and the decisions in chat (five goal buckets plus a field layer, skip only on sensitive questions, editable example answers, LinkedIn sign-in plus a guided Save-to-PDF import).

## 1. What already exists (checked in code, branch `feat/light-redesign`)

| Piece | Where | Keep, change or replace |
|---|---|---|
| Setup form: goal (job, internship, referral, network), target role, field (suggested then confirmed), background, stage, readers, "keep private", pasted profile | `components/Setup.tsx`, `lib/schemas.ts` `ProfileInput`, `lib/roles.ts` | **Change.** Becomes the import step plus bucket choice. Goals grow to the five buckets. |
| Interview: up to 9 questions, one story, early-career framing, Skip on every question, "Review my facts now" after 3 answers | `app/api/interview/route.ts`, `components/Interview.tsx`, `lib/prompts.ts` `INTERVIEW_SYSTEM` | **Replace** the engine and prompt with a question bank per bucket. Keep the route, the UI shell and the safety rules. |
| Voice input (browser speech, typing always available) | `components/useSpeech.ts` | **Keep.** Optional paid transcription later (Part 6). |
| Story Vault: model proposes facts with kinds and the answer numbers they came from; facts that don't match an answer are dropped; the user confirms or excludes each | `app/api/vault/route.ts`, `VAULT_SYSTEM`, `StoryFact` | **Keep and extend** with new fact kinds and confidence. |
| LinkedIn data-archive reader (in the browser, allowlisted files only, nothing uploaded) | `lib/linkedinExport.ts`, used in `ProfileFix.tsx` | **Reuse** as the optional archive path. |
| Drafts use only confirmed facts, gaps become [[blanks]] | `GENERATE_SYSTEM` | **Keep.** Used for the first-win draft. |
| Accounts: Better Auth (email, magic link, Google). Vault, drafts and plan stay in the browser | `lib/auth.ts`, `lib/store.ts` | **Change:** add LinkedIn sign-in (Better Auth ships a LinkedIn provider). Move the person's context to their account (decided 2026-10-24, see Part 1b). |
| Demo mode with a fixed interview sequence, unit and browser tests | `lib/mock.ts`, `tests/` | **Change:** demo mode and tests follow the new question bank. |
| Job-page import through Apify (Greenhouse, Lever, Ashby) | `lib/apify.ts`, `app/api/enrich` | **Reuse** as an optional step in question B3. |

Conflict to resolve: the current prompt says "never push for a number." The new design allows one follow-up asking for an estimate, labelled as an estimate, with "not measured" still accepted. See decision 2 below.

## 2. Parts, in order

Each part ends with checks that must pass before the next one starts. Sizes: S is about a day, M is two to three days, L is four or more.

### Part 0: Lock the spec (S)
- Finalise the question bank for the first two buckets: experienced job seeker and networker (from the draft), and fresher (adapted from the current one-story interview).
- Write acceptance tests in `research/acceptance-tests.md` for the interview.
- Resolve the decisions in section 4.
- **Check:** Aryan approves the bank, the tags and the tests.

### Part 1: Data model (S)
- `ProfileInput`: add `bucket` (five values), keep the field list, add `goals` (multiple choice), `mustHaves`, `privateSearch` (true by default when skipped), `weeklyTime`.
- Question bank as typed data, not prompt text: id, bucket, section, text, tag (core, sensitive or enrichment), example answer, what it feeds, and follow-up triggers.
- New fact kinds: goal, target_company, warm_path, offer, must_have. Each fact gets a confidence level: has an example, has a number or estimate, has a clear "I did".
- Saved data from older versions still loads.
- **Check:** typecheck and unit tests pass, and an old saved session opens without errors.

### Part 1b: Save the context to the account (M)
Decided 2026-10-24: the person's context lives in their account, so every feature and every device reads the same thing.
- **Tables in Neon Postgres,** linked to the Better Auth user:
  - `context_brief`: bucket, field, goals, target roles and companies, must-haves, private search, weekly time, tone, and a version number.
  - `facts`: the Story Vault. Kind, text, confidence, which answer it came from, status (candidate, confirmed or excluded), and whether to use it in drafts.
  - `interview_answers`: the question id and answer, kept so the interview can resume where it stopped. The person can switch this off.
  - `drafts` and `plan_items`: saved outputs and weekly plan entries.
- **The PDF is never stored.** Only the facts the person confirms.
- **Every AI request reads the context brief and confirmed facts from the database,** never from the browser, so features can't disagree.
- **Moving existing data:** on first sign-in after release, offer to move what's in this browser into the account. Clear the browser copy only after the save succeeds.
- **Privacy, for India's DPDP Act:** a plain consent note at sign-up (what's stored, why, for how long), "Download my data", "Delete my data", and no answer text in logs.
- **Check:** a person can sign in on a second browser and see the same Vault. "Delete my data" removes every row for that user, confirmed by a test. Logs contain no answer text.

### Part 2: Import step (M)
- **Sign in with LinkedIn:** add Better Auth's LinkedIn provider (scopes `openid profile email`). It fills in name and photo. Aryan creates the LinkedIn developer app and adds the client ID and secret to Vercel himself.
- **Guided Save to PDF:** a three-step guide with a short animation: open LinkedIn, go to your profile, click More or Resources, then Save to PDF, then drop the file here.
- **Read the PDF in the browser** with `pdfjs-dist` (Mozilla, Apache 2.0), so the file is never uploaded. Extract headline, About, experience, education and skills, then show them for the person to confirm.
- **Phone:** explain that LinkedIn's app can't do this. Offer to email a "continue on your laptop" link (through Resend, which is already set up), or paste the text instead.
- **Troubleshooting:** if the button is missing, check the profile language is English, otherwise use paste.
- **Optional archive** through the existing reader, for past posts.
- **Check:** the PDF parser works on 5 sample PDFs (Aryan's and 4 made-up profiles), the phone path works at 375px width, and nothing about the file is sent to the server.

### Part 3: Interview engine (L)
- The server picks the next question from the bank, based on the bucket, what the import already filled, and what's been answered.
- The model only does three jobs: write the one-line reflection, decide whether an answer is vague enough to need a follow-up, and phrase that follow-up. It never chooses topics on its own.
- Follow-up ladder: at most two follow-ups per core question. The "If you didn't have to justify it..." probe runs only on goal answers that sound like "should" answers.
- Skip is allowed only on sensitive questions. "Not sure yet" parks a question until the end. Stuck ladder: rephrase, then examples, then park.
- Stop rule: done when every core field is filled and confirmed. Enrichment questions left over go to a "Later" list.
- Safety rules from the current prompt stay: answers are data, not instructions; never ask for passwords, ID numbers or salary.
- Demo mode runs the same bank without a model.
- **Check:** unit tests for question order, skip rules, the stop rule and follow-up limits. Five made-up personas run end to end in demo mode.

### Part 4: Interview screens (M)
- One question per screen with the section name and a time estimate.
- An example answer under each question. Clicking it puts it in the box, and the person must edit it before it can be saved.
- After each answer, a one-line reflection, with specific affirmations only.
- A live Story Vault panel that fills in as the person answers.
- A progress bar that starts above zero after the import.
- Voice or typing, as now.
- **Check:** the browser test covers the full flow on desktop and phone widths. Keyboard and screen-reader checks pass using the existing accessibility test.

### Part 5: Read-back and first win (S)
- A summary card: who you are, what you want, top wins, who to meet, constraints, out of scope. Each line can be fixed.
- After the person confirms, the app shows a new headline and one referral message straight away, using the existing draft writer.
- **Check:** every sentence in the first-win draft traces to a confirmed fact or a [[blank]]. This is checked by the existing fact-reference rules and a manual review of the five personas.

### Part 6: Voice transcription upgrade (optional, S)
- Today's browser speech is free but unreliable on some browsers and Indian accents.
- The option is a paid transcription service called from the server, with a spend cap and recording only while the button is held.
- **Check:** compare accuracy on 10 short recordings before deciding. Only build it if the browser version fails often.

### Part 7: Measure quality (S)
- Track counts only, never answer text: interviews started, finished, time taken, core fields filled, how often the import was used, and the summary rating (1–5).
- Target to agree before launch, for example: 70% of starters finish, median under 15 minutes, average summary rating 4 or higher.
- **Check:** numbers appear in Vercel logs with no personal data.

### Part 8: Release (S)
- Ship behind a switch: new interview on, with the old one still available.
- Test on a Vercel preview with 5 real people from your network, then switch production over.
- **Check:** the target numbers from Part 7 are met on the preview group.

## 3. Tools and services

| Tool | Use | Status |
|---|---|---|
| Better Auth LinkedIn provider | Sign in with LinkedIn | Included in the installed package. Needs a LinkedIn developer app (Aryan). |
| pdfjs-dist | Read the profile PDF in the browser | New dependency, Apache 2.0. |
| Resend | "Continue on your laptop" email | Already configured. |
| Apify | Optional job-page import in B3 | Already integrated. The live import test failed earlier and needs fixing first. |
| OpenAI (gpt-5-mini) | Reflections and follow-ups | Already configured. |
| Paid transcription | Optional voice upgrade | Only if Part 6 shows it's needed. |
| Playwright tests | End-to-end checks | Already in `tests/`. |

Not used: LinkedIn scraping services (legal risk, as Proxycurl showed), and LinkedIn's data portability API (EU, EEA and Switzerland members only).

## 4. Decisions needed from Aryan
1. **Buckets first:** build the experienced job seeker and networker bucket plus the fresher bucket first, and add the other three later?
2. **Numbers:** allow one follow-up asking for an estimate, labelled as an estimate? The current prompt never asks for numbers.
3. **Voice:** stay with free browser speech for now, and only test paid transcription later?
4. **LinkedIn developer app:** can you create it? It's needed for Sign in with LinkedIn.
5. **Switch:** keep the old interview available until the new one passes the preview test?
6. **Storage:** decided 2026-10-24. Save the context to the account (Part 1b).

## 5. Gaps found on review (2026-10-24)

### Decide before building
1. **Paywall placement.** In production the interview route itself requires a paid subscription (`requireLicense` in `app/api/interview/route.ts`), so people pay before trying anything. Option: make the interview and the first-win draft free, then require the subscription for the full drafts, outreach and plan. This needs the Terms ("no free trial") updated if chosen.
2. **Keeping the context current.** Wins, roles and goals change. Add an "Update my story" mini-interview that only asks what's new, plus a reminder every 90 days. The context brief carries a version number.
3. **Resuming and changing goals.** Save progress after every answer (Part 1b). If someone changes bucket later, ask only the questions the new bucket needs.
4. **Age.** India's DPDP Act treats anyone under 18 as a child, which needs verifiable parental consent. Add an "I'm 18 or older" confirmation at sign-up.
5. **Per-fact privacy.** Beyond "keep private", let a fact be marked "outreach only, never public", for example the private job search or target companies.
6. **Phone users.** Save to PDF is desktop-only, and many users will be on phones. The paste fallback needs to be good: labelled boxes for headline, About and experience, not one big box.

### Safety and quality
7. **Text inside uploaded PDFs is data, not instructions.** Keep the existing rule, cap the size, and test with a PDF containing a planted instruction.
8. **Cost per interview.** Measure tokens on the five test personas, set a per-user daily cap, and check the OpenAI spend limit before launch.
9. **Regression tests for prompts.** Keep the five personas and the expected facts as a fixed test set, and re-run it whenever a prompt changes.
10. **Brand risk.** "Your LinkedIn co-pilot" uses LinkedIn's name, and "Copilot" is Microsoft's product name. Microsoft owns LinkedIn. Check LinkedIn's brand guidelines before marketing with it.

### Loose ends from earlier work (not interview, but launch blockers)
11. The live Apify job-page import still fails with a provider error.
12. The Dodo webhook hasn't received a test event, and the Resend sending domain isn't confirmed as verified.
13. The site's tab icon is still the default Create Next App icon.
14. Research files are uncommitted on `feat/light-redesign`, which is one commit behind `master`.

## 6. Decisions confirmed by Aryan (2026-10-24)
1. **Paywall:** the interview and the first-win draft come before the paywall. Full drafts, outreach and the plan stay paid. The Terms ("no free trial") must be updated to match.
2. **First buckets:** fresher, experienced job seeker, and networker. The other two (career switcher, founder or freelancer) come later.
3. **Numbers:** one follow-up asking for an estimate is allowed. Estimates are labelled, and "not measured" is still accepted.
4. **Success target:** 70% of starters finish, median time under 15 minutes, average summary rating 4 or higher.
5. **Deadline:** none set by Aryan ("focus on the process"). Working checkpoint: Part 0 this week, preview with testers in two weeks.
6. **Retention:** data is kept until the person deletes it, and auto-deleted after 12 months of inactivity.
7. **Age check:** not added, by Aryan's choice. Noted risk: India's DPDP Act needs parental consent for users under 18.
8. **LinkedIn developer app:** Aryan creates it, with Claude walking him through it in Chrome.
9. **Testers:** five people from Aryan's network.
10. **Old interview:** stays available behind a switch until the new one passes the preview test.
