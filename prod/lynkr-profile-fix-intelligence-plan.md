# Lynkr Profile Fix Intelligence

## Personalized product and execution plan

**Updated:** 17 October 2026  
**Status:** Proposed product slice; this is a design, not an implementation claim.  
**Primary user:** Indian students, fresh graduates, and early-career job seekers.  
**Related product:** the existing Profile fix tab, interview, Story Vault, and post/outreach flows.

## 1. Product decision

Build a role-specific profile diagnosis from the person's own LinkedIn profile export, goals, interview answers, and optionally one or two job descriptions they are targeting. Tell the user what to change, where to change it, why it matters for their chosen role, and show a proposed replacement they can review.

Do not rank the user's profile against a generic “top LinkedIn profile” score. A finance graduate applying to equity research should be assessed against evidence that matters for early-career equity research in their market, not against an AI infrastructure leader. Use a small, explainable role rubric and optional, permissioned reference examples. “Top performer” is not an objective category Lynkr can establish from likes, followers, or profile visibility.

Do not scrape LinkedIn or buy scraped profile datasets. Build a role-and-skill knowledge base, not a database of LinkedIn members. Make the user the source and reviewer of their own profile data.

## 2. What exists today

- The app already generates three headline options, an About draft, and profile gaps from the interview and optional pasted headline/About text.
- Setup asks for the user's target role, background, and optional LinkedIn headline/About. Results are mock-validated; a real-AI quality evaluation has not been completed.
- The current app has no account or server database. User state stays in localStorage; answers sent to AI are disclosed as provider processing.
- LinkedIn archive import is currently out of scope in the approved v1 context.

The next version adds grounded diagnosis and a controlled export importer. It should reuse the Story Vault and ask only for missing profile facts instead of repeating the interview.

## 3. Define the comparison context before judging the profile

The intake should separate fields that users often conflate:

| Dimension | Example | Why it matters |
|---|---|---|
| Function / occupation | Equity research analyst; FP&A analyst; credit risk analyst; AI platform engineer | Determines the work evidence and vocabulary to review. |
| Industry / subsector | Banking; asset management; SaaS; cloud infrastructure | Adds context, but does not replace the function. |
| Career stage | Final-year student; new graduate; 0–2 years; career changer | Sets a fair bar for evidence. A fresher should not be scored like a director. |
| Market and location | India; Bengaluru; remote roles in India | Role terminology and location preferences can differ. Ask; do not infer. |
| Goal and reader | Internship; job; networking; recruiters; team leads | Controls the order and emphasis of fixes. |
| Target evidence | One or two user-selected job descriptions, if available | Gives a current, concrete keyword/evidence reference. Never claim to know LinkedIn's ranking algorithm. |

Use a short form with editable suggestions: target role, function domain, optional industry/subsector, career stage, job-search goal, preferred market/location, and intended reader. Ask the user to confirm the role/domain suggestion. Support “mixed,” “other,” and “not sure.” Do not infer a domain, seniority, salary, or job-search status from a photo, name, college, gender, language, or location.

For example, “finance” is still too broad. Ask whether the user is targeting financial planning and analysis, investment banking, audit, credit/risk, corporate finance, or research. Likewise, separate AI research from data engineering, ML engineering, platform/infrastructure, and product roles. A role rubric should only be applied after the user confirms the match.

## 4. User flow

1. **Choose the goal.** Select a target role and market, confirm the suggested function domain, choose an intended reader, and optionally add a current job description. Let the user say what they do not want made public.
2. **Import their own profile.** Offer a LinkedIn data archive upload, manual paste, or skip. Explain that the app reads only profile-related fields, not messages, connections, or account activity.
3. **Preview before processing.** Parse the archive in the browser. Show the recognized files and fields; let the user select what to use. Ignore or reject everything outside the allowlist. Never upload the raw archive to the server or an AI provider.
4. **Resolve only missing facts.** Reuse the Story Vault for projects, impact, constraints, and proof. Ask short questions only when a rewrite needs a fact the Vault/profile does not contain. Distinguish the user's contribution from the team's work. “No measured result” is valid.
5. **Review a prioritized diagnosis.** Show up to three “Fix first” items, then a complete section-by-section checklist. Each item includes the current signal, the specific gap, a suggested edit, why it fits this target, its evidence source, and a confidence label.
6. **Edit and approve.** The user changes or accepts each item. Do not write directly to LinkedIn. Let the user copy one field at a time and mark an item complete.
7. **Check public visibility.** Provide a manual checklist for the user's public-profile visibility, photo visibility, custom URL, and Open to Work settings. Lynkr cannot verify the setting unless the user shows it.

