# Lynkr Posts & Comments Intelligence

## Practical product and execution plan

**Updated:** 17 October 2026  
**Status:** Proposed next product slice; this document is a plan, not an implementation claim.  
**Audience:** Indian final-year students and early-career job seekers with 0–2 years of experience.

> **Evidence labels**
>
> - **Current** means checked against the app guide, repository, or dated validation report.
> - **Proposal** means a recommended design that is not implemented yet.
> - **Open** means the team needs evidence or a product decision before expanding scope.

## 1. Recommendation

Build Lynkr around two useful jobs:

1. Turn a user's real project, learning, or work story into a relevant LinkedIn post for people in their target field.
2. Help the user add one thoughtful, personal contribution to a LinkedIn post they have found themselves.

“High engagement” is an aspiration, not a feature Lynkr can promise or reliably predict. The product can make a draft more specific, relevant to a reader, easy to understand, and worth responding to. Whether people respond depends on the user's network, the post, timing, platform distribution, and many other factors Lynkr cannot observe. Do not ship a viral score, a reach prediction, or universal “best time” advice.

**Recommended next increment:** add a short, user-confirmed content profile to the existing interview, make generated text editable in Lynkr, then add a one-off “Comment on a post you found” flow. The profile should capture the user's target function domain, optional industry, intended readers, and a few topics. Keep the existing three post angles (proof of work, setback and change, field observation), but sharpen their audience value. Leave users in control of discovery, editing, copying, and publishing.

Do not build a LinkedIn feed, scraper, browser extension, automated commenter or publisher, named-person discovery service, or analytics backend. Those add cost and privacy risk without solving a demonstrated first-release need. Lynkr drafts and copies; the user publishes.

## 2. What exists today and what is still unknown

| Area | Current state | Product implication |
|---|---|---|
| Posts | The app generates three posts from the interview: proof, setback, and field observation. The generator uses the target role and Story Vault facts. | Keep the existing angles for the first iteration; use a compact function-domain list rather than an expanding industry taxonomy. |
| Content profile | Setup collects a goal, target role, and free-text background. It does not collect a confirmed function domain, intended audience, or topics as structured fields. | Add a compact questionnaire; do not infer a user's domain from demographic or education details. |
| Story Vault | The existing /api/generate request returns the Vault and all drafts together. Vault items have a kind and text, but no stable ID or source-answer reference. | A genuine review-before-writing step needs a small extraction/review stage before draft generation; the current one-shot route cannot provide that gate. |
| Comments | The app generates two general comment starters from the interview. They are not tied to a particular post. | A comment needs context from the specific post the user wants to join. |
| Blanks and copy | Drafts can contain fill-in blanks; copy is locked until they are filled. | Preserve this safety behavior for posts and new comments. |
| Editing | The current draft card renders text and blank inputs; it has no general full-text editor. | Users can edit after copying, but cannot refine the draft inside Lynkr. Add this before claiming the flow supports editing. |
| Specificity | A deterministic hint counts numbers, capitalized words, and stock phrases. It is explicitly a rough hint. | Do not turn this into an engagement or quality score. It is not a relevance or truth detector. |
| Storage | The browser stores the Story Vault, drafts, blank values, plan, and tracker in localStorage. There is no account or database. | Keep the feature browser-first. Do not persist pasted post text. |
| AI | Demo mode is tested. Real AI has not been run, and no job seeker has used the app, according to the 16 October guide and project notes. | The current implementation does not yet prove the core “sounds like you” promise. Run an AI quality check and a small user pilot before making claims. |
| External context | Connect Coach already accepts text or a screenshot that a user supplies for one-off note writing. | Use the proven user-supplied-context pattern, but start comments with text only and a separate, narrow request. |

**Source-of-truth note:** the current code and the 16 October guide show that the weekly plan, ask ladder, and Connect Coach are implemented. The status column in research/feature-evidence.md still labels some of these “not built”; treat those status cells as stale. See [project context](../CONTEXT.md), [the app guide](../docs/Lynkr-app-guide.pdf), and [the validation report](../research/validation-report.md).

