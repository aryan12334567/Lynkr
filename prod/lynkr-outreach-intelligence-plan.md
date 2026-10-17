# Lynkr Outreach Intelligence

## Domain-matched discovery, relevant messages, and learning from outcomes

**Updated:** 17 October 2026  
**Status:** Proposed product and execution plan; no new behavior is implemented by this document.  
**Primary user:** Indian students, new graduates, and early-career job seekers.  
**Related product:** Outreach tab, Connect Coach, Story Vault, Message checker, and local people tracker.

## 1. Product decision

Help a user identify one person who makes sense for their specific goal, understand why this person is relevant, and write a short message grounded in a real shared point. Do not build a large scraped contact database, auto-send connection requests, or promise that personalization will guarantee a reply.

“Relevant” has to include the user's target function, role, specialization, career stage, market, and objective. A finance graduate exploring equity research should not be matched to an AI infrastructure leader merely because both are professionals on LinkedIn. The person may be a mentor, peer, alumni, practitioner, or hiring manager; “top LinkedIn creator” is not automatically the right outreach target.

Use the user's own confirmed profile and Story Vault, plus a small piece of context that the user has selected about the individual. If that context does not establish a genuine reason to reach out, ask for more context or suggest not sending a note.

## 2. What exists today

- The app already creates “who to look for” cards that describe types of people and open LinkedIn people-search links; it does not return named prospects.
- Connect Coach writes a connection note of 200 characters or fewer from user-pasted profile text or a screenshot. A profile URL alone cannot be opened. The user sends everything themselves.
- Outreach already has a relationship-aware ask ladder (stranger, alumni, someone who knows the user), follow-up drafts, a deterministic message checker, a monthly note budget, and a one-at-a-time tracker.
- The repository's approved boundaries exclude scraping, auto-messaging, and bulk outreach. The AI path has not yet been quality-checked with a real provider key.

The next step is to improve context collection and learning from outcomes, while retaining the current manual discovery and sending model.

## 3. Why personalized messages still get low conversions

Personalization can be superficial. A name, company, or compliment does not explain why this person should respond to this user now. Low response can also be caused by an unclear or high-effort ask, no credible bridge between the two people, a stale trigger, the wrong recipient, timing, a full inbox, a weak profile, or a recipient who is not taking messages. Lynkr cannot observe all of these factors.

Diagnose the outreach as a funnel before changing message style:

1. **Target fit:** is the person in the user's target role/domain and at a useful career stage?
2. **Reason to contact:** is there one authentic, current point of connection?
3. **Credible bridge:** can the user explain why they are asking using their own facts?
4. **Ask friction:** is there one clear, small ask appropriate to the relationship?
5. **Execution:** did the user send it, and was it received/answered?

If a stage is unknown, label it unknown. Do not explain silence as proof that the user did something wrong or that the recipient owes a response.

## 4. Collect just enough context

Reuse the Profile Fix content profile and Story Vault. Ask the user once for the goal and target cohort; then ask only for recipient-specific evidence when preparing a message.

### Reusable outreach brief

Collect or confirm:

- Confirmed target role, function, specialization, industry context, market/location, and career stage.
- Current goal: learn about a role, ask a focused work question, build a peer relationship, explore a team, discuss a specific live job, or request a referral from someone who knows the user.
- Target company/team or type of professional, if known.
- One or two truthful facts from the user's Story Vault that explain their interest or fit.
- What they can offer or contribute, if relevant; do not force a value proposition for a student simply asking to learn.
- Preferred style/voice, copied from the user's own writing rather than abstract tone labels.
- Contact limits and constraints, such as no call request, no public job-search signal, or no follow-up.

### One-person context card

Before a message can be generated, collect the smallest useful set:

1. **Who is this person in the user's own words?** Role/team/company and approximate relationship (stranger, alumni, previously interacted, knows me). The name is optional until the user chooses to fill it.
2. **Why this person?** Select a real reason: target role, same community, work the user wants to understand, relevant project, job/team, event, or a prior interaction.
3. **What is the specific anchor?** The user writes a one-sentence observation about a post, talk, project, publication, or role. Optionally include a source title and URL for their own reference. Do not fetch the URL.
4. **What does the user want to ask?** Choose or write one low-friction ask. Ask for a brief answer in LinkedIn by default; request a call only when the relationship/context supports it.
5. **What is the honest bridge?** Select one user-confirmed Story Vault fact, or type one sentence. Do not send the whole Vault.