### Upload rules

- Accept only the user's own LinkedIn export. LinkedIn describes its download as the member's own data; it does not provide other members' data in that archive.
- Prefer the user choosing a profile-only export in LinkedIn. If they upload a larger ZIP, parse locally and process only allowlisted profile sections such as profile, positions, education, skills, projects, courses, certifications, publications, honors, and volunteer experience when present.
- Never read or send messages, connections, connection emails, contacts, account history, ad-targeting data, or inferred-data files. Do not accept a connections CSV as an outreach database.
- Show parsed values in a preview and require confirmation before any selected text goes to the configured AI provider. The notice names the exact categories being sent.
- Keep raw ZIP/CSV bytes in browser memory only. Do not put the archive, photos, parsed profile, or source job description into localStorage, analytics, or logs. User-approved draft text may be saved locally only with an explicit save action and must be removed by “Clear everything.”
- If parsing fails, offer manual paste and a downloadable field-by-field checklist. Do not ask for a LinkedIn password, cookie, session token, or login.

## 5. Profile review: every relevant surface

Review the sections below against the selected goal and role. Mark each **Strong**, **Fix first**, **Optional**, **Not applicable**, or **Cannot assess**. Do not treat filling every section as the goal.

| Profile surface | What Lynkr checks | Specific help Lynkr may offer | Guardrail |
|---|---|---|---|
| Name, introduction, and target role | The profile makes the person's current stage and intended professional direction understandable. | Flag missing or conflicting role context; offer an accurate target headline. | Never suggest misrepresenting a current job, degree, or seniority. |
| Headline | Reader can identify role, function, and substantiated specialization quickly. | Draft 2–3 concise, role-specific options using user-confirmed skills and target terms. | No keyword stuffing, inflated labels, “guru,” or claims unsupported by the profile. |
| Profile photo | Presence, crop, sharpness, lighting, face visibility, and distracting background, only if the user supplies a photo. | Neutral technical feedback such as “the crop is very wide; a closer crop may read more clearly at thumbnail size.” | Do not score attractiveness, skin tone, perceived age, gender, disability, beard, body, or “culture fit.” Facial hair is not a profile defect. No claim that changing appearance increases hiring. |
| Background / cover image | Image legibility, relevance to the user's target, clutter, and whether important text is obscured. | Suggest a simple visual direction or safe crop, not a fabricated personal brand. | Check that the user owns or may use any proposed image/logo. No image is required. |
| Location, industry, custom URL, and visibility | Whether location/industry support the user's target and whether public visibility choices fit their preference. | Flag missing or inconsistent fields and explain how to check public visibility / custom URL manually. | Do not assume the user wants a public profile or expose private contact details. LinkedIn controls these settings and interface labels can change. |
| Open to Work / job preferences | Target titles, locations, employment types, start date, and visibility match the user's stated search. | Give a checklist of options for the user to verify in LinkedIn. | Explain the visibility tradeoff. Recruiter-only visibility is not a guarantee of complete privacy. Do not expose salary or notice period in generated copy. |
| About | The reader sees direction, relevant proof, skills grounded in examples, and a low-pressure next step. | Draft a short structure: direction → evidence/story → relevant capabilities → optional contact/ask. Preserve the user's voice. | No generic “passionate,” unsupported superlatives, life story requirements, or forced CTA. |
| Experience | Titles/dates are clear; bullets distinguish personal contribution, action, tools, and evidence/result. Include internships, part-time work, volunteering, and relevant extracurricular work when real. | Rewrite a selected bullet; identify vague “responsible for” wording; ask for an artifact or result only if missing. | Never invent metrics, ownership, scope, tools, or company impact. Preserve “we” where attribution is collective. |
| Education | Degree, institution, specialization, dates, and relevant coursework/project are clear for the user's stage. | Suggest a relevant course/project only when the user supplied it and the target role benefits. | Never rank colleges or imply college prestige determines ability. Do not expose grades unless the user wants them shown. |
| Projects and Featured | A relevant artifact is easy to find and the project explains problem, role, method, result, and link. | Suggest the best one or two user-owned projects to feature and the exact missing context. | Check links are user-approved and public; warn against uploading confidential code, customer data, or employer material. |
| Skills and endorsements | Skills are supported by experience/projects and align with the target role or chosen job description. | Order a small relevant set; distinguish demonstrated skills from “learning” topics; identify gaps as learning opportunities. | Do not pad the list or imply an endorsement is proof of competence. Do not claim a secret LinkedIn search-weight formula. |
| Licenses, certifications, and courses | Credential name, issuer, date, validity, and relevance are clear. | Flag expired/unclear credentials and help prioritize relevant credentials. | Never invent credentials or recommend paying for a course without a user need. |
| Recommendations | Recommendations exist and support the user's target, if they choose to request them. | Offer an optional, respectful request template specifying a real project or collaboration. | No fabricated recommendation, fake endorsement, or pressure on a recommender. |
| Publications, patents, honors, languages, volunteering, organizations, causes, test scores, services, career breaks | Relevant real evidence is present where it supports the goal. | Suggest an optional section only when the user has a real item and the section is relevant. | Do not tell users to fill every section. Career breaks and personal causes are optional; never require an explanation. |
| Recent activity / posts | Optional activity is consistent with the user's target and gives credible evidence of work or learning. | Suggest a post using the existing Story Vault or point to a specific unsupported claim. | Do not require a posting schedule or equate activity/likes with profile quality. |
| Contact information | A recruiter or intended contact has a safe way to respond, if the user wants one. | Suggest a professional contact route the user explicitly chooses. | Avoid public personal phone/address details; never infer or reveal hidden information. |

