# Vertical 3: Outreach, draft v0 (planning only)

Status: draft for Aryan's review, 2026-10-27. Nothing is built. The build plan comes after his edits.
Builds on the 2026-10-27 chat answer (five questions: finding people, what to send, profile links, goal per contact, in-LinkedIn drafting).

## The one-line idea
Lynkr finds the few right people, knows both sides (the user from vertical 1, the recipient from public sources), writes a complete message for a specific goal, puts it straight into the LinkedIn box the user clicked, and learns from what gets replies.

## Principles (from what has worked before)
1. **Relevance beats personalization.** A specific reason, a clear goal and an easy ask beat a clever personal line. If the personal detail has nothing to do with the ask, it is an attention hack. (coreyhaines31 cold-email skill, citing Clay and Lavender)
2. **Moderately weak ties are the best route to a new job.** A LinkedIn experiment with 20M users found moderately weak ties (some mutual connections) produced the most job mobility, more than close ties. (Rajkumar et al., Science 2022; MIT News)
3. **Ask for insight, not a job.** The 2-Hour Job Search method (Steve Dalton, Duke Fuqua): a short message, the connection first, more than half the words about them, no job ask, then TIARA questions in the call (Trends, Insights, Advice, Resources, Assignments). Referrals come later, from people who already replied.
4. **Give before asking.** Offer something small first: a useful observation, a resource, an answer.
5. **Signals set the timing.** Messages tied to something that just happened (new role, a hiring post, a talk, funding) get more replies than cold ones. Signals go stale, so each has an expiry date. (prospecting skill, signal plays)
6. **Few, then follow up once.** One follow-up is worth sending: 13.9% of silent contacts replied after one (Reachium, 43,084 accepted connections). Dalton's 3B7: if there's no reply in 3 business days, try a second person at that company; follow up with the first after 7.
7. **People who reply fast are the ones to invest in.** Dalton calls them "Boosters". Lynkr tracks them.