Target under 90 seconds per person after the reusable brief. Let the user skip any field and make the draft say what is unknown instead of guessing. The app should not request private messages, email addresses, phone numbers, profile credentials, or a recipient's personal background.

## 5. Find relevant people without building a people database

Keep discovery user-led. Generate search intent, not named-person lists.

### Search-card dimensions

Create a small number of editable cards combining:

- Role/function + specialization (for example, “FP&A analyst” or “ML platform engineer”).
- Company/team type or industry context, only if relevant to the user's goal.
- Career stage/relationship (peer, practitioner, alumni, team lead, hiring manager).
- Geography or remote market chosen by the user.
- A reason this group might help with the goal.
- A search link or source type the user opens themselves.

Generate at most 3–5 starting queries rather than 5–8 weak cards. Use the existing LinkedIn people-search URL builder and let the user edit keywords. Include other user-operated routes where appropriate: a university alumni directory, a professional association directory, a conference/speaker list, an official company team page, or a public portfolio/open-source project. Respect each source's terms and access controls; do not crawl or harvest it.

### Examples of matching intent

| User's target | Useful people to look for | Evidence to bring back |
|---|---|---|
| Finance graduate targeting equity research in India | Equity research associates/analysts who cover the relevant sector; alumni in research; early-career analysts willing to talk about the work | A user-read earnings note, sector report, talk, job description, or specific public question about research process. |
| Early-career engineer targeting AI infrastructure | Platform/ML infrastructure engineers, inference/reliability practitioners, or maintainers of relevant open-source systems | A user-read project, technical talk, engineering article, or concrete question about a system tradeoff. |
| Student exploring product analytics | Product analysts or data practitioners in the target product type and market; alumni or peers with comparable entry paths | A public case study, metric decision, analytics project, or relevant job requirement. |

These are search archetypes, not a ranking of people. Keep role, industry, stage, and geography separate. If the user is exploring two fields, let them create two target briefs instead of blending them into one generic audience.

### Do not produce a prospect list from collected member data

Do not import a user's LinkedIn connections CSV to rank or mine their contacts in the first release. The export may include other people's names, companies, and emails; the user downloading it does not automatically establish that Lynkr may create a searchable third-party database. A user can manually record a person they already know, with only a local label and relationship type.

Do not recommend third-party LinkedIn scraping products as a workaround. A vendor's access to data does not transfer platform permission or the person's permission to Lynkr.

## 6. Message construction and quality gate

### Required evidence

A draft should use:

- **Recipient context:** one precise, user-supplied fact from something the person made public or a confirmed shared context. Record where the user saw it and when, if known.
- **User bridge:** one relevant, confirmed fact from the user's profile/Story Vault.
- **Reason:** one sentence explaining why this contact is useful to this user's goal.
- **Ask:** exactly one modest request, matched to the relationship.
- **Easy out:** respectful permission not to respond; no pressure or artificial urgency.

The anchor is not “I admire your journey.” Prefer an observation that proves the user engaged with a concrete piece of work. Do not make up shared interests, alumni status, a post, an accomplishment, a hiring need, or the recipient's opinions. Do not imply that a public page was personally recommended to the user.

### Relationship-aware ask ladder

| Relationship | Default first ask | Rules |
|---|---|---|
| Stranger | One specific question about their work or a piece of work the user selected. | No referral, job, or call request in the connection note. No claim of familiarity. |
| Shared college/community or prior light interaction | A focused question or optional short informational chat. | Mention the shared context only if confirmed; a call is optional, not assumed. |
| Someone who knows the user | A direct ask appropriate to the relationship. | A referral request needs a live job ID/link, a truthful fit, resume mention where relevant, and a clear easy out. |
| Hiring manager/recruiter | One focused question about a specific team/role or a short expression of fit. | Do not claim an application was reviewed or that the person owns a hiring decision unless confirmed. Do not attach or demand a resume in a connection note. |

Keep the current Lynkr default note ceiling at 200 characters for its first release, with a live character counter and a configurable internal limit. Verify LinkedIn's current invitation-note rules before launch and avoid hard-coding membership-specific allowance/credit claims; limits and product surfaces can change. If the message needs more context, save it for a post-acceptance message instead of cramming it in.

### Example structure (illustrative, not real people)

- **Finance:** “Hi [Name]—I’m a finance grad exploring equity research. Your [report/post] on [topic] stood out. What do you check first when assessing cash conversion?”
- **AI infrastructure:** “Hi [Name]—I’m a CS grad exploring AI infrastructure. Your [talk/project] on [topic] stood out. Which bottleneck would you test first in a small inference stack?”