For image feedback, begin with user-controlled technical checks and make visual analysis optional. The user chooses the image and may dismiss advice. Never prescribe shaving, growing a beard, changing facial features, or changing identity presentation as a hiring tactic. If a user asks about grooming, answer neutrally and separate personal preference from profile image quality.

## 6. Role-specific benchmark system

### What “benchmark” means

Benchmark against three evidence layers, in this order:

1. **The user's chosen target roles and job descriptions.** These are most relevant to the current application. Extract a short list of role terms and evidence requests, show the source, and let the user confirm relevance. Treat job descriptions as transient input; do not silently add them to the shared corpus.
2. **Maintained occupational and skill references.** Use an appropriate taxonomy to normalize role names and skills, not to prescribe a universal LinkedIn profile. India-first options include India's NCO 2015 and NSDC National Occupational Standards / Qualification Packs. NCO 2015 is a dated baseline and needs a refresh check; NSDC qualification packs have their own versioning and retirement status. ESCO can help with multilingual/international mapping. O*NET is a useful US reference, not a proxy for Indian hiring.
3. **Optional reference profiles.** Use only profiles shared by the person for this purpose under a clear permission/license, or independently published professional material whose terms allow the intended use. Choose several varied examples by role, career stage, market, and goal rather than one celebrity. Explain the selection criteria and capture date. Show patterns (e.g., “specific project evidence is easy to find”), not a leaderboard or a copyable template.

The product should call these **reference examples**, not “the top LinkedIn performers.” A human-curated set may include credible evidence such as recognized work, open-source contributions, published research, or relevant leadership, but those signals do not establish a universal ranking or guarantee outcomes. Likes, follower count, profile views, and “influencer” status are not proxies for job performance.

### Domain matching