## 3. Product behavior

### 3.1 Add a short content profile and a better interview

Use a two-part intake instead of making the adaptive interview do every job. The questionnaire supplies prompt context; the interview supplies the user's evidence and point of view. This is enough to make drafts relevant without turning onboarding into a long survey.

**Part A — content profile, target 30–60 seconds.** Keep the current goal, target role, and background fields. Add a compact “Your content profile” step. Only domain confirmation and intended readers need to be on the first screen; keep the rest optional or move it to the Story Vault review:

| Signal | Prompt or control | Rule |
|---|---|---|
| Target function domain | “Which field is closest to the work you want to do?” Offer a suggestion from the target role, then ask the user to confirm or change it. | Suggested choices: Software & IT; Data, AI & analytics; Product, design & research; Business, sales & marketing; Finance, consulting & operations; Core engineering & supply chain; Healthcare & life sciences; Education, policy & social impact; Media & creative work; Other / mixed / not sure. “Not sure” is valid. |
| Industry context | “Is there an industry you want to focus on?” Optional, collapsed short answer, such as healthcare, fintech, education, or climate. | Keep function and industry separate: a data analyst in healthcare is still in the data function. |
| Career stage | Final-year student; recent graduate; 0–2 years' experience; changing fields; other / prefer not to say. | Ask only if the existing background does not make it clear. Never infer years of experience. |
| Intended readers | “Who would you most like to hear from?” Choose up to two: practitioners in the field; hiring teams; peers and learners; alumni/community; other / not sure. | User choice informs emphasis; it does not change what facts are allowed. |
| Topics | After the interview, “Which 1–3 skills, problems, or tools from your stories should we use as topics?” | Suggest only terms grounded in the target role and confirmed Vault facts; let the user edit or remove them. Never present a suggested skill as a skill they possess. |

Show a one-line summary before the interview, for example: “Data & analytics · data analyst · readers: practitioners and hiring teams.” Let the user edit it later. Prefer a small deterministic role map to suggest a domain based on the target role; the user confirms it. Do not add an AI call just to classify a role. Treat “Other,” “mixed,” and “not sure” as normal paths, not errors. The 30–60 seconds is a design target, not a measured result.

**Part B — evidence-first interview.** Keep one question per screen, typing and voice input, editable answers, and skip. Use four core prompts, with at most two short follow-ups when evidence is missing:

1. “Choose one project or task related to your target role. What was it, and what did you personally do?”
2. “What was difficult or uncertain? What choice did you make?”
3. “What changed because of your work? If you did not measure a result, what proof or artifact can you point to?”
4. “What did you learn, notice, or question? Why might someone in your target field care?”
5. Optional setback angle: “What went wrong, and what did you change afterwards?”
6. Optional field-observation angle: “What have you personally observed in this field? Where did you see it?”

Treat the interview as one story, not a checklist of separate stories. A single useful example can support more than one draft angle. Ask a follow-up only when it fills a specific gap in that story, with no more than two total:

| Missing signal | One focused follow-up | If the user cannot answer |
|---|---|---|
| Personal contribution | “Which part did you handle yourself?” | Keep the user's stated role as-is; do not upgrade “we” to “I.” |
| Evidence or result | “What changed, or what artifact could someone inspect?” | Record “no result measured” and use a concrete process detail only if the user confirms it. |
| Own interpretation | “What would you do differently, or what surprised you?” | Leave the opinion/learning angle out; do not manufacture a lesson. |

Skip a follow-up when the user already answered the point or chose to skip. Never require a number; “not measured” is a valid answer. Do not force a field observation when the user has no firsthand basis. Keep the current early-finish option, but show which draft angles lack evidence and omit or mark those angles instead of filling them with generic copy. This keeps the path focused: one real example, only the missing details, then a reviewable Vault.

Use the person's natural wording in their typed or spoken answers as the first voice sample. Do not spend a separate questionnaire step asking them to choose abstract tone labels. If the answers are too terse to reveal voice, ask one optional follow-up such as “How would you explain this to a classmate?”