## Facts that shape the design (verified 2026-10-27)
- **Free LinkedIn accounts get very few personalized notes:** LinkedIn's help page says up to 5 a month, 200 characters; users report 3 since late 2025. Premium is unlimited, 300 characters. → Lynkr budgets these notes for the top contacts only.
- **Notes: mixed on acceptance, clearly better on replies.** Reachium (180,155 requests): a note's effect on acceptance was inconclusive, but accepted contacts replied 47.8% with a note vs 25.5% without. Vendor studies (ReactIn, Botdog) show blank invites accepted more often. → Use a note when there is a real reason, otherwise send a blank invite and write the real message after acceptance.
- **Weekly invite cap:** about 100–200 a week. Low acceptance rates get accounts flagged. Lynkr's caps keep users far below this.
- **Kleo's Chrome extension was shut down in June 2025** after a LinkedIn cease-and-desist, after 70,000+ users. Any extension that works inside LinkedIn carries this risk.
- **Google's Custom Search API is closed to new customers** and stops on 1 Jan 2027. Don't build on it.
- **India's DPDP Act 2023, s.3(c)(ii)** excludes personal data that the person made public themselves. That covers talks, articles and public posts. It does not override LinkedIn's terms, which are a contract. (Get a lawyer's view before scale.)

---

## Part A. Finding quality people (quality over quantity)

### A1. Drill down to the niche, without new questions
The interview already gives: field (A3), target role and level (B2), target companies (B3), who to meet (D1), warm paths (D2).
Lynkr turns this into a **target map**: field → sub-niche → 10–40 target companies → teams → 1–2 levels above the user.
Company ranking uses Dalton's **LAMP list**: Alumni there? Motivation (how much the user wants it)? Posting (open roles)? Lynkr fills A and P itself; the user only drags M.

### A2. Sources, warmest first
| Rank | Source | What it gives | Cost / risk |
|---|---|---|---|
| 1 | **The user's own connections** (Connections.csv in their LinkedIn data archive) | Name, company, role, **profile URL**, date connected. Includes old classmates and colleagues they haven't spoken to in years ("dormant ties"). | Free. The user's own data. Today `linkedinExport.ts` skips connections by design, so this would be a new opt-in. |
| 2 | **Second-degree people at target companies** | LinkedIn search links built by Lynkr (company + 2nd degree + role keywords). The user runs them. | Free, no automation |
| 3 | **Alumni** | LinkedIn's alumni page for the user's college (filters by company, role, city), plus college portals | Free |
| 4 | **People who said "contact me"** | ADPList mentors (free sessions), Topmate profiles, "we're hiring" posts, Hacker News "Who is hiring" threads, YC "Work at a Startup" founders | Free; they opted in |
| 5 | **Public experts in the niche** | Conference speakers (Hasgeek, Sessionize, Luma hosts), podcast guests, newsletter authors, GitHub maintainers | Free search APIs |
| 6 | **Teams with a live reason** | Open roles (Greenhouse/Lever/Ashby import already exists), funding news (Inc42, Entrackr, YourStory feeds) → the hiring manager | Free |

**Not used:** bulk scraping of LinkedIn profiles (Apify LinkedIn actors, Proxycurl-style data). It breaks LinkedIn's terms, and LinkedIn has sued and shut down vendors who did it.

### A3. Quality score per person (shown, not hidden)
Each person gets a short "Why this person" with sources:
- **Fit:** same sub-niche, 1–2 levels up, at a target company
- **Bridge:** college, ex-company, community, city, or mutual connections (moderately weak is best)
- **Signal:** something recent, with its date (new role, talk, post, hiring)
- **Reachable:** active recently, or has said they're open (mentor, hiring post)
- **Give:** one thing the user can offer them

Tiers:
- **Tier 1** (up to 5 a month): all-in research, a personalized note, the user's best effort.
- **Tier 2** (around 10 a month): blank invite, then a full message after acceptance.

Monthly cap: about 15 new people. Quality comes from the cap.

## Part B. Knowing the user's side, with almost no friction
- **No new questions by default.** Lynkr uses the Story Vault, the imported profile and the connections file.
- **Just-in-time questions only.** When a draft would be stronger with one more fact, Lynkr asks one question with tap answers, beside the finished draft (for example, "Have you used their product?" Yes / No). The answer is saved to the Vault for good, so it's never asked again.
- **Voice, not typing.** A 10-second voice note ("why I want to talk to her") is optional. It becomes the reason in the message.
- **Defaults everywhere.** The goal, the angle and the tone are pre-selected. The user's only required action is "Write it".

## Part C. Knowing the recipient deeply (the other endpoint)
For each person, Lynkr builds a **one-screen brief**:
- 3 facts with links (the "3x3" research habit: 3 things in 3 minutes)
- the **bridge** with the user (detected from the Vault plus what's known about them)
- their likely **priority now** (from role and signal; for example, "hiring two analysts, so short on time and wants good people")
- **what the user can give** them
- the **best angle**
- **"No hook found"** is allowed: then Lynkr writes a strong message based on role and company instead of inventing a personal line.

Where the facts come from:
1. **Public work outside LinkedIn**, via a search API: talks, podcasts, articles, GitHub, company blog, news, job posts. Free tiers: Exa about $10/month of credit (around 2,500 searches), Tavily 1,000/month, Serper 2,500 once, Firecrawl 1,000 credits/month. linkedin.com pages are excluded from these searches.
2. **What the user brings from LinkedIn**, three low-friction ways:
   - **Select text and right-click "Write with Lynkr"** (their post, their About). The extension receives only the selected text.
   - **Drop in LinkedIn's own "Save to PDF"** of their profile.
   - **Paste** the profile text.
3. **Option B (Aryan's call):** a one-click "Read this profile" on the page the user is viewing. It is the lowest friction, but it's the kind of feature LinkedIn's terms forbid and the Kleo risk applies. See the decisions below.

## Part D. A goal for every contact (playbooks)
The goal is pre-set from the relationship and the user's B1 goal, and the user can change it with one tap. Each goal has its own playbook:

| Goal | Who | Opening angle | Ask | After a reply |
|---|---|---|---|---|
| Learn (informational) | Strangers in the niche | Their talk, post or work | One specific question, or 15 minutes | TIARA call prep sheet |
| Referral | Only people who already know the user, or Boosters | Shared history plus the specific role | "Would you be comfortable referring me for job ID X?" plus a ready-to-forward blurb | Thank-you note and an update |
| Hiring manager | The manager for a live role | What their team is building, and the user's matching proof | A question about the role, not "please hire me" | Short case note |
| Mentor | Senior people, ADPList/Topmate | Why them specifically | One small, concrete question | Regular updates |
| Client / freelance | Founders, team leads | A free mini-teardown of their actual problem (value first) | "Want me to send it?" | Send it |
| Reconnect | Dormant ties (from Connections.csv) | Shared past, plus a real update | A catch-up | Normal relationship |
| Peer | Same level, same niche | Shared interest | Swap notes | Regular contact |

## Part E. The profile link in the app
- **From Connections.csv:** every first-degree contact already has a URL. Zero effort.
- **For new people:** a "Find on LinkedIn" button opens a LinkedIn search for name + company. The user clicks the right result, and the extension (or a paste) saves the URL to the card.
- **On every card:** "Open profile" plus the ready draft, its goal, and the follow-up date.

## Part F. Drafting inside LinkedIn (the Chrome extension)
- **Full drafts, never fill-in-the-blanks.** Lynkr writes 2–3 complete versions by angle (warm, value-first, question). The user edits a sentence or just sends.
  - **Rule:** Lynkr never invents a fact. If a fact is missing, the draft is still complete; it just doesn't use that fact.
- **Inserts where the user is typing.** The user clicks into the note box, DM box or comment box and presses the Lynkr button (or a shortcut), and the draft appears in the box. The user edits and clicks Send. Lynkr never sends, likes, connects or visits profiles by itself.
- **Knows the limits.** A connection note is 200 characters on free accounts and 300 on Premium. Lynkr shows the remaining monthly note budget and suggests a blank invite when the note isn't worth spending.
- **Built-in checker.** The message checker (vertical 5) grades the draft before it's inserted.
- **Survives a takedown.** Everything also works in the web app (Copy plus "Open profile"), so if the extension is ever removed, Lynkr keeps working.

### Example (made-up user and recipient)
The user is a data analyst with 4 years in lending risk; the Vault has a model that cut 30-day defaults by 12%. The recipient is a credit risk lead who gave a meetup talk on early-warning signals.

Connection note (196 characters):
> Hi Neha, your talk on early-warning signals for small-ticket loans changed how I look at our alerts. I built one that cut 30-day defaults by 12% and would love to compare notes. Glad to connect.

After she accepts:
> Thanks for connecting, Neha. One question from your talk: when an early-warning flag fires, does your team act on it within the same week, or wait for a second signal? We've gone back and forth on this.

## Part G. Follow-up and learning (the moat)
- **Reminders:** 3B7 rhythm, one follow-up only, and each follow-up adds something new.
- **Outcomes in one tap:** a weekly prompt asks "Did Neha reply?" with Yes / No / Booked a call. Lynkr never reads the user's LinkedIn inbox.
- **What Lynkr learns:** reply rates by goal, tier and angle for this user, and later across all Lynkr users in India by field. The best angle becomes the default. That data is the moat.
- **Boosters list:** people who replied, for the next asks.

## Why everyone wins
- **The user** gets more replies for less time.
- **The recipient** gets fewer, shorter, relevant messages with an easy ask.
- **LinkedIn** gets human-sent, well-targeted invites with high acceptance and no automation.
- **Lynkr** gets outcome data no competitor has for Indian job seekers.

## Tools and connectors (free or cheap, and under-used)
| Need | Tool | Note |
|---|---|---|
| Warm graph with profile links | LinkedIn data archive, Connections.csv | The user's own data; already have an archive reader |
| Search for people's public work | Exa, Tavily, Serper, Firecrawl (already used) | Free tiers above; exclude linkedin.com |
| Live roles | Greenhouse / Lever / Ashby (already built), YC jobs, HN "Who is hiring" | Free |
| Funding triggers in India | Inc42, Entrackr, YourStory feeds | Free |
| Speakers and experts | Hasgeek, Sessionize, Luma, podcast and YouTube pages | Free; Apify only for non-LinkedIn public pages |
| Engineers | GitHub public API | Free |
| People open to being contacted | ADPList, Topmate | Free to browse |
| Extension pieces | Chrome side panel, context menu (selected text), activeTab | Standard Chrome APIs |
| Warm-intro ranking | Bridge score from the `social-graph-ranker` skill: B(m) = Σ w(t)·λ^(d−1) | Ranks which contact can introduce the user to whom |

## Skills found (find-skills, 2026-10-27)
- `coreyhaines31/marketingskills@cold-email` (128.5K installs): used its LinkedIn, personalization and follow-up references.
- `coreyhaines31/marketingskills@prospecting` (65.8K): used its signal ranking, freshness windows, tiers and compliance rules.
- `affaan-m/ecc@social-graph-ranker` (8.7K): bridge-scoring formula for warm intros.
- For the build: `googlechrome/modern-web-guidance@chrome-extensions` (11.1K) and `samber/cc-skills@crxjs` (4.4K).
Not installed yet; install at build time.

## Build parts (for the build plan)
1. **Contacts and pipeline:** Connections.csv opt-in, add by URL, goal per contact, profile links, follow-up dates.
2. **Drafter:** the playbooks by goal, full drafts, note budget, checker.
3. **Recipient brief:** public-source research with links, bridge detection, "no hook found".
4. **Chrome extension:** side panel, insert into the box, select-to-draft.
5. **Follow-up and learning:** 3B7 reminders, one-tap outcomes, Boosters, reply rates.
6. **Finder:** target map, LAMP list, LinkedIn search links, signal sources, quality score.

## Decisions for Aryan
1. Extension reading mode: selected text only (recommended), or a one-click read of the profile on screen (more convenient, Kleo-type risk).
2. Import the user's connections file as an opt-in? (Recommended yes.)
3. Search API budget: start on free tiers (Exa plus Firecrawl), and set a monthly cap.
4. Monthly caps: about 15 new people, Tier 1 up to 5 (matches the free-account note limit).
5. Which part to build first (suggested 1 → 2 → 3 → 4 → 5 → 6).

## Sources
- Reachium, notes study (180,155 requests): https://www.reachium.io/research/do-connection-notes-work
- Reachium, follow-up study: https://www.reachium.io/research/do-linkedin-follow-ups-work
- ReactIn notes data: https://www.reactin.io/blog/linkedin-connection-request-with-or-without-note
- Botdog acceptance data: https://botdog.co/blog-posts/linkedin-acceptance-rates
- LinkedIn Help, personalized invitations: https://www.linkedin.com/help/linkedin/answer/a6239760
- Reddit, "THREE personalized invites per month": https://www.reddit.com/r/linkedin/comments/1nvd963/three_personalized_invites_per_month/
- Kleo shutdown: https://www.linkedin.com/posts/jakezward_i-didnt-want-to-post-this-but-i-have-to-activity-7341796212687175681-JjZx and https://www.reddit.com/r/socialmedia/comments/1lik2zn/kleo_chrome_extension_shut_down_what_are_you/
- Weak ties: https://www.science.org/doi/10.1126/science.abl4476 and https://news.mit.edu/2022/weak-ties-linkedin-employment-0915
- 2-Hour Job Search: https://awesomeatyourjob.com/626-mastering-the-2-hour-job-search-that-generates-dream-interviews-with-steve-dalton/
- Jobright insider connections: https://jobright.ai/job-referral
- Google Custom Search API closure: https://developers.google.com/custom-search/v1/overview
- Search API free tiers: https://brightdata.com/blog/web-data/best-free-serp-apis and https://exa.ai/blog/best-web-search-tools-for-ai-agents
- DPDP Act 2023 text (MeitY): https://www.meity.gov.in/static/uploads/2024/06/2bf1f0e9f04e6fb4f8fef35e82c42aa5.pdf
- Connections.csv fields: https://www.connectiontracker.org/guides/export-linkedin-connections-csv
- Skills: https://skills.sh/coreyhaines31/marketingskills/cold-email , https://skills.sh/coreyhaines31/marketingskills/prospecting , https://skills.sh/affaan-m/ecc/social-graph-ranker
