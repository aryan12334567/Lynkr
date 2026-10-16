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