**Review before drafting.** Present a compact Story Vault for correction: domain and audience context; project; the user's contribution; challenge or decision; evidence/result; learning or opinion; and any constraint. Let the user edit, remove, or mark a fact “Do not use in drafts.” The user should be able to see why a fact is in the Vault and which answer it came from. Do not add sensitive personal details just to make the Vault look complete.

This is a deliberate two-step generation flow. First, turn the interview into candidate Vault facts with source-answer references; let the user confirm them. Only then generate drafts from the confirmed content profile and selected facts. This is a small refactor of today's one-call endpoint, but it prevents unreviewed extracted facts from silently becoming polished posts. If the extra step proves too costly or confusing, the fallback is to keep one-shot generation and call the screen a post-generation review; do not claim drafts were based only on facts the user confirmed beforehand.

The domain is content context, not a user identity or a promise of expertise. Do not use college tier, language, location, gender, or other personal circumstances to assign a domain. Use only the user's confirmed domain, selected audience, topics, and confirmed facts when drafting.

### 3.2 Write a post that is relevant to a reader

The user already gives Lynkr a target role and personal facts. Start there. Do not make the user classify themselves into a broad industry taxonomy before they can write.

For each existing post angle, guide the draft toward four things:

1. **Reader:** begin with people who work in, hire for, or are learning the user's target role. Let the user change the audience later if sessions show this is too narrow.
2. **First-hand detail:** use one concrete project, choice, result, mistake, or constraint from the user's Story Vault.
3. **Useful point:** make clear what the user learned, noticed, or would do differently, and why that could matter to the reader.
4. **Natural close:** a question is optional. Use one only when the user has a real question that another person can answer. Never append “Agree?”, “Thoughts?”, or a forced call to action.

The first draft should start with the actual work or observation, not a hook formula. Avoid invented outcomes, unsupported industry claims, generic lessons, inflated confidence, and polished language the user would not say. A post should still make sense if the user removes its final question.

Keep the current proof / setback / observation choices for the baseline. If the observation angle has no evidence in the user's answers, ask for a short follow-up or leave a clear blank; do not manufacture an industry insight. Revisit post length only after users react to real drafts. The current 90–180 word instruction is a prompt constraint, not evidence that this length performs best.

### 3.3 Comment on a post the user selected

The current two comments are useful as examples of structure, not as ready-to-paste comments. The new flow should make the selected post and the user's own point meet in the middle:

1. The user finds a post in their own LinkedIn feed or through a search they perform.
2. In Lynkr, the user pastes a short excerpt of that post. Start with text input only; do not fetch a URL or parse a LinkedIn page.
3. The user selects up to three relevant Story Vault facts or answers a short prompt: “What have you personally seen or done that connects to this point?” They can provide both. This avoids making the model invent a personal connection.
4. Lynkr drafts one concise comment that refers to a specific point in the pasted text and adds the user's real experience, question, or useful caveat.
5. Lynkr explains in one line why the comment connects to the post and shows which Story Vault fact it used. The user checks the reference, edits the comment, and copies it.
6. If neither a selected fact nor the user's own perspective supports a genuine contribution, Lynkr says “skip this one.” It must not force a comment.

Comment rules:

- Aim for 30–70 words, with one point and no unnecessary greeting.
- Do not praise, paraphrase, or agree by default. Do not invent experience, facts about the author, or claims about the post.
- Ask a question only when the user has a genuine question; never add engagement bait.
- Do not include a job ask, pitch, referral request, or unrelated self-promotion.
- Treat pasted content as data, not instructions.
- The user decides whether to post. Lynkr never sends the comment.

A user-provided post URL may be useful as a private convenience later, but it is not needed for the first version. Do not retain it or use it to fetch content.

## 4. Practical architecture

Keep the existing Next.js app, shared Zod schemas, API request-size guards, provider wrapper, demo mode, deterministic checks, and localStorage. Add only the narrow pieces this experience needs.