Use a hierarchy rather than a single broad industry tag:

`function → occupation/role → specialization → industry context → market/location → career stage → goal`

Examples:

- `Finance → Equity research analyst → Consumer/industrials coverage → Asset management → India → Graduate → First role`
- `Technology → Platform engineer → AI inference infrastructure → Cloud/SaaS → India/remote → 0–2 years → First role`

Use explicit taxonomy mappings and human-reviewed aliases. Let the user correct every mapping; preserve the original title. Do not assign “AI” merely because a job description mentions a tool, or “finance” merely because the employer is a bank.

### Reference library schema

Start with a versioned, reviewed JSON/CSV knowledge pack in the repository. Do not launch a database service before proving the rubric is useful.

```text
RoleRubric {
  id, taxonomySource, taxonomyVersion, roleTitle, aliases[],
  function, specialization, industryApplicability[], market,
  careerStage, goal, sectionChecks[], sourceUrls[], checkedAt
}

ReferenceExample {
  id, function, role, specialization, industry, market, careerStage,
  selectionReason, sourceType, sourceUrl, permissionBasis,
  allowedFields[], capturedAt, expiresAt, withdrawnAt?, reviewer
}

ProfilePattern {
  exampleId, section, observablePattern, whyItMayHelp,
  userAdaptationPrompt, sourceFactIds[]
}
```

For opt-in examples, retain only the fields explicitly licensed for use; default to no photo, no full profile text, no contact details, and no raw post history. Add an expiry/recheck date and a revocation/deletion process. Do not mix user profile exports into this library. Keep source URL, permission basis, date, and review owner beside every reference record.

### Allowed starting sources

