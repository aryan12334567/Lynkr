# Reddit pain-point research — LinkedIn (collected 2026-10-16)

## Method (and limits)
- Source: Reddit via Composio (account u/aryanjaana, read-only). 38 keyword queries x 2 sorts (relevance, top), past-year window, up to 100 results each.
- 5,252 raw results -> 1,649 mention LinkedIn -> 1,096 are centrally about it -> 1,059 coded by an LLM pass (37 failed to parse).
- Coding per post: kind (user pain / builder promo / observer rant / other), persona, up to 3 themes, stated problem, underlying need, workaround, willingness-to-pay signal, India flag, AI stance.
- 130 high-comment threads in pain-heavy subreddits fetched (6,688 comments). 94 of 130 analysed by LLM at time of writing, using the post plus its 30 highest-scored comments.
- Limits: every post was read by a model, not line-by-line by me; I reviewed aggregates and the India / would-pay / thread outputs. Reddit skews toward complainers. My queries leaned toward job search and content tools. Theme counts are mentions (max 3 per post), not unique people.

## Who is actually speaking (516 real voices; 282 builder promos and 261 news/other excluded)
job_seeker 161, fresher_student 62, employed_professional 58, marketer 58, creator 40, founder_b2b 34, freelancer_consultant 33, recruiter/hiring manager 6, other 64.

## Theme clusters (mentions among the 516)
- Job search access: recruiter_silence 87, ghost_jobs 43, easy_apply_black_hole 37, profile_not_converting 25  (~192) ; Premium not worth it 47
- Posting / visibility: time_cost 62, algorithm_opaque 52, no_engagement 39, reach_collapse 30, dont_know_what_to_post 16, pods 8  (~207)
- Authenticity / slop: cringe_performative 53, personal_brand_authenticity 53, ai_slop_flood 46, generic AI voice 21  (~173)
- Networking: networking_awkward 59, spam_dms 37, fear_of_judgment 29, fake_connections 5  (~130)
- B2B lead gen not working: 49
- Account restriction / ban fear: 35
- Willingness to pay: strong 22, weak 37, none 457 (of 516)
- AI stance: anti 55, mixed 22, pro 20, none 419
- India: 156 posts flagged (67 user pain)

## Read between the lines
1. Job seekers need responses, not posts. "Premium brought profile views, nothing moving forward." Visibility is not the bottleneck; being answered is.
2. The fear is looking fake, more than low reach. Clients/readers call AI posts "painful to read"; commenters accuse polished advice of being ChatGPT.
3. People already pay humans (ghostwriters) and say the output is AI slop. Detailed client interviews + questionnaires to capture stories and voice got agreement as what works.
4. B2B posting yields visibility but no clients: followers are not buyers, positioning unclear, no next step. Content alone does not create demand.
5. Ban fear is real and support is automated. A "profile expert" asked a student for their LinkedIn password.
6. Outreach is a two-sided mess: askers don't know how to ask (referral asks sound entitled), receivers are flooded (one reports ~80 connection requests/week, mostly referral asks; hiring managers get 10-30 messages per opening). Advice that got agreement: include job ID + resume, explain your fit, ask politely leaving room to refuse.
7. India: ghosted after months of applying (incl. IIT grad), EMI / loan pressure, tier-3 college label, internship scams asking fees, WhatsApp groups for leads, Hinglish "real hota hai ya larp hota hai". One post: a college required monthly LinkedIn posts and students pasted ChatGPT copy (single data point, c109 comments).
8. Disagreements: outreach "stands out" vs "spam"; recruiters blamed vs recruiters as constrained workers; LinkedIn "useless" vs "got me a job"; Premium rarely seen as worth it.

## Where this landed
The approved feature matrix (what is kept, removed and added versus UpLinked) is in [`../CONTEXT.md`](../CONTEXT.md).

## Implication for Lynkr
- Reframe from "post writer" to "get noticed" coach: profile -> outreach/referral message -> a few real posts/comments, all fed by the same interview / Story Vault.
- Trust is a feature: no credentials, no automation, cannot get you banned, human posts it.
- Don't promise jobs; ghost jobs and application volume are market-structure problems.
- Validate with freshers in own cohort before claiming India demand.

---

## Extension, 2026-10-30: AI LinkedIn comments and comment tools (for the Commenter)

**Method.** The Reddit API tool was blocked with HTTP 403 ("blocked by network security"), and logged-out browsers get Reddit's login wall with reCAPTCHA. Quotes therefore come from Firecrawl web-search snippets, which are verbatim page text, and each links to its thread. Snippets can come from the post or a comment; which one is not shown. Several threads are builder self-promotion (r/SaaS, r/microsaas, r/AI_Agents), which skews toward people selling tools. Full-thread reading needs a logged-in view (decisions list).

