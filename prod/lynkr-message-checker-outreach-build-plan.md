# Lynkr Message Checker & Personalized Outreach Build Plan

**Status:** Product and implementation proposal  
**Date:** 17 October 2026  
**Product context:** Lynkr, India-first early-career users (final-year students and people with 0–2 years of experience)  
**Relationship to existing work:** Improves the current deterministic Message Checker and Connect Coach. It is an evolution of Lynkr’s existing app and product direction, not a greenfield outreach system.

## 1. Product decision

Evolve the Message Checker from a rule-based “lint this text” widget into a **message decision coach**. Before it rewrites anything, it should help the user decide:

1. Is this the right person to contact for this goal?
2. Is this the right channel for the relationship and request?
3. Do we have a truthful, specific reason to contact this person?
4. Is the ask appropriate and easy to answer?
5. What is the smallest edit that makes the message clearer and more personal while keeping the user’s voice?

The output is advice for the user to review. Lynkr must not send messages, connect to LinkedIn, scrape member profiles, or promise a reply or conversion lift. A “good” message cannot overcome a wrong recipient, a poor channel, no real context, bad timing, or a role that is not actually relevant.

The practical product promise should be: **“Know whether this is a good person and reason to reach out, then make the message clearer and more specific.”** Avoid claims such as “get more replies” until a real pilot establishes evidence.

## 2. What exists today and what this plan changes

Lynkr already has useful pieces to extend:

- The **Message Checker** is local and deterministic. It accepts pasted text and a relationship selection (`stranger`, `alumni`, `knows_me`) and returns `Ready to send`, `Fix first`, or `Don’t send yet` with checks and flags.
- Its current checks look for a greeting, shallow “fit” keywords, a word limit, one ask, and a fixed easy-out phrase. It flags phrases such as “kindly revert,” “any opening,” and “you must refer me.” It requires a job ID and resume mention whenever text matches “refer.”
- **Connect Coach** helps users choose a type of person to look for and draft a connection note from pasted profile text or a screenshot. It does not return names and leaves sending to the user.
- **Ask Ladder** already distinguishes stranger, alumni, and known-contact requests. **Story Vault** stores user-confirmed facts that can support personalized writing.
- The app is Next.js/TypeScript, uses Zod schemas and a provider-agnostic LLM wrapper, has demo mode, and currently has no account/database. User state is localStorage. The checker itself does not use AI. The Connect endpoint can pass information to a configured provider.

This plan keeps those boundaries and improves their coordination. The immediate problems are not that the checker needs more stock phrases; it needs context about the user’s goal, the recipient, the relationship, the channel, and the evidence behind the message.

### Current checker gaps to address

- **Overly literal rules:** A message that says “I was referred to you by Maya” may trigger referral-ask rules even if no referral is requested. Token matching can miss genuine fit or mistake a keyword for fit.
- **Hard-coded etiquette:** A named greeting and a particular easy-out phrase are not required in every short note or established relationship. Their absence should not automatically make a message bad.
- **Channel mismatch:** A 200-character connection note, a LinkedIn DM, and an email should not share one 90-word rule. A channel-specific limit should be checked against current product behavior and counted after personalization fields are filled.
- **No target relevance check:** The checker cannot tell whether a finance professional is being contacted for a finance question or whether a person has any credible link to the user’s goal.
- **No grounding check:** It can approve text that invents familiarity or recipient facts, or implies a level of experience not supported by the user’s own profile and Story Vault.
- **No next best action:** Today it edits the message without asking whether to send a connection request, use another permitted channel, wait, follow a public discussion, or skip the target.
- **False assurance:** “Ready to send” sounds like a guarantee. At most, the checker can say it found no blocking issue in the information provided.
- **Too much context passed to AI:** Connect Coach currently sends up to 12 Story Vault facts. The new flow should send only the one or two facts the user chose for this message.

Existing research/validation reports say the checker and Connect Coach have been exercised in demo/mock paths, but the real AI path and real-world reply outcomes have not been validated. Treat current passing demo checks as functional evidence only, not proof of message quality or conversion.

## 3. Evidence and what it does (and does not) tell us

### Platform guidance

