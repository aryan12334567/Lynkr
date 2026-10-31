# UpLinked feature evidence: posting, interview, visuals, scheduling

Method follows `REA_Claude_Code_Building_Notes.md`: one question, evidence before assumptions, observed facts kept apart from inferences and unknowns. Nothing here is UpLinked code, copy or design to reuse. Wording below is paraphrased unless quoted.

## Session
- **Date:** 2026-10-29
- **Question:** How does UpLinked turn a planned post into a published LinkedIn post: the per-post interview, versions, refine, visuals and scheduling?
- **Targets (public only, no signup, no login):** `https://www.uplinked.app/en#features`; the case study `https://www.hacktisch.com/work/uplinked` by UpLinked's full-stack developer (spring 2025 to September 2026); UpLinked's App Store listing; LinkedIn's official API docs on learn.microsoft.com; two third-party LinkedIn API guides.
- **Tools:** REA `analyze_web_bundle` (evidence `ev_dceb0333…`), `inspect_web_page` with accessibility text (`ev_620288f5…`), `capture_browser_scenario` clicking the page's product demo tabs (`ev_06f607c8…`, `ev_a6c6cd59…`), through an isolated Chrome profile on a local debugging port. Firecrawl for the case study, App Store and API docs.
- **Raw evidence (gitignored, outside the repo):** `C:\OS\lynkr\rea-evidence\` (case-study screenshots, demo screenshots), `C:\OS\lynkr\rea-a11y.txt`.

## What REA could and could not see
- The marketing page's 59 scripts parsed completely: Next.js, React, a fetch to OpenAI's realtime API (likely the voice demo) and `/api/attribution/capture`. **No posting, interview or scheduling logic is on the public page.** The product runs at `my.uplinked.app` behind login on Convex (server side), so its code is not reachable from outside. The case study is the builder's own description: one self-reported source, cross-checked against LinkedIn's docs where it touches LinkedIn.

## Observed facts

### Flow per post
1. Start screen "How do you want to write today?" offers **Follow your strategy** (next planned posts listed by date, each Pending with a type such as Thought Leadership or Paradigm Shift and a one-line brief) or **Free write** (brainstorm ideas, draft in seconds, refine).
2. A post moves through tabs **Context → Editor → Visual → Publish**. The Editor tab shows a lock until the Context step is done.

### The per-post interview (Context step)
3. The agent opens with the post's purpose taken from its planned brief ("Monday's documentation post… These posts work best when they reveal a real step or decision… What part of your process do you want to document?"), then asks **one focused question at a time**, with examples, and says rough notes are fine.
4. A side panel shows this week's planned posts: the active one (type, campaign, brief) and the others as Pending with their dates.
5. The answer box takes typing, voice (mic) and an attachment (+). Under it are two selectors, **"Quick"** and **"One by one"**. One agent message says "I'm in fast mode, so we'll keep this focused."
6. Each agent message has thumbs up and down.
7. The agent decides when it has enough ("Enough context. I'm going to write 3 versions for you.") and writes **three versions**, shown as cards with "Version 2 of 3", arrows, **Use this version** and **Write new**.
8. After versions: "I can generate 3 completely new versions with a different angle, topic, or direction if needed, but I can't tweak or refine these existing versions; for that, use the edit page." Then "This context session is complete. You can now edit your posts in the editor."
9. Case study: the interview "runs in the background and streams into a saved thread, so closing the tab loses nothing; a watchdog ends a stuck answer after ninety seconds and offers to try again." Three models (Claude, GPT, Gemini) write the three versions at the same time.

### Editor and refine
10. Left: a Refine agent chat that asks clarifying questions ("is there a conclusion you want to draw, or leave it open?"), writes variants, and saves a rule as an "Observation saved" chip. Right: the post as it will look on LinkedIn (name, headline, photo), a version picker ("Version 3"), desktop/tablet/phone preview toggles, a character count "515 / 3,000", the scheduled date and time with time zone, and "View on LinkedIn".
11. Case study: every change the agent makes is a version you can go back to. "Tell it 'no em dashes, ever' and it proposes that as a card; approve it and it is a data point, and from then on every agent reads it."

### Visuals (Visual step)
12. Sub-steps **Type → Style → Editor**. Prompt: "What kind of visual do you want? Pick a type; the AI tailors it to your post."
13. Types: **Image** (AI-generated), **Carousel** (multiple slides in one post), **Edit image** (upload and edit a photo); **Infographic** and **GIF** marked coming soon.
14. A Visual Agent chat ("Create visuals for your post. Describe what you want to see or click a suggestion") with chips: "What kind of visual fits my post best?", "Make a minimalist image with plenty of white space", "Create an abstract background that fits my text", "Make a carousel that tells a story", "Create an 8-slide carousel with tips".
15. Credits counter "53/100 credits". Case study: writing is free, pictures cost credits, 100 a month on a paid plan; images by Gemini 3 Pro; a carousel is one generated image holding a grid of 4 or 8 slides that the server upscales, cuts and puts into a PDF.
16. Live demo on the marketing page (REA click on the Visual tab): a carousel built from the post's own story, 5 slides, one story beat per slide, one consistent illustration style, a thumbnail strip, and "Your carousel is ready! 5 slides with a clean design. You can adjust the style via the Styling tab." A media library holds generated images with alt text.

### Scheduling and publishing
17. Publish or Schedule "via official LinkedIn connection", "One click and your post is live. No copy-pasting, no switching tabs."
18. Case study: "one scheduled job per post"; "Rescheduling replaces the job; the old one is struck through and will not fire." A post's timeline shows draft created, scheduled, rescheduled (superseded schedules struck through). The Posts list shows Posted or Draft with likes and comments.
19. LinkedIn official docs: the self-serve **Share on LinkedIn** product grants `w_member_social` ("Post, comment and like posts on behalf of an authenticated member"). Third-party guides agree the Posts API publishes immediately; **scheduling is the app's own queue and worker**. Company-page posting (`w_organization_social`) needs the Community Management API partner review; member posting does not.

### Not for Lynkr
20. Analytics use a nightly job against a third-party LinkedIn data API plus the user's LinkedIn Excel export, matched to drafts by hash and MinHash. Out of scope for Lynkr (scraping-adjacent).

## Inferences (supported, not verified)
- "Quick" vs a fuller mode likely trades number of follow-up questions for speed; "One by one" likely means interviewing one planned post at a time vs several together. Medium confidence.
- The interview's stop condition is model-judged sufficiency for the post's brief, not a fixed question count. Medium confidence (fact 7).
- Version history is per post, with each agent edit and each manual save creating a version. Medium confidence (facts 10–11).

## Unknowns
- What exactly "Quick" and "One by one" change, and their other options.
- How many questions the interview asks on average, and whether it reads the user's earlier answers before asking.
- The Style step's options for images and carousels.
- How a failed publish is shown and retried; token expiry handling.
- Whether carousels are posted as LinkedIn document posts and through which API.