The bracketed anchor must come from something the user actually reviewed. If the user cannot supply it, ask for one; do not invent a “personalized” detail from a profile URL.

### Output contract

Return one message and a short rationale the user can inspect:

```text
OutreachDraft {
  channel: connection_note | after_accept | direct_message | follow_up
  body: string
  charCount: number
  personContextRefs: string[]
  userFactRefs: string[]
  whyThisIsRelevant: string
  fitStatus: ready_for_review | needs_context | do_not_send
}
```

The deterministic checker should validate relationship, word/character limits, one ask, easy out, unsupported blanks, and forbidden cold referral language. It must not declare that a message will convert. If the message lacks an authentic bridge or source anchor, return `needs_context` or `do_not_send`; never fill the gap with praise or generic flattery.

## 7. Learn from low conversion without fooling the user

### Track separate funnel stages

Use the existing local people tracker, but distinguish:

1. Person found / considered (not a conversion denominator).
2. Invitation sent.
3. Invitation accepted, declined, or no response after a user-selected observation window.
4. Post-accept message sent.
5. Any reply, then optionally a useful conversation or next step.

Keep “accepted connection” separate from “message reply” and “useful conversation.” A reply is not necessarily a positive outcome; a non-reply is not necessarily a message failure.

### Minimal outcome data

Record locally by default: user's segment (role/domain/stage/market), relationship, source type, reason to contact, anchor type, ask type, note/no-note, send date, chosen outcome, and when the outcome was observed. Do not store the recipient's reply, private conversation, email, phone, full profile, or full message by default. If the user wants to keep a sent message, make it a separate, explicit local save.

Show rates with denominators and mature cohorts, such as “2 accepted of 8 invitations sent more than 14 days ago.” Use separate windows for acceptance and reply; label them as exploratory and let the user adjust them. With low counts, show counts and observations rather than a conversion percentage or advice that implies causality. Never compare a finance cohort with an AI infrastructure cohort or compare a new graduate's network to a senior professional's network.

### Diagnose before rewriting

When the user reports low results, ask which stage is low:

- **Few useful people found:** improve role keywords and search archetypes.
- **Low acceptance:** review audience/target fit, relationship strength, note length, and whether the invitation has a genuine context.
- **Accepted but no reply:** review whether the first post-acceptance ask is relevant and low effort, and whether the user sent it promptly without pressure.
- **Replies but no useful next step:** clarify the user's goal and conversation ask.
- **No reliable denominator:** recommend manual tracking for a small, time-bounded sample before changing the product.

Do not use an AI “conversion score,” scrape response data, or claim that a message rewrite caused a change. A future experiment would need one preselected outcome, sufficient users/messages, consent, and a review of selection bias; it is out of scope now.

## 8. Data sources and database architecture

### Build a relevance system, not a personal-data warehouse

Keep these data layers separate:

1. **Occupation and skill taxonomy:** canonical functions, role aliases, specializations, and skills. Maintain source, version, market, and last-checked date.
2. **Search patterns:** role archetypes and editable keyword combinations (no person's name or profile). Store no more than the user needs to generate a search.
3. **Reference material:** only opt-in/licensed practitioner examples or allowed material; a separate project from this outreach MVP.
4. **User's personal outreach records:** keep in localStorage in phase 1, one person at a time. Never mix it into the shared taxonomy/reference store.
5. **Outcome events:** local counts/labels only. Do not pool messages or response data for model training by default.

Suggested initial schemas:

```text
RoleSearchPattern {
  id, taxonomySource, taxonomyVersion, function, role, specialization,
  industry?, market?, careerStage?, targetTypes[], queryTerms[],
  reason, sourceKinds[], checkedAt
}

LocalProspect {
  id, userLabel, role?, team?, company?, relationship,
  userReason, sourceTitle?, sourceUrl?, sourceDate?,
  userContextNote?, selectedStoryFactIds[], status, createdAt
}

OutreachAttempt {
  localProspectId, channel, sentAt, characterCount,
  relationship, anchorType, askType, noteUsed,
  outcome: unknown | accepted | declined | replied | no_reply | useful_conversation,
  outcomeObservedAt?
}
```

Do not persist raw pasted context in `LocalProspect`; keep it in request memory unless the user explicitly saves the draft locally. If Lynkr later adds accounts and server storage, define purpose, user notice, access controls, retention, correction/deletion, export, breach response, and third-party processor terms before migrating local records.

### Sources that can improve role matching

- [India's National Classification of Occupations 2015](https://www.ncs.gov.in/documents/national%20classification%20of%20occupations%20_vol%20i-%202015.pdf) for Indian occupation names/codes; check currency and mappings before use.
- [NSDC National Occupational Standards / Qualification Packs](https://www.nsdcindia.org/national-occupational-standards) for role functions and performance/knowledge expectations; check revision and retirement status.
- [ESCO](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api) for international occupation and skill vocabulary.
- [O*NET](https://www.onetcenter.org/database.html) for US role data, explicitly labelled as US context.
- User-selected job descriptions and public projects/articles that the user manually reviews; process transiently for their request, do not harvest them into a shared corpus.
- Alumni or professional directories only through their intended, authorized access and with no bulk export unless their terms and consent allow it.

For finding individuals, rely on searches the user performs in LinkedIn, communities, event sites, or employer pages. Lynkr can generate query links but does not fetch the results. A public URL is a user navigation aid, not permission to crawl its content.

## 9. Scraping, APIs, and privacy boundaries

**No scraping.** LinkedIn's published rules prohibit software that scrapes/copies profiles and other service data, unauthorized automation, and using third-party scraping/data brokers as a route to copy member data without the required consent. Do not build crawlers, browser extensions, logged-in page readers, proxies, or scrape-to-CRM pipelines. This also avoids exposing users to account restrictions and avoids a database that Lynkr cannot lawfully or reliably maintain.

This is the product's platform-risk decision, not a claim that every form of web scraping is criminal everywhere. Contract, privacy, copyright, database-rights, and computer-access rules depend on jurisdiction and facts. Public visibility alone is not a blanket license. Any exception would need current platform permission and jurisdiction-specific legal review; a vendor or user-uploaded copy does not automatically resolve those issues.

LinkedIn APIs are not a shortcut to a searchable prospect database. API use requires authentication; most products require LinkedIn approval. Its Profile API says access is restricted to approved developers, and data for a member other than the authenticated member may not be stored. Generally available OpenID `profile` permission is limited to the authenticated member's name, headline, and photo. Do not assume Lynkr will get access to Sales Navigator, member search, or third-party profile data.

The current Connect Coach permits the user to paste a headline/About/recent post or upload a screenshot for one note. Keep any such material transient and user-selected, and do not use it to seed a person database. LinkedIn's wording also restricts copying/using content obtained directly or through third parties; before scaling that interaction, have counsel review it. A stricter fallback is to ask the user to enter their own short observation, role, source title, and URL without pasting or uploading LinkedIn content.

Sources checked 17 October 2026:

- [LinkedIn: Prohibited software and extensions](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?intendedLocale=en&lang=en-us)
- [LinkedIn: User Agreement](https://www.linkedin.com/legal/user-agreement)
- [LinkedIn API access and approval](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
- [LinkedIn Profile API data restrictions](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api?view=li-lms-2025-04)

India-first privacy engineering should cover clear purposes and notices, minimization, user control, withdrawal and deletion, processor boundaries, retention limits, and an incident response. The DPDP Act and Rules have phased commencement: the 13 November 2025 Gazette schedules many core provisions for 13 May 2027, while some provisions commence earlier. Confirm any later notification and applicable provisions with Indian privacy counsel before launch; this spec is not legal advice.

- [Official Gazette: DPDP Act phased commencement, G.S.R. 843(E)](https://egazette.gov.in/WriteReadData/2025/267647.pdf)
- [Official Gazette: DPDP Rules, G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [Digital Personal Data Protection Act, 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)

## 10. Practical execution sequence

Estimates assume one engineer familiar with Lynkr and exclude model/provider evaluation, recruiting, and legal review.

### Phase 0 — Validate the failure mode (1–2 days)

- Interview 5–8 people who have sent recent cold or warm LinkedIn invitations, including people in different domains and career stages.
- Ask them to reconstruct the last 3–5 attempts: target reason, source, relationship, exact ask, sent/accepted/replied status, and what they think happened. Do not collect private recipient replies.
- Test whether they need better target discovery, stronger reason-to-contact, ask calibration, or profile readiness.
- Define the observation windows and manual tracker labels before writing a conversion feature.

**Exit:** a documented list of user-observed breakdowns, with domains and counts; no claim of a population-wide conversion rate.

### Phase 1 — Improve search intent and outreach brief (2–4 days)

- Refine “who to look for” from role/domain/stage/location/goal, with 3–5 editable search cards.
- Add the reusable outreach brief and one-person context card, reusing profile and Story Vault data.
- Keep discovery in the user's browser/platform and preserve current manual-send behavior.

**Exit:** a user can explain why each search archetype is relevant and can edit/remove it.

### Phase 2 — Improve message quality and checker (3–5 days)

- Generate one context-grounded connection note with source/fact references and a `needs_context` / `do_not_send` outcome.
- Keep the existing relationship-aware ask ladder. Add the different post-acceptance message step only when there is a real reason to continue.
- Align the deterministic checker to relationship, invitation character count, one ask, easy out, unsupported blanks, and cold-referral restrictions.
- Keep the draft editable and copy-only.

**Exit:** five fictional examples each in finance, AI infrastructure, and one non-technical domain pass a factuality/relevance review; missing anchors stop generation rather than receiving generic praise.

### Phase 3 — Outcome tracker and small pilot (2–3 days implementation; 1–2 weeks calendar time)

- Add explicit local funnel stages and time windows; do not store reply content.
- Pilot with 5–10 users and a manageable number of one-to-one contacts. Collect only what is needed to diagnose the funnel.
- Show counts and denominators. Keep all results local and clearable.

**Exit:** users can report their stage without confusion; no external database or conversion claim is needed to make the feature useful.

### Defer — shared outreach intelligence

Do not build a shared prospect database, message library trained on private DMs, vector index of LinkedIn people, campaign tool, team CRM, or automated follow-up in this slice. Revisit only if users explicitly ask for it and there is a lawful, permissioned data source and credible evidence of value.

## 11. Acceptance and evaluation

- Search cards distinguish function, role, specialization, industry, market, seniority, and relationship; user can correct them.
- Every target suggestion says why it fits the user's stated goal and opens a user-operated search/source.
- No named people are fabricated or sourced by scraping.
- A connection note's unique anchor comes from the user's own confirmed observation or explicitly supplied context; the app does not invent a recipient's post or project.
- The user fact used in the note is traceable to their confirmed Story Vault/profile, and the user can remove it.
- A stranger note never asks for a referral, job, or call by default. The ask ladder checks relationship first.
- Missing context returns a question or “do not send,” not praise or boilerplate.
- The app never sends, schedules, likes, comments, or automates an action on LinkedIn.
- Accepted connections, replies, and useful conversations are measured separately with visible denominators and observation dates.
- All person/outcome data stays local, can be edited/deleted, and is not used to train shared models.
- The feature does not claim an increase in acceptance/reply rates without an appropriate evaluation.

For the pilot, record target fit, whether the user could name a real reason to contact, checker corrections, user comfort with the final note, and stage counts. Treat small samples as formative. Do not scale based on one success story or change message strategy just because an immature cohort has few replies.

## 12. Risks and responses

| Risk | Response |
|---|---|
| “Personalized” reads as creepy or over-researched | Use one work-related anchor the user chose; avoid personal-life facts, excessive detail, and false familiarity. |
| Broad target matching repeats the user's low response rate | Match function, specialization, stage, market, and objective before offering search terms. |
| Recipient context is stale or wrong | Ask when/where the user saw it; surface the anchor and let the user correct it. Do not fetch a profile URL. |
| Low response is blamed on message quality alone | Separate target, invitation, reply, and useful-conversation stages; account for non-message factors. |
| Tiny sample looks like a conversion model | Show raw counts, denominators, and windows; suppress conclusions from small cohorts. |
| Shared database turns into scraping or sensitive targeting | Keep user target records local; only use reviewed taxonomy and permissioned reference assets. |
| Follow-up feels like pressure | One user-controlled follow-up at most by default; let users disable it and respect no-response. |
| Personal details or private correspondence are retained | No raw replies, emails, phone numbers, or full pasted profiles in analytics or shared data. |

## 13. Immediate next steps

1. Run the small failure-mode interview and record stage-level findings by role/domain.
2. Update the Connect Coach intake and search cards around confirmed role/domain and user goal.
3. Add evidence-gated message generation and checker reasons; preserve the human send step.
4. Upgrade the local tracker to record funnel outcomes and denominators without collecting message threads.
5. Reassess whether any shared database is needed only after the pilot.

## 14. Source and scope boundary

LinkedIn access rules, API permissions, and official occupation references were checked on 17 October 2026. This plan recommends no scraping and does not assume API approval. Existing product behavior is summarized from the repository's context and Connect Coach spec. New questionnaire fields, database schemas, conversion learning, and benefits remain proposals until built and evaluated.
