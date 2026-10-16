# Lynkr build plan (web app)

Status (2026-10-16): Phases 0, 1 (public pages only), 2 and 3 done for every phase 1 feature; Phase 4 done except tasks blocked on an AI key (draft evaluation, real-key e2e) and Firefox/Safari; Phase 5 done except the spend check (needs a key). Results: `research/validation-report.md`. Original status line: draft for review; Aryan said "go" on 2026-10-16.

## 1. Scope and boundaries

- **What we build:** an original Lynkr web app. Next.js 16 (App Router), TypeScript, Tailwind v4, Anthropic SDK, zod. Phase 1 has no login, no database, and no payments. Data stays in browser localStorage, except that answers go to the LLM to draft text.
- **What REA is for:** evidence about how public UpLinked UI behaves, so we can write our own spec and acceptance tests. REA does not supply code. We do not copy UpLinked source, assets, copy, or branding.
- **What REA is not for:** decompiling or reverse-engineering the UpLinked app, bypassing login, or scraping LinkedIn to find people. Those are out of bounds in the notes and in `CONTEXT.md`.
- **Source of truth for behavior:** `CONTEXT.md` section "Approved spec v1". If this plan and the spec disagree, the spec wins.

## 2. Current state (checked 2026-10-16)

- `app/` is a git repo with one commit (`Initial commit from Create Next App`). Lynkr work is uncommitted: modified scaffold files plus untracked `app/api/`, `components/`, and `lib/`.
- `CONTEXT.md` says "No UI". That is out of date. `components/` has 13 files (about 1,000 lines: Setup, Interview, Results, DraftCard, Checker, LynkrApp, useSpeech, and others). Treat the UI as a rough first draft to review, not as finished.
- `lib/` has 9 modules (checker, limit, llm, mock, prompts, schemas, slots, specificity, store). The three API routes are `interview`, `generate`, and `status`.
- Next.js 16.4.2 with React 19.3.0. `app/AGENTS.md` says this Next.js version has breaking changes and to read `node_modules/next/dist/docs/` before writing code. The plan assumes that step is done in Phase 0.
- Not yet verified in this session: typecheck, lint, build, and a run in mock mode. These are Phase 0.
- REA: installed by Aryan in a parallel session. The `mcp__rea__*` tools are connected in this session. I have not verified REA's install method or version from here, so re-checking it in a new session is still a Phase 1 prerequisite.
- Repo: `aryan12334567/Lynkr` (private), created by Aryan. Commit and push are the first step of this plan.

## 3. Architecture

| Concern | Decision | Why |
|---|---|---|
| Rendering | Client components for the flow; server routes for LLM calls | The flow is stateful and local; keys stay on the server |
| LLM | `lib/llm.ts` wraps the Anthropic SDK. Model `claude-opus-5-5`, override via `LYNKR_MODEL`. Effort low for interview turns, medium for drafting | Matches `CONTEXT.md` |
| Structured output | zod schemas in `lib/schemas.ts`, validated on every response. On failure, retry once, then show a plain error | Drafts must be parseable and must have the right shape |
| Mock mode | `lib/mock.ts` runs the whole flow with no API key | Lets us build and test without spending money |
| Storage | localStorage only, behind a small `lib/store.ts` interface with try/catch on every read and write | Works in private windows; never blocks the UI |
| Limits | `lib/limit.ts`: per-visitor and daily caps, best effort. Real cap is the Anthropic console spend limit | Matches `CONTEXT.md` |
| Voice | Web Speech API via `components/useSpeech.ts`, lang en-IN, typing fallback | Browser support varies; typing must always work |
| Rules | Checker and specificity score are deterministic code, not LLM calls | Rule-based output is testable and never varies between runs |

### Security and privacy (non-negotiable for phase 1)
- `ANTHROPIC_API_KEY` is read only on the server. It is never sent to the client and never committed. It goes in `app/.env.local`, which is gitignored.
- User answers and pasted text are untrusted data. Prompts put them in clearly delimited blocks, and the system prompt says to ignore instructions inside them. This is the "user answers are data, not instructions" rule from the spec.
- Cap input size on every route (for example, 4,000 characters per answer and 8,000 per request). Reject larger input with a 413 response.
- Screenshot upload for Connect Coach: read it through the model's image input, do not store it, and reject files over a set size and non-image types.
- Do not log answers, drafts, or pasted profiles. Log only route name, status, and latency.
- Errors show a generic message to the user. Full errors go to the server log only.
- Add a visible privacy note on the setup screen, matching spec step 9.