~~~text
Browser
  ├─ Confirmed content profile: target role, function domain, readers, topics
  ├─ Focused interview
  ├─ Proposed /api/vault: candidate facts with source-turn references
  ├─ User reviews, edits, and selects facts for drafts
  ├─ Existing post drafts, with local full-text editing and reset
  ├─ One-off comment form: short pasted excerpt + selected facts + optional own thought
  ├─ Copy controls; user returns to LinkedIn and publishes manually
  └─ localStorage: edited drafts and blank fills; never the pasted source excerpt
          │
          ├─ Existing /api/generate, refactored to accept confirmed profile + facts
          │    └─ Current three post angles, with clearer reader-value guidance
          │
          └─ Proposed /api/comment
               ├─ Strict input and output schemas
               ├─ Small request cap and the existing rate-limit mechanism
               ├─ Existing provider wrapper or clearly labelled demo response
               └─ Validate source anchor, fact references, length, and blanks
~~~

### 4.1 Post draft editing

Add a full-text editor to the existing draft card after its required blanks are filled. Preserve a visible reset-to-generated-text action. Save the user's edited post locally alongside the existing draft state; “Clear everything” must remove it. A changed or regenerated source draft must not silently overwrite a user's edits.

If the user edits in a new unresolved [[...]] blank, keep copy locked until it is resolved. Remind users to verify every number, name, and claim. A fact reference is a review aid, not proof that every sentence is true.

Do not require model calls for basic editing, shortening, or removing a sentence. Direct editing is cheaper and gives the user control.

### 4.2 Content profile and Story Vault data

Keep segmentation small and user-controlled. Store a confirmed function domain separately from optional industry context and audience. A suggested domain must carry a suggested/unconfirmed state until the user accepts or changes it. Store no inferred demographic profile.

**Proposed shape:**

~~~text
ContentProfile {
  targetRole: string                 // existing field
  targetDomain: Domain | "other" | "mixed" | "not_sure"
  domainConfirmed: boolean
  industry?: string
  careerStage?: enum
  audiences: Audience[]              // max 2
  topics: string[]                   // max 3, user-editable
}

StoryFact {
  id: string                          // stable local ID
  kind: project | contribution | challenge | evidence | learning | opinion | constraint
  text: string
  sourceTurnIds: number[]
  reviewStatus: candidate | confirmed | excluded
  useInDrafts: boolean
}
~~~

The existing Vault kinds can be migrated or mapped into this shape; do not discard saved answers or silently clear old localStorage. New extracted facts start as candidates with `useInDrafts: false`; only confirmed facts can be selected for generation. Keep source turn references so the user can correct paraphrases, and reject references to turns that were not submitted. A source link helps review but does not prove the model's paraphrase is accurate. For generation, select relevant confirmed facts from the Vault instead of treating a domain label as evidence. For a comment, send only the facts the user selected for that post.

### 4.3 Comment request and response

Add a separate, text-only request instead of making the existing /api/generate call rebuild the whole profile, outreach, and post bundle each time.

**Proposed request fields:**

- Target role, for audience context.
- User-confirmed target function domain and up to two selected audiences; optional industry only when relevant to the post.
- Pasted post excerpt, capped at 3,000 characters.
- Zero to three selected Story Vault facts, each with a request-local reference such as F1/F2.
- User-written perspective, capped at 500 characters; if no fact is selected, require this perspective or return skip.

Send only these fields. Do not send the whole interview transcript, the full Story Vault, a profile URL, or a screenshot for this task.

**Proposed response fields:**

- **status:** draft or skip.
- **body:** one 30–70 word comment when status is draft.
- **postAnchor:** a short exact phrase copied from the supplied excerpt.
- **factRefs:** IDs from the submitted facts only.
- **whyItFits:** one short explanation for the user.

Validate the response with the shared Zod layer. The server should check that the anchor appears in the submitted excerpt, every fact reference was submitted, the word count is in range, and the body has no unresolved blanks. These checks verify shape and references, not semantic truth; the user remains the final reviewer. If a valid anchor or relevant user fact cannot be found, return a skip response instead of a weak comment.