LinkedIn’s own guidance says invitations work best when there is a clear professional reason such as having worked or studied together or continuing a conversation. It recommends explaining how the sender knows the recipient and why they are reaching out. It also says common invitation restrictions result from inviting too many people the sender does not know or sending too many invitations in a short period, and advises users to invite people they personally know and who know them. This is a strong reason to stop treating a cold connection request as the default next step. It is platform guidance, not a claim that every stranger interaction is prohibited or that one wording will convert. [LinkedIn: Connecting with Other Members—Best Practices](https://www.linkedin.com/help/linkedin/answer/a1340458/connecting-with-other-members-best-practices?lang=en)

LinkedIn also notes that members can report unwanted invitations, that messaging availability depends on relationship/settings, and that a professional reason should be clear. [LinkedIn: Various ways to connect with people](https://www.linkedin.com/help/linkedin/answer/a541669)

### Career-service conventions

Career-services guidance consistently recommends a brief, tailored note that explains the connection and reason for writing, asks a focused question, and avoids turning an initial informational conversation into an immediate job or referral demand. Berkeley’s current guidance also documents the 200-character invitation note limit; implement this as a configurable channel constraint and verify it against LinkedIn’s live product before release, since platform limits can change. [UC Berkeley: 5 Tips for Reaching Out](https://www.career.berkeley.edu/prepare-for-success/networking/5-tips-for-reaching-out/), [UT Austin: Professional Correspondence](https://careerservices.cns.utexas.edu/resources/professional-etiquette/professional-correspondence), [Dartmouth: Networking Templates and Sample Questions](https://careerdesign.dartmouth.edu/resources/networking-templates/)

These sources offer sound professional norms; they are not randomized experiments that show a particular template increases replies.

### Lynkr’s existing qualitative evidence

The current Reddit research set reports recurring complaints about recruiter silence, networking feeling awkward, generic or spam-like DMs, and AI-generated writing that sounds performative or generic. Its method uses Reddit posts/comments and model-assisted coding, and the dataset over-represents people who post online and people with strong opinions. Counts are mentions in this sample, not prevalence estimates, unique-user population estimates, or causal findings. Use it to identify product risks and interview topics, not to claim that a certain message format will win.

### Adjacent experimental evidence

A 2026 arXiv preprint studying AI tone edits in workplace email found tone changes, but did not find a direct effect on opening, replying, or response time. It studies internal workplace emails, not LinkedIn outreach from early-career job seekers, so it cannot predict Lynkr outcomes. It does reinforce a useful caution: polish alone is not a reliable substitute for relevant context or a suitable ask. [Playful AI in Professional Email: A Field Experiment on Tone and Recipient Engagement (preprint)](https://arxiv.org/abs/2607.11749)

### Evidence confidence

| Claim or input | Confidence for Lynkr | How to use it |
|---|---|---|
| LinkedIn recommends a credible professional reason and cautions against inviting people the sender does not know | High for platform guidance; not conversion evidence | Make relationship/channel fit visible before drafting |
| Career-service sources favor brief, specific, respectful networking messages | Medium for general professional convention | Use as writing principles, not rigid pass/fail rules |
| Lynkr’s Reddit sample reports frustration with generic messages, awkward asks, and AI slop | Medium as a product-discovery signal; low for population prevalence | Test voice preservation and personalization with Lynkr users |
| Any exact message template will increase acceptance or reply rate | Unknown | Do not claim this; measure during a pilot |

## 4. Who should the product recommend contacting?

The user should search and choose an actual person. Lynkr should help them identify the **kind of person** and evaluate a candidate they bring, not build a scraped directory or generate a list of named prospects.

### Target order

1. **People the user knows or has genuinely interacted with:** former classmates, colleagues, mentors, event contacts, project collaborators, or people who have already invited contact. These are the best first candidates when the goal is advice, an introduction, or a referral.
2. **People connected through a real shared context:** same school/cohort, professional association, event, community, or a mutual contact who has explicitly agreed to introduce the user. The user must be able to explain the connection accurately.
3. **People with a relevant public professional contribution:** someone whose public post, talk, article, project, or role provides a concrete, current reason for a focused question. The relevance should be tied to the work, not personal-life details or assumed private motivations.
4. **People at a company/role of interest with no meaningful bridge:** treat as a lower-confidence target. Do not default to a connection request. Suggest engaging with public work manually, using an appropriate channel LinkedIn makes available (such as InMail where applicable), or using a company-published contact route. If the only reason is “they work at my target company,” recommend finding a stronger reason or skipping.

### Match on role and domain before drafting

Use the confirmed user profile and the profile/outreach plan’s role taxonomy to explain why a target is relevant:

- **Domain:** finance, AI infrastructure, healthcare, etc.
- **Function:** investment research, FP&A, risk, platform engineering, product, etc.
- **Seniority/stage:** student, entry-level, practitioner, manager, hiring contact.
- **Goal:** learn about a role, understand a team, ask for feedback, explore a live job, request an introduction, or follow up after a conversation.
- **Market and location:** India/region and relevant work authorization or geography only when the user has confirmed these matter.

“A person in finance” is not enough to justify outreach to any finance leader. If a user wants an entry-level credit research role, Lynkr should prioritize a relevant analyst, alumni in that function, or a recruiter/hiring contact for a real open role over an unrelated finance executive. For AI infrastructure, look for infrastructure/platform engineers or technical recruiters connected to the target role, not generic AI influencers.

### Search support should return categories and query ideas, not names

Extend Connect Coach’s current “who to look for” cards with role-aware search patterns such as:

- `site:linkedin.com/in [university] [credit research] analyst`
- `[company] [platform engineer] [Kubernetes]`
- `[event/community] [role/function] speaker`

These are prompts for the user’s own search, not instructions for Lynkr to scrape search results. Include a reminder that user-performed search results may be incomplete, stale, or misleading; the user must verify the person’s current role and context before composing a message.

## 5. Personalization data: a fast “relevance packet”

Personalization should come from a small set of verified facts, not a large profile dump. The system should reuse confirmed Story Vault and profile data, ask only for missing essentials, and make the user approve every recipient-specific claim.

### A. Reusable user context (confirm once, refresh when needed)

- Current role/stage and experience level.
- Target domain, function, role family, geography, and one or two current goals.
- What kind of help the user wants now: advice, insight, feedback, role clarification, a conversation, an introduction, or a referral for a live role.
- Two or three evidence-backed Story Vault facts the user is comfortable using (project, result, skill, challenge learned from, or relevant experience).
- Voice preferences: direct/warm, concise/conversational, formal/casual, and phrases/claims to avoid.
- Profile readiness and role fit as already assessed by Lynkr’s profile workflow.

### B. Per-person packet (target under 90 seconds to prepare)

Ask only the fields needed for this message:

1. **Who is this person in a professional sense?** Name optional; current title/team/company and role should be user-verified.
2. **How do you know them or what is the legitimate bridge?** Worked/studied together, event, mutual introduction with permission, public work, or no existing link.
3. **What exact current thing gives you a reason to write?** A public post/project/talk, a shared interaction, a live role or team, or a specific question about their work. Capture a URL or source label and when the user checked it, if available.
4. **Why this person for this user’s goal?** A one-sentence match tying the recipient’s work to the user’s confirmed role/domain/goal.
5. **What do you want to ask?** One outcome, in the right channel.
6. **Which user fact supports the reason?** User selects one confirmed Story Vault fact; Lynkr must not choose or expose the entire vault by default.
7. **Where will this be sent?** Invitation note, LinkedIn message, InMail, email, or another user-selected channel.

If the recipient anchor is stale, vague, or missing, do not fabricate specificity. Ask for one concrete detail, recommend a different contact/channel, or say that there is not enough context to personalize this message honestly.

### C. Make collection efficient

- First ask the user to pick their goal and contact type; this determines the minimum packet.
- Pre-fill only previously confirmed user facts. Show the source and let the user edit them.
- Ask one targeted question at a time, not a long form. Skip fields that do not apply.
- Save reusable target-role preferences and voice settings locally. Do not retain a recipient’s pasted profile, screenshot, personal contact data, or full DM by default.
- Show a short “using these facts” preview before any semantic AI request. The user can remove any fact or detail.

The speed goal is a one-time profile setup plus a short, repeatable recipient packet—not a full questionnaire for every message.

## 6. Checker v2: review dimensions and output

Avoid a mysterious 0–100 “message score.” Show the dimensions, the evidence used, and the concrete edit. A strong draft can still be aimed at the wrong person; separate contact decision from copy review.

### Step 1: Contact decision

Return one of:

- **Good reason to contact:** credible relationship or specific professional context is present.
- **Need one more detail:** ask for a missing, verifiable anchor or clarify the goal.
- **Consider another person or channel:** the target fit or channel is weak.
- **Hold off:** the proposed request is intrusive, misleading, or mismatched to the relationship.

Explain the reason in plain language. Never describe a particular person as likely to reply based on their name, profile, or supposed personality.

### Step 2: Message review

Review these dimensions independently:

1. **Truth and grounding:** Every claim about the user must match user-confirmed profile/Story Vault facts. Every claim about the recipient must be supported by the user-provided context. Flag unsupported claims; never fill them in from inference.
2. **Relevance:** The message connects one recipient-specific professional anchor to one confirmed user goal or fact. It should not merely say “I admire your profile” or repeat their headline.
3. **Relationship fit:** The ask matches how well the user knows the person and whether an introduction/permission exists.
4. **Ask clarity:** One primary, specific, low-friction question or next step. A chat request can be optional; not every informational ask needs to request a 15-minute call.
5. **Channel fit:** Apply the selected channel’s current length and etiquette constraints. A LinkedIn invitation note needs a character count, not the email word limit. Keep limits configurable and re-check platform behavior before release.
6. **Voice and readability:** Make the message easy to understand and sound like a person. Cut filler, excessive praise, awkwardly polished phrases, false familiarity, and unnecessary biography. Preserve the user’s wording where it works.
7. **Pressure and safety:** Flag demands, false urgency, repeated follow-ups, sensitive personal details, manipulative flattery, unsupported claims, or disclosure of information the user has not chosen to share.

### Step 3: Smallest helpful edit

When the draft needs work:

- Show the exact span to change and why.
- Offer up to two alternatives with a tone control: **keep my voice**, **make shorter**, **make warmer**, or **make clearer**.
- Default to editing the user’s draft, not replacing it with a complete canned message.
- Keep blanks explicit where evidence is missing, e.g. `[specific post or project]`. Do not auto-fill an unverified recipient detail.
- Let the user accept/reject each change. The checker must not imply the message is guaranteed or “safe” simply because it passes rules.

### Step 4: User-facing status language

Replace the current `Ready to send` label with wording that preserves user judgment:

- **Looks ready for your review** — no issue was found in provided information.
- **Edit before sending** — one or more clear fixes would improve truth, fit, clarity, or channel compliance.
- **Do not send yet** — key context is missing or the message contains a material trust/relationship problem.

Advisory guidance (greeting, optional easy-out, tone) should not become a hard block. Reserve blocking status for explicit issues such as unsupported personal claims, a direct referral request to a stranger, a channel constraint violation, or a message that reveals private information without user intent.

## 7. Relationship and intent rules

| Situation | Recommended next step | Suitable ask | Avoid |
|---|---|---|---|
| Existing colleague, mentor, or known professional | Use the channel already established | Specific feedback, advice, or introduction; referral only when the relationship supports it | Overexplaining the user’s background or forcing an easy-out phrase |
| Alumni or shared cohort | State the real connection and the reason for choosing them | One role/team question; optional short chat if appropriate | Pretending to have a close relationship; defaulting to a referral demand |
| Event/community contact | Refer to the real interaction and its topic | Continue the conversation with one relevant question | Claiming a shared interaction that did not happen |
| Public-work weak tie | Cite one recent, work-related item the user actually reviewed | A focused question about the work or a short observation | Generic praise, personal-life details, or asking for a job immediately |
| Stranger with no specific bridge | Recommend finding a better bridge or using another appropriate route | If there is a real role-based question and an available channel, one concise question | Treating a cold connection request as the standard workflow |
| Recruiter or hiring contact for a live opening | Verify the role, job ID/link, and recipient’s relevant responsibility | One question tied to the actual opening or process | Assuming the person owns hiring or sending an unsupported fit claim |
| Referral from trusted contact | Confirm permission/relationship and live job link; select relevant resume/profile facts | Ask if they are comfortable referring; state truthful fit and include requested materials | Asking an acquaintance to vouch without context or permission |
| Post-conversation thank-you | Send a short note that recalls one real detail and next step | Thank them; optionally confirm the promised follow-up | Generic thanks or an immediate second ask |
| Follow-up with no reply | Allow reasonable time; at most one concise follow-up with new information | A useful update or one easy question; then stop | “Bumping this,” urgency, or repeated nudges |

For follow-ups, use 5–7 days as a configurable starting suggestion from career-service practice, not a universal timing rule. Do not prompt a user to message before a connection is accepted if the selected LinkedIn channel does not permit it. Keep the user in control of whether to follow up.

## 8. Domain-specific examples

Examples are templates with explicit placeholders. They are not intended to imply a real recipient or a conversion guarantee.

### Finance: entry-level credit research

**Context packet:** User is a final-year commerce student targeting credit research; Story Vault confirms a student project comparing two listed companies’ debt coverage; target is an alum who recently published a public post on credit analysis; the user verifies the post and adds its URL.

**Better first message (after a permitted connection/channel):**

> Hi [Name] — I’m a [University] student learning credit research. Your recent post on [specific credit-analysis point] helped me think about [specific question]. I’ve been comparing debt coverage in a class project and would value one suggestion on what a beginner should check next. Thanks, [Name]

Why this is more relevant: it ties an actual piece of the recipient’s professional work to one confirmed user fact and one narrow question. It does not claim that the alum can refer or hire the user. If the note is for an invitation, it must be shortened to the live character limit and should retain the real shared context.

### AI infrastructure: new graduate targeting platform engineering

**Context packet:** User is a new graduate targeting platform engineering; Story Vault confirms a Kubernetes deployment project and a specific reliability trade-off; target is an engineer whose public talk/post covered a related deployment issue; the user verifies the source.

**Better first message (after a permitted connection/channel):**

> Hi [Name] — I’m a new grad building toward platform engineering. I saw your [talk/post] about [specific deployment issue]. In my Kubernetes project I ran into [confirmed trade-off]. What would you inspect first when improving [specific system behavior]?

Why this is more relevant: it shows a direct professional connection without pretending the project is production experience. If the user has no verified recipient anchor, the product should not invent one; it should ask for context or recommend a different contact.

## 9. Data, privacy, and measurement

### Data handling

- Keep the existing no-account, local-first approach for this milestone.
- Local deterministic checks should run on the client and make no network request.
- For optional AI feedback, explain what will be sent, require an explicit action, and send only: selected message text, chosen channel/intent, one or two selected Story Vault facts, the user-entered recipient anchor, and relationship category. Do not send the whole Story Vault or unrelated profile data.
- Do not store raw recipient profile text, screenshots, messages, email addresses, or phone numbers in analytics or a central database. Do not train on user messages by default.
- Keep raw drafted message in memory for the check. If user elects to save a draft, store it locally and provide delete/clear controls.
- Treat pasted profile text, screenshots, posts, and URLs as untrusted input. They may contain instructions or claims; use them only as evidence the user can review, never as directions for Lynkr or as verified truth by themselves.
- Keep current no-LinkedIn-login, no-scraping, no-auto-send boundary. LinkedIn’s prohibition on unauthorized scraping is also documented in its help center. [LinkedIn: Prohibition of scraping software](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?intendedLocale=en&lang=en-us)

### Local outreach tracker

The current Connect Coach tracker can be extended with minimal event fields, while retaining manual control:

- `channel`, `intent`, relationship/bridge type, target role family/domain, user-selected source type, and dates for invitation/message/reply.
- Funnel states should distinguish **target considered → invitation sent → accepted → message sent → reply → useful outcome**. Not every channel has an invitation stage.
- Keep raw message content out of tracking by default. The user can separately opt into local draft history.
- Show the denominator and maturity window, e.g. “3 of 8 invitations accepted; 6 have been pending at least 14 days.” Do not combine acceptance rate with reply rate, and do not present small-sample changes as causal evidence.
- When sample counts are too small, show counts only and explain that there is not enough data for a meaningful comparison. Do not rank domains, message types, or named recipients based on a handful of outcomes.

Potential useful outcome labels: useful answer, conversation booked, introduced to another person, role information gained, referral offered, no reply, declined, or user chose to stop. These measure the user’s goal more fully than “reply/no reply.”

### Do not build a prospect database

This feature does not require a central database of LinkedIn people. Use role/skill taxonomies and manually verified, user-provided context. The existing profile/outreach plans cover role/domain segmentation and non-scraped data sources. For the message checker, data quality and provenance matter more than collecting more names.

## 10. Implementation plan using current architecture

### Phase 0 — Baseline and product discovery (2–3 days)

- Review the current `checkMessage`, `Checker`, `ConnectCoach`, `/api/connect`, Ask Ladder, Story Vault, and acceptance tests before changing interfaces.
- Interview 5–8 Lynkr-relevant early-career users about their last few outreach attempts: who they contacted, why, channel, what they sent, what outcome they wanted, and what happened. Ask for anonymized examples or let the user paraphrase; do not collect private recipient messages without consent.
- Ask users to bring one successful and one unsuccessful example where possible. Do not infer that wording caused the outcome.
- Record baseline task time, completion/drop-off, false positive/negative issues, and whether a user can explain why they chose the recipient.

### Phase 1 — Checker v2, deterministic first (2–4 engineering days)

- Refactor checker rules by channel, intent, relationship, and severity; retain no-key usability.
- Replace simple “fit” keyword detection with explicit user-confirmed context checks and explainable missing-field prompts.
- Trigger referral requirements only for an actual referral ask, not any mention of “refer.” Permit informational messages that happen to use that word.
- Make greeting and easy-out advisory. Make word/character limits channel-specific and configurable.
- Add message preview with exact issue spans and suggested minimal edits. Change verdict wording to preserve the sender’s judgment.
- Keep existing interfaces backward-compatible where practical; add typed/Zod-validated fields for channel, goal, relationship, and selected fact ids.

### Phase 2 — Relevance packet and guided flow (3–5 engineering days)

- Start with a short goal/contact-type chooser, then request only missing packet fields.
- Add reusable role/domain/market preferences and selected Story Vault facts, based on the existing profile and outreach plans.
- Update Connect Coach “who to look for” cards to prioritize user-known/shared-context and role-relevant categories; explain why each category fits. Keep cards nameless and user-searchable.
- Share the same packet between Connect Coach and Message Checker so users do not re-enter facts.
- Pass only user-selected facts to `/api/connect` when they explicitly request an AI draft/review. Keep the pure local checker separate.

### Phase 3 — Minimal local outcome tracker (1–2 engineering days)

- Extend the existing Connect localStorage model with channel, intent, target role segment, and event dates; do not create server-side prospect storage.
- Support manually marking accepted/replied/useful outcome and stopping follow-up.
- Show raw counts and mature denominators before showing rates; clearly explain what the rate measures.
- Add clear/delete controls and do not persist message content by default.

### Phase 4 — Optional AI review and measured pilot (after provider key, spend cap, and consent flow)

- Use the existing provider-agnostic wrapper and Zod response validation. The model may assess semantic relevance and suggest a small rewrite; it must not decide facts are true, invent shared context, select named targets, or send a message.
- Make AI review opt-in and display a concise data-use notice immediately before the request. Demo mode should say semantic AI is unavailable; do not simulate AI confidence as a true result.
- Pilot with 10–20 early-career users across at least three role/domain groups for 2–4 weeks. Treat this as usability and feasibility learning, not a powered conversion experiment.
- Have humans review blinded drafts for grounding, appropriateness, clarity, voice preservation, and false flags. Measure completion and user acceptance of edits separately from reply outcomes.
- Only consider message outcome comparisons after enough mature attempts per segment. Do not make causal claims from small, self-selected samples; recipient quality, timing, channel, and job-market conditions all confound outcomes.

Phases 1–3 can be implemented without a database or model spend. Do not expand into scraping or automated sending to “improve personalization.”

## 11. Acceptance criteria

### Contact and context

- A target recommendation explains the role/domain match and asks the user to verify the current title/context.
- A generic “works at my target company” statement is not treated as a strong recipient-specific reason.
- If the user has no real bridge or current professional anchor, the flow recommends another channel, a stronger reason, or holding off.
- The system never generates named prospects from scraped/search data.

### Message review

- A bare mention of “referral” does not trigger referral-request rules; an explicit direct referral ask from a stranger is flagged with an explanation and safer alternative.
- Greeting and exact easy-out wording are optional unless a specific channel/relationship makes them material.
- A short connection note is checked by characters for the configured current channel limit; an email is not forced into that same character rule.
- Unsupported user experience, recipient claims, or shared history are highlighted rather than silently rewritten as facts.
- The checker returns at least one concrete edit for an actionable issue, with a short reason; it preserves the rest of the user’s voice where possible.
- It can say “not enough context” instead of falsely approving a generic or fabricated personal message.
- No message is sent automatically, and no local-only check makes a network request.

### Privacy and AI

- The AI request contains only the user-selected message/context and selected Story Vault fact(s); it never receives the whole vault by default.
- AI use is explicit and has a visible data-use explanation. No key means no claim of semantic AI review.
- No raw recipient text or user draft is written to analytics/server storage by default.

### Learning and claims

- Acceptance and reply metrics are separated; the UI shows numerator, denominator, and waiting period.
- Small samples display counts rather than confident rate comparisons.
- Product copy makes no guaranteed outcome or conversion-lift claim.

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Checker “approves” a weak target because the prose is polished | Separate contact decision from copy review; no opaque score or promise |
| User invents a connection or recipient-specific detail to satisfy the form | Require user confirmation and provenance; never auto-fill claims |
| Personalization feels invasive | Only use professional public work or a genuine shared interaction; exclude personal-life details |
| Too many rules make the product sound robotic | Make style advice advisory; show a small edit and preserve voice |
| Cold invitations lead to poor experience or platform restriction | Prioritize people the user knows; explain channel/relationship fit and LinkedIn guidance |
| A high/low reply rate is interpreted as proof of message quality | Show small-sample limits and separate target/channel/timing effects; do not claim causality |
| Domain taxonomy becomes stale or too broad | Keep role labels editable and user-confirmed; start with a small set of target functions |
| AI hallucinates recipient facts or misreads pasted content | Ground generation in supplied evidence; mark uncertainty; opt-in; human review required |
| Measurement encourages volume or spam | Track useful outcomes and stopping behavior, not outreach volume as a success metric |

## 13. References and existing Lynkr artifacts

### External sources (accessed 17 October 2026)

- [LinkedIn Help: Connecting with Other Members—Best Practices](https://www.linkedin.com/help/linkedin/answer/a1340458/connecting-with-other-members-best-practices?lang=en)
- [LinkedIn Help: Various ways to connect with people](https://www.linkedin.com/help/linkedin/answer/a541669)
- [LinkedIn Help: Prohibition of scraping software](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?intendedLocale=en&lang=en-us)
- [UC Berkeley Career Engagement: 5 Tips for Reaching Out](https://www.career.berkeley.edu/prepare-for-success/networking/5-tips-for-reaching-out/)
- [UT Austin Career Services: Professional Correspondence](https://careerservices.cns.utexas.edu/resources/professional-etiquette/professional-correspondence)
- [Dartmouth Center for Career Design: Networking Templates, Sample Questions & Interview Follow-Up](https://careerdesign.dartmouth.edu/resources/networking-templates/)
- [Playful AI in Professional Email: A Field Experiment on Tone and Recipient Engagement (2026 preprint)](https://arxiv.org/abs/2607.11749)

### Existing Lynkr materials to extend

- `app/prod/lynkr-outreach-intelligence-plan.md`
- `app/prod/lynkr-profile-fix-intelligence-plan.md`
- `app/prod/lynkr-posts-comments-intelligence-execution-plan.md`
- `app/research/spec-connect-coach.md`
- `app/research/spec-ask-ladder.md`
- `app/research/acceptance-tests.md`
- `app/research/validation-report.md`
- `app/research/reddit-pain-points.md`
- `app/lib/checker.ts`, `app/components/Checker.tsx`, `app/components/ConnectCoach.tsx`, and `app/lib/connect.ts`

This plan intentionally improves Lynkr’s existing local checker, Connect Coach, Ask Ladder, and Story Vault flow. It does not propose a new prospect database, scraping pipeline, automated outreach, or a guaranteed conversion engine.