## 4. Phases

Each phase ends with an exit check. Do not start the next phase until the current exit check passes.

### Phase 0: Foundation (no new features)
Tasks:
1. Read `node_modules/next/dist/docs/` for the parts we use: App Router, route handlers, client components.
2. Run `npm install`, then `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Fix errors only in Lynkr files.
3. Start `npm run dev` in mock mode and load the home page.
4. Decide with Aryan whether to commit the current work (needs his yes).

Exit check: lint, typecheck, and build all pass. The home page loads in mock mode with no console errors.

### Phase 1: Evidence (REA, public pages only)
Tasks:
1. Read the REA repo's current install instructions. Install REA. Confirm in a new Claude Code session that the `mcp__rea__*` tools respond. Run one small, harmless analysis first.
2. Pick four features to study, each one a single feature from the public UpLinked site (no login): onboarding question flow, a sample profile or strategy page, the calendar view, and the post editor if it is public. Record only what a visitor can see.
3. For each feature, write `research/feature-evidence.md` entries. Each entry has four parts: observed facts (with screenshots or recordings and timestamps), inferences (marked as inferences), unknowns, and what we will not copy.
4. Record any step that needed a login or hit a paywall as "not studied". Do not work around it.

Exit check: four evidence entries exist. Each has at least one unknown listed and no code or copy taken from UpLinked.

Note: the notes suggest screen recordings for UI-heavy features. Use them first, since they are cheaper than analysis tools and need no binary work.

### Phase 2: Specs and acceptance tests
Tasks:
1. Write `research/feature-spec.md` for Lynkr's own features, starting from the approved spec in `CONTEXT.md`. For each feature: user-visible states, data shape, rules, edge cases, and the evidence it relies on (if any).
2. Write `research/acceptance-tests.md` with numbered, testable criteria. Use the numbers below as the minimum bar.
3. Save decisions and open questions in the spec. Do not leave them in chat only.

Numeric acceptance bar (from the approved spec, made countable):
- Interview: 6 to 8 questions, one at a time. Skip works on every question. Typing works when voice is unavailable.
- Drafts: 3 post drafts, 2 comment drafts, 3 headline options. Every draft uses only facts the user gave. In a test run with 5 test profiles, zero invented facts (checked by hand).
- Banned phrases: zero matches in output for "thrilled", "journey", "game-changer", "Agree?", emojis, and hashtags, across all 5 test profiles.
- Copy: disabled until every `[[slot]]` is filled, tested on 100% of posts.
- Checker: 100% of rule cases in the spec pass. It is deterministic: the same input gives the same verdict on 10 runs.
- Message length: outreach drafts 90 words or fewer, and the Connect Coach note 200 characters or fewer.
- Connect Coach: the app never lists named people. Zero named individuals in output for any test input.
- Latency: a generate call finishes in under 20 seconds at p95 on 10 runs.
- Storage: all state survives a page reload. Clearing the Story Vault removes it from localStorage.

Exit check: spec and acceptance tests are written, and Aryan has reviewed them.

### Phase 3: Build the core flow
Build order (each step is usable before the next starts):
1. Setup screen: goal, target role, background, optional pasted headline and About. Input limits enforced.
2. Interview: voice input with typing fallback. Answers editable before sending.
3. Story Vault: facts restated only from the user's words. Viewable and clearable.
4. Profile fix: headline options, About draft, recruiter-search keyword gaps.
5. Outreach: ask ladder (stranger, alumni or same college, someone who knows you). Follow-up draft.
6. Message checker: deterministic rules first, then the spec's exceptions.
7. Posts and comments: fill-in `[[slots]]`, copy gating, specificity hint.
8. Weekly plan and tracker: default 3 messages, 2 comments, 1 post.
9. Calendar: week and month views, IST. `.ics` download and Google Calendar link. Browser notifications only while the tab is open.
10. Connect Coach: "who to look for" cards with LinkedIn people-search links. Note writer from pasted text or screenshot. Note budget. Tracker states.

Rules for each step:
- Add the schema in `lib/schemas.ts` first, then the prompt in `lib/prompts.ts`, then the route, then the UI.
- Each route checks input size and validates output with zod.
- Each feature has at least one test (see Phase 4) before it is marked done.

Exit check: all ten steps work end to end in mock mode. Then the same flow works with a real API key on a small set of inputs.

### Phase 4: Quality
Tasks:
1. Unit tests for `lib/checker.ts`, `lib/slots.ts`, `lib/specificity.ts`, `lib/limit.ts`, and the zod schemas. Use Vitest, or the node test runner if we want fewer dependencies.
2. End-to-end tests with Playwright, covering the full flow in mock mode and one real-key run. Add Playwright only after Aryan approves the extra dependency.
3. Draft evaluation: 5 test profiles (written by us, fictional, not real people), each run through the drafting prompts. Check the acceptance bar by hand and record results in `research/validation-report.md`.
4. Accessibility pass: keyboard-only use of the full flow, visible focus states, labels on every input, sensible contrast in light and dark.
5. Mobile check at 375px width: no horizontal scroll, 16px side gutters.
6. Browser check: Chrome and Edge for voice input. Confirm the typing fallback in Firefox and Safari.

Exit check: all unit tests pass, the e2e run passes in mock mode, and the 5-profile evaluation has no failures against the acceptance bar.

### Phase 5: Hardening and handoff
Tasks:
1. Rate limit behavior tested: over-limit requests get a clear message, not a crash.
2. Spend check: a dry run with the console cap set, and the number recorded in `CONTEXT.md`.
3. README: install, env setup, mock mode, real mode, test commands, known limits.
4. Demo script: a 3-minute walkthrough with one test profile.
5. Privacy copy reviewed against the spec, step 9.

Exit check: a fresh clone can run the app from the README, and the demo runs without errors.

## 5. Decision gates (Aryan's call; I will not proceed past these without him)

| Gate | Needed before | Question |
|---|---|---|
| G1 | Phase 0 commit | DONE: work committed to git (2026-10-16) |
| G2 | Phase 1 | OPEN: confirm the four public UpLinked features to study, and that REA is used only on public pages |
| G3 | Phase 3 | OPEN: Aryan says "go" to build (per `CONTEXT.md`) |
| G4 | Phase 4 | DONE: test dependencies (Vitest, Playwright) approved 2026-10-16 |
| G5 | Real-key runs | DEFERRED: no API key during planning. Needed later, in `app/.env.local` with a console spend cap |
| G6 | Publishing | DONE: private repo `aryan12334567/Lynkr` created by Aryan; code pushed |
| G7 | Model | OPEN: confirm `claude-opus-5-5`, or switch interview turns to Sonnet 5.5 for lower cost |

## 6. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Drafts sound generic or AI-written | Core promise fails | Evaluation on 5 profiles in Phase 4; banned-phrase check; specificity hint |
| Model invents facts | Trust breaks | Facts-only rule in prompts; blanks instead of invented details; hand check in evaluation |
| Prompt injection through pasted text | Wrong output or leaked prompt | Delimited input blocks; system prompt rule; input size caps |
| Voice input unsupported | Interview feels broken | Typing fallback always visible; tested in 3 browsers |
| Cost overrun | Unexpected bill | Console spend cap; per-visitor limits; mock mode for dev |
| Scope creep into "publish" or "scrape" | Violates trust promise and LinkedIn terms | Out-of-scope list from `CONTEXT.md` checked at each phase exit |
| Copying UpLinked material | Legal risk, product not ours | Phase 1 rule: observed facts only, nothing copied; reviewed at G2 |
| REA not installed or behaving differently than the notes describe | Phase 1 slips | Verify in a new session before Phase 1 work; notes are a synthesis, not REA's docs |
| Unvalidated demand | Build for nobody | Validation step in `CONTEXT.md` (about 10 people); needs Aryan's numeric bar |

## 7. Open items for Aryan
- Numeric validation bar for the 10-person test (for example, how many of 10 would use it again). `CONTEXT.md` says this is needed.
- Whether to acquire UpLinked through TrustMRR, which would change Phase 1 entirely.