Use the existing LLM wrapper, request-size handling, and rate-limit approach. Keep the excerpt only in request memory. Do not log it, add it to analytics, or store it in localStorage. The generated comment may be saved locally only if the user chooses to keep it; the original excerpt is never saved. Explain that the excerpt is sent to the configured AI provider when Lynkr is in AI mode.

The response should be small and bounded to avoid paying for another full generation bundle. Demo mode must say it is a demo and must not pretend a template is context-aware if it did not read the supplied excerpt.

### 4.4 What not to add yet

No embeddings, vector database, feeds, queues, trend service, scheduled generation, browser monitoring, engagement analytics SDK, outcome warehouse, or cross-user recommendation model. The existing Story Vault is small; user-selected facts are enough for this version.

Do not promise that pasted public content is automatically safe to reuse. Ask users to share only the short, relevant text they want help responding to and not private or confidential material.

## 5. Execution plan

Estimates are focused engineering effort for one engineer familiar with the repository. They exclude recruiting time, provider setup, feedback turnaround, and deployment delays. A missing API key blocks real-AI quality validation, not document or mock-flow work.

### Phase 0 — Establish a real-AI baseline (P0; 1–2 engineering days once a capped provider key is available)

**Work**

- Set a provider spend limit before enabling AI. Confirm which provider and model are configured.
- Run the existing generation path on five fictional early-career profiles across different target roles.
- Include roles from several function domains and check whether the role-to-domain suggestion is understandable and easy to correct; do not treat this as an AI accuracy score.
- Review all three post types and both comment starters for invented personal facts, generic language, awkward voice, unsupported observation claims, and blank behavior.
- Record failures and examples in the validation report. Do not treat deterministic demo templates as evidence of AI quality.
- If a public pilot is planned, deploy the current app to an HTTPS preview with the key stored server-side. Confirm the visible mode/privacy copy matches the deployment.

**Exit gate**

- No known unsupported personal facts or unresolved copy-gating defects in the reviewed sample. Fix and rerun any failure.
- The five-profile check is a smoke test, not proof of error-free generation or general writing quality.
- If no provider key is available, mark the gate “not verified”; do not make AI-quality or engagement claims.

### Phase 1 — Add a content profile, reviewable Story Vault, and editable posts (P0; 6–9 engineering days)

**Work**

- Add the 30–60 second content-profile questionnaire: confirmed target function domain and up to two audiences; industry and career stage are optional, and topics are confirmed after the interview.
- Keep target role, domain, industry, and audience as separate fields. Suggestions from the role must be confirmed by the user; “other,” “mixed,” and “not sure” must work.
- Refocus the interview on personal contribution, challenge/decision, evidence or artifact, and learning. Ask no more than two follow-ups for gaps; never demand a number.
- Split the current one-call generation: a candidate-Vault step returns facts with validated source-turn references; the user reviews them; draft generation then receives only the confirmed profile and selected facts.
- Add a review step that lets users correct or remove Vault facts and mark facts “Do not use in drafts.” Preserve the source answer for each fact.
- Add full-text editing and reset for existing post and comment cards; preserve slot gating and local persistence.
- Tune the post prompts around the confirmed target reader, firsthand evidence, useful point, and optional natural close.
- Keep the three existing post angles. Do not expand beyond the proposed compact function-domain list or add an engagement score or extra analytics.
- Keep a visible reminder that the specificity hint is not a performance prediction.

**Acceptance**

- Users can confirm/change a suggested domain or continue with “not sure”; no inferred domain is silently applied.
- Domain, optional industry, career stage, audience, and topics remain distinct and editable. A data analyst targeting healthcare should not be collapsed into one label.
- The interview captures what the person did versus what the group did, a result or artifact when available, and the person's own interpretation; “not measured” and skip are valid.
- Users can review, edit, remove, and exclude Vault facts before those facts are selected for drafts; each extracted fact can be traced to an answer.
- Draft generation receives only user-confirmed facts; returned fact references must be a subset of the submitted IDs. This validates linkage, not the meaning of every sentence.
- Users can edit, reset, reload, and clear a draft without losing their interview answers.
- Copy stays blocked while required blanks remain or the final edited text contains unresolved blanks.
- Reviewed post claims are traceable to user-provided facts or clearly marked as blanks. Fact references help review but do not replace it.
- No forced question, generic CTA, invented metric, or “viral”/reach guarantee appears in reviewed outputs.
- Existing demo mode and unrelated tabs continue to behave as documented.