| # | Theme | Quote (verbatim snippet) | Source |
|---|---|---|---|
| 1 | Generic praise is the AI tell | "Every "Great insight, thanks for sharing." Every "This really ..." | https://www.reddit.com/r/linkedin/comments/1r72k0g/ |
| 2 | Generic praise is the AI tell | "Things like "great insights!" or weird em-dash paragraphs" | https://www.reddit.com/r/SaaS/comments/1xgp8lh/ |
| 3 | Generic praise is the AI tell | "most of the existing ones spit out the same "great insights, thanks for sharing" nonsense and it's painfully obvious." | https://www.reddit.com/r/AI_Agents/comments/1w9onub/ |
| 4 | Generic praise is the AI tell | "far better than generic comments such as "Great post" or "Thanks for sharing."" | https://www.reddit.com/r/marketing/comments/10bf4sj/ |
| 5 | Readers spot AI comments, and it costs trust | "half the comments are obviously AI-generated and it just kills the conversation. People can smell ..." | https://www.reddit.com/r/SaaS/comments/1qkpyqw/ |
| 6 | Readers spot AI comments, and it costs trust | "AI slop that gets 200 comments from other AI users outranks anything thoughtful." | https://www.reddit.com/r/linkedin/comments/1sls8xh/ |
| 7 | Readers spot AI comments, and it costs trust | "The nail in the coffin was pushing people to press an AI button to generate comments and posts for them." | https://www.reddit.com/r/technology/comments/1h28awg/ |
| 8 | Readers spot AI comments, and it costs trust | "AI and GPT-generated posts and comments are unprofessional, and will be ..." | https://www.reddit.com/r/Entrepreneur/comments/1ryfpnf/ |
| 9 | Readers spot AI comments, and it costs trust | "Wondering if anyone is seeing an uptick on people using AI to comment on posts specifically on LinkedIn." | https://www.reddit.com/r/geologycareers/comments/1mq1r37/ |
| 10 | Thoughtful comments do bring visibility and openings | "I spent three months applying for jobs on LinkedIn and only got about four responses. A friend suggested I try being more active on the platform instead" | https://www.reddit.com/r/careeradvice/comments/1rvm6b0/ |
| 11 | Thoughtful comments do bring visibility and openings | "Thoughtful comments on posts you organically felt were important... they get you just as far on the visibility agenda." | https://www.reddit.com/r/linkedin/comments/1n6r9ht/ |
| 12 | Thoughtful comments do bring visibility and openings | "I'm trying to do some organic marketing on LinkedIn, leaving real comments on posts," | https://www.reddit.com/r/smallbusiness/comments/1j9fi9o/ |
| 13 | Automation and extensions get accounts restricted | "Earlier this month my LinkedIn account got restricted because of automation/extension use." | https://www.reddit.com/r/LinkedInTips/comments/1msn13t/ |
| 14 | Automation and extensions get accounts restricted | "I got my LinkedIn restricted last month using one of those browser extension automation tools and it scared me off the whole category" | https://www.reddit.com/r/LinkedinAds/comments/1traesx/ |
| 15 | Automation and extensions get accounts restricted | "LinkedIn does impose temporary restrictions on messaging and connecting when automation is detected" | https://www.reddit.com/r/automation/comments/1srfgs7/ |
| 16 | Automation and extensions get accounts restricted | "Linkedin T&C's stated that automation can get your account/client banned." | https://www.reddit.com/r/n8n/comments/1u98bi5/ |
| 17 | Writing good comments is slow, so people want help | "I was spending way too much time every morning trying to figure out what to comment on linkedin posts. I knew commenting was important for visibility" | https://www.reddit.com/r/AgentsOfAI/comments/1rldf6j/ |
| 18 | Writing good comments is slow, so people want help | "How do people write good linkedIn comments so easily?" (thread title) | https://www.reddit.com/r/GrowthHacking/comments/1row548/ |
| 19 | Writing good comments is slow, so people want help | "Generates thoughtful, context-aware comments (no links, no promo, no emojis spam). Posts a limited number of comments per day with human-like ..." (a builder describing their tool) | https://www.reddit.com/r/SaaS/comments/1pplo7c/ |
| 20 | Fear of being judged in public | "I'm petrified to post/comment on LinkedIn, because it's another way for a company to judge you." | https://www.reddit.com/r/recruitinghell/comments/1immquq/ |
| 21 | Fear of being judged in public | "Some days I overthink the wording and never ..." | https://www.reddit.com/r/LinkedInTips/comments/1nfokiz/ |

**Themes, each backed by at least 2 sources:**
- **Generic praise is the tell (rows 1–4).** A comment must say something specific to the post, not praise it.
- **Readers spot AI comments, and trust drops (rows 5–9).** Detection is social, not technical. A template-sounding comment costs the commenter credibility.
- **Thoughtful comments still work (rows 10–12).** Named as a visibility path, and for one job seeker it beat applications (row 10, a single anecdote).
- **Automation gets accounts restricted (rows 13–16).** The fear centres on tools that act on their own. That supports "the user posts it" over auto-commenting.
- **Writing is slow (rows 17–19).** The real job is "what do I say", not typing.
- **Fear of judgment (rows 20–21).** This fits Lynkr's freshers: they need confidence that a comment is safe and relevant.

Not found: any quote on paying for a comment tool, or a by-name comparison between tools.