- [National Classification of Occupations 2015 (NCS / Ministry of Labour & Employment)](https://www.ncs.gov.in/documents/national%20classification%20of%20occupations%20_vol%20i-%202015.pdf): Indian occupation titles/codes; treat it as a baseline and check for newer versions.
- [NSDC National Occupational Standards](https://www.nsdcindia.org/national-occupational-standards): role functions, performance standards, and knowledge/understanding, with version/retirement status checked per qualification pack.
- [ESCO classification and API](https://esco.ec.europa.eu/en/use-esco/use-esco-services-api): multilingual occupation/skill vocabulary and mappings; use where target markets require it.
- [O*NET database](https://www.onetcenter.org/database.html): role/skill data for US occupations; retain its license/attribution and never imply it describes the Indian market.
- User-selected job descriptions, portfolios, and work samples: transient, scoped to that user's diagnosis unless the rights-holder separately licenses reuse.
- Professionals who opt in as references: explicit consent, use scope, attribution preference, and withdrawal terms recorded.

Do not use scraped LinkedIn profiles, scraped posts, data broker/person-search files, or purchased contact lists. A public page is not automatically licensed for bulk collection, retention, model training, or cross-user reuse.

## 7. LinkedIn data access and scraping decision

**Decision: no LinkedIn scraping, crawler, browser extension, logged-in page reader, proxy-scraping vendor, or scraped profile database.** LinkedIn's published help page prohibits software that scrapes/copies profiles and data, unauthorized automation, and copying or distributing information obtained from LinkedIn directly or via data brokers without the required consent. This presents platform-contract and account-restriction risk, regardless of whether profiles appear public.

This is Lynkr's platform-risk decision, not a claim that every form of web scraping is criminal everywhere. Contract, privacy, copyright, database-rights, and computer-access rules depend on jurisdiction and facts. Public visibility alone is not a blanket license. Any exception would need current platform permission and jurisdiction-specific legal review; a vendor or user-uploaded copy does not automatically resolve those issues.

LinkedIn's API is not a general people/profile search API for Lynkr. API access is authenticated; most data products require approval. The Profile API is restricted to approved developers, and LinkedIn says profile data can be stored only for the authenticated member with permission; data for other members may not be stored. OpenID Connect's generally available `profile` permission returns only limited authenticated-member data. Do not build the product plan on approval that Lynkr does not have.

The member export is a reasonable source for the user's own profile if the app is designed carefully. LinkedIn says members can download their own data and that the archive does not supply other members' personal data. That does not make every archive file necessary for a profile review or authorize building a database from connection records.

Sources checked 17 October 2026:

- [LinkedIn: Prohibited software and extensions](https://www.linkedin.com/help/linkedin/answer/a1341387/prohibition-of-scraping-software?intendedLocale=en&lang=en-us)
- [LinkedIn: User Agreement](https://www.linkedin.com/legal/user-agreement)
- [LinkedIn: Getting access to APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)
- [LinkedIn: Profile API restrictions](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api?view=li-lms-2025-04)
- [LinkedIn: Download your data](https://www.linkedin.com/help/linkedin/answer/a1339364/downloading-your-account-data?lang=en)
- [LinkedIn: profile sections](https://www.linkedin.com/help/linkedin/answer/a540837/adding-sections-to-your-profile), [photo guidelines](https://www.linkedin.com/help/linkedin/answer/a1377087/profile-photo-guidelines-and-conditions), [public-profile visibility](https://www.linkedin.com/help/linkedin/answer/a520838/), and [Open to Work visibility](https://www.linkedin.com/help/linkedin/answer/a507508)

### Privacy and legal design note

The app is India-first, but a real deployment may process data from other jurisdictions. Use data minimization, a plain-language purpose notice, user control, a withdrawal/deletion path, processor controls, retention limits, and incident handling from the start. The Indian DPDP Act and Rules have phased commencement: the 13 November 2025 Gazette schedules many core Act provisions and Rules 3/5–16/22/23 for eighteen months after publication (13 May 2027), with other provisions commencing earlier. Check for later notifications and get Indian privacy counsel to confirm which requirements apply on the intended launch date. This document is product design, not a legal opinion.

- [Official Gazette: DPDP Act phased commencement, G.S.R. 843(E)](https://egazette.gov.in/WriteReadData/2025/267647.pdf)
- [Official Gazette: DPDP Rules, G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [Digital Personal Data Protection Act, 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)

Before each AI request, show exactly which user profile fields and image (if any) will be sent to the configured provider. Never use these profile exports to train Lynkr's model or the reference library by default. Third-party reference data needs a separate rights basis and consent; consent from the Lynkr user does not automatically grant rights in someone else's profile or posts.

## 8. Recommendation output contract

Each recommendation should be a reviewable object, not an opaque score:

```text
ProfileFinding {
  section, status: fix_first | consider | strong | not_applicable | cannot_assess,
  observedSignal, issue, whyForThisGoal,
  proposedChange?, evidenceRefs[], benchmarkRefs[],
  confidence: high | medium | low, userAction
}
```

Rules:

- A fix must cite a user-provided fact, selected job-description phrase, role rubric, or permissioned reference. If none supports it, ask the user or return “cannot assess.”
- Show no more than three highest-priority fixes first. The full checklist remains available.
- Tell the user which exact field to change and give before/after text where appropriate.
- Preserve source facts and original text. User must approve rewrites; do not silently replace their profile or local draft.
- Distinguish “not present in this export” from “missing on LinkedIn.” The export can be incomplete and LinkedIn display/search visibility is controlled by LinkedIn.
- No universal profile score, recruiter ranking prediction, “guaranteed views,” or success promise.
- All proposed claims must be traceable to the user's confirmed evidence. Never invent achievements, numbers, skills, credential names, or endorsements.

## 9. Practical implementation sequence

Estimates assume one engineer familiar with Lynkr. They exclude legal review, reference-participant recruitment, and rollout.

### Phase 0 — Lock the rubric and data boundaries (1–2 days)

- Confirm field taxonomy, audience, role-specific findings format, and source list.
- Remove any implied recommendation that depends on platform-ranking secrets.
- Define the archive allowlist and privacy notice; decide which profile fields are sent to the AI provider.
- Create five fictional test profiles across finance, software, data, healthcare, and creative work; include missing/ambiguous data and career-stage differences.

**Exit:** every proposed profile change maps to user evidence or a named source; no recommendation assumes that finance and AI infrastructure are comparable.

### Phase 1 — Better manual audit (3–5 days)

- Extend setup with confirmed function, subdomain, industry, market, level, goal, and optional job-description input.
- Reuse Story Vault facts and accept manual profile-field input.
- Replace generic profile “gaps” with structured, prioritized findings and evidence references.
- Add the section-by-section checklist and safe photo/privacy guidance; no photo model needed yet.

**Exit:** deterministic/mocked examples work for each domain, facts are not invented, and the user can edit/skip every recommendation.

### Phase 2 — User-owned LinkedIn export import (4–7 days)

- Implement browser-only ZIP/CSV parsing for a documented allowlist, preview, selection, normalization, and data discard.
- Keep raw archive and image uploads out of localStorage and server logs. Pass only selected, confirmed text fields to the current generation route.
- Add an explicit provider notice and manual fallback.
- Review sample archives from multiple accounts for missing/renamed files and non-ASCII characters.

**Exit:** a broad archive with connections/messages/account files cannot cause those files to be transmitted or retained; upload/cancel/clear behavior is explainable.

### Phase 3 — Curated references (defer until validated; 2–4 weeks of product/research time)

- Pilot role rubrics with 5–10 people across different target roles.
- Recruit a small set of willing practitioners to provide reference examples under a written, revocable permission.
- Record source, role/seniority/market fit, selection rationale, permitted use, review date, and removal path.
- Publish no named reference until that person approves the presentation and attribution.

**Exit:** users find the examples relevant and non-intimidating; no single profile is treated as the standard.

## 10. Acceptance and evaluation

- User can import their own profile or use manual entry; no LinkedIn login is requested.
- User can distinguish function, occupation, subdomain, industry, market, stage, and audience; changing any one does not silently alter the others.
- A finance profile and AI infrastructure profile receive role-appropriate criteria and sources.
- Each “Fix first” item says what exact field to edit, gives a reason tied to this user's goal, and exposes its evidence/source.
- Photo feedback is limited to technical presentation. The system never recommends beard or appearance changes as a way to get hired.
- No numeric global rank or LinkedIn algorithm claim is produced.
- The archive is parsed in-browser; messages, connections, contacts, and account data are not used in profile analysis.
- No user's own archive enters the shared reference library without a separate explicit opt-in, and no other-member data is accepted as a benchmark source.
- The user can reject, edit, copy, clear, and restart the diagnosis.

In a small formative pilot, ask the participant to explain which three changes they would make and why. Record corrections, unsupported recommendations, confusing comparisons, and time to complete. Do not treat profile completion, recruiter views, or interview outcomes as model accuracy or causal impact.

## 11. Risks and responses

| Risk | Response |
|---|---|
| “Top performer” benchmark intimidates freshers or makes false promises | Use role/stage-matched patterns, multiple examples, and transparent caveats; focus on the user's next step. |
| User changes domain or role | Confirm taxonomy; let the user switch and regenerate; never lock them into an inferred segment. |
| Export contains third-party or private data | Parse locally, allowlist only own-profile fields, discard unrecognized files, never use connections/messages. |
| Advice overfits one job listing | Label it job-specific and ask the user to compare against a second posting or broader role rubric. |
| AI alters the user's claims | Require evidence references and user approval; missing evidence becomes a question, not a made-up bullet. |
| Photo advice becomes biased appearance scoring | Technical-only criteria, no identity/grooming judgement, optional image analysis, user dismissal. |
| Role data becomes stale | Store source/version/check date and review cadence; mark stale data and suppress unsupported advice. |
| Public profile fields are not visible to the intended reader | Explain that LinkedIn visibility settings and indexing are separate; use a manual preview checklist. |

## 12. Source and scope boundary

LinkedIn product/access rules and official occupational sources were checked on 17 October 2026. Taxonomies are references, not hiring guarantees. App observations describe the repository as inspected for this planning task; all phases, import behavior, reference data, and benefits above remain proposals until implemented and evaluated.