### Phase 2 — Add “Comment on a post you found” (P0; 3–5 engineering days)

**Work**

- Add a text-only comment form within Posts & comments, with the source excerpt, selected Story Vault facts, optional personal thought, and confirmed audience/domain context.
- Add a dedicated schema-validated comment route using existing infrastructure.
- Return one grounded comment or an explicit skip result. Include the post anchor and used fact references for review.
- Keep the older two comment starters labelled as examples until the new flow passes the pilot; then decide whether to remove or keep them.
- Keep generated text editable, copy-only, and user-controlled.

**Acceptance**

- No LinkedIn page is fetched, read, or automated. The user supplies the excerpt.
- The request contains only the target role, confirmed domain/audience context, excerpt, selected facts, and optional user thought, within documented size caps.
- Invalid anchors or fact IDs, malformed output, out-of-range word counts, and unresolved blanks are rejected or produce a safe retry/error.
- If there is no authentic connection, the result says to skip; it never fills space with generic praise.
- Pasted source text is absent from localStorage, server logs, and analytics. The AI-provider disclosure is clear before submission.
- The user can edit and copy the comment but cannot send it through Lynkr.
- The flow works at 375 px, with keyboard access, clear errors, and honest demo-mode behavior.

### Phase 3 — Small formative pilot (P1; about 1–2 calendar weeks, depending on access)

Recruit 5–10 target users, ideally from the existing university support-group channel, with a mix of target roles and writing confidence. Observe people completing the questionnaire and interview, correcting their Story Vault, improving one Lynkr post from their own experience, and commenting on a real post they selected themselves. Track the end-to-end completion time (initial target: under five minutes), where they correct the domain/audience suggestion, and which questions feel repetitive. Ask what they changed, what felt false or generic, and whether they would publish it under their own name.

Recommended decision bar for the first pilot:

- At least 6 of 10 participants can identify a draft they would publish after their own edits.
- At least 3 of 10 voluntarily report actually using one generated post or comment on LinkedIn within seven days.
- Zero unresolved critical privacy or fabricated-personal-fact issues.

This is a product decision rule for a small formative pilot, not a statistically valid engagement result. If recruitment yields fewer than 10 people, report counts and reasons; do not convert them into population claims. Do not pressure participants to publish or share their metrics.

If fewer than 10 participants are available, treat the numeric bar as inconclusive and use the sessions to find defects; do not scale based on a smaller denominator.

**After the pilot:** fix repeated quality failures first. If users find relevant posts but struggle to add a personal point, improve fact selection and the follow-up question. If they can already comment naturally, keep the flow small. Do not respond to weak usage by adding scraping or automation.

### Phase 4 — Decide whether outcome learning is justified (defer)

Do not build an outcome journal or pooled engagement system in the MVP. First learn whether users want to record results and whether they can report comparable values consistently.

If users later request it, begin with an optional browser-local note: whether they posted, the date, and any metric they choose to enter, with “unknown” separate from zero. Keep it private and deletable. A local journal does not create cross-user intelligence.

Only consider an aggregate service after a separate consent, retention, deletion, security, and analysis review. Any later insight would need its population, count, date range, and uncertainty shown; otherwise withhold it. Likes and comments are not comparable across accounts without a denominator such as impressions, and neither proves that Lynkr caused the response.

## 6. Evaluation: quality before engagement

Use a hierarchy that can be observed without claiming access to LinkedIn analytics:

1. **Truth:** no invented user facts; no claim that cannot be checked against the user's input.
2. **Relevance:** the user confirms the function domain and intended reader; the post has a useful point; the comment responds to the supplied post and adds something the user can stand behind.
3. **Voice and control:** the user says it sounds like them after editing and feels comfortable publishing it.
4. **Action:** the user chooses to copy or later reports publishing. This is useful product evidence, not proof of reach.
5. **Audience response:** optional, self-reported, exploratory only. Capture what metric it was, its denominator if known, and when it was checked. Never infer impressions Lynkr cannot see.

For the initial five-profile review, record each draft's factuality, relevance, voice, blanks, and failure examples. For the small pilot, use task observations and participant explanations. Do not run an A/B test until recruitment can meet a sample-size calculation for one preselected outcome. Confidence intervals cannot fix self-selection or missing reports.

## 7. Privacy and trust boundaries

- No LinkedIn login, scraping, logged-in page extraction, browser extension, automatic posting/commenting, messaging, or connection requests.
- The user finds the post and supplies only the excerpt needed for the task.
- User answers and pasted context are untrusted data, never prompt instructions.
- Existing AI disclosure already explains that submitted answers/context go to the configured provider. Add an equally clear notice on the comment form.
- No content in application logs or product analytics. Do not silently add analytics events to count edits or copies.
- Domain and audience labels tailor the user's own writing only. Do not pool them, profile people across sessions, or treat them as sensitive identity labels.
- Story Vault, generated drafts, edits, and any optional saved comment remain in the browser. “Clear everything” removes them.
- Do not call user reports anonymous unless re-identification risk has been assessed.
- A manual comment is still the user's speech. The UI should make review and editing easy and avoid presenting generated text as something that should be posted without judgment.

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| “Engaging” becomes a false promise | Describe the feature as relevance and conversation support; measure actual use separately from response. |
| Model invents a user's achievement or opinion | Send selected facts only, show fact references, retain user edit/review, and gate launch on real-AI evaluation. |
| Comment sounds like a bot or flatters the author | Require a specific post anchor and real user contribution; allow an explicit skip. |
| User cannot find a relevant post through Lynkr | Keep discovery manual in the first release; suggest search phrases only if research shows that is a real blocker. |
| Pasted post contains private material or prompt injection | Warn against private/confidential input, cap and discard excerpt, and delimit it as untrusted content in the prompt. |
| Local edits disappear or are overwritten | Persist edits locally, provide reset, and never overwrite silently during regeneration. |
| Small pilot appears to prove engagement lift | Report task counts and reasons as formative evidence; do not claim causality or platform-wide trends. |
| Target-role framing is too narrow | Ask pilot users who they were writing for; add audience controls only when users demonstrate a real need. |

## 9. Decisions and immediate next steps

**Locked for this slice**

- Browser-first, free, no account or database.
- Domain classification is suggested from the target role and confirmed by the user; it is never silently inferred from personal background.
- Three current personal-post angles remain the starting point.
- A comment is drafted from a post the user selected and supplied.
- The user edits, copies, and publishes manually.
- No engagement predictor, feed, scraping, automation, or cross-user metrics.

**Open**

- Which provider/model and spend cap will be used for the real-AI evaluation.
- Whether the short domain taxonomy and audience choices match how target users describe their work.
- Whether the two generic comment starters should remain after contextual comments are tested.
- Whether the audience choices are clear and useful, and whether choosing up to two adds value without slowing intake.
- Whether participants are comfortable supplying short post excerpts to an AI provider.

**Next steps**

1. Make a capped provider key available and run Phase 0; otherwise mark real-AI quality “not verified.”
2. Add the short content-profile questionnaire, evidence-first interview, Story Vault review, and full-text editing before expanding the generator.
3. Build and review the text-only comment-on-a-user-selected-post flow.
4. Run the small formative pilot with the recommended decision bar.
5. Revisit outcome collection only if users request it and can report comparable information.

---

*Source boundary: Statements labelled Current describe the app guide and implementation inspected on 17 October 2026. Proposals describe future work. The content-profile questionnaire, reviewable Vault stage, comment-context route, full-text editor, user pilot results, and engagement benefits are not implemented or validated by this plan.*
