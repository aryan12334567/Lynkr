# UpLinked feature evidence (public pages only)

Method follows `REA_Claude_Code_Building_Notes.md`: one question, evidence before assumptions, observed facts kept apart from inferences and unknowns. Nothing here is UpLinked code, copy or design to reuse. Wording below is paraphrased.

## Session
- **Date:** 2026-10-16
- **Target:** `https://www.uplinked.app/en` (public marketing page). No login, no signup, no trial account.
- **Tools:** REA 6.5.0 `inspect_web_page` (passive: DOM + accessibility tree, no clicks, no script execution) and `capture_web_screenshot`, through an isolated Chrome profile on a local debugging port. One `WebFetch` read of the served HTML to get accordion text that the passive inspection cannot open.
- **Raw evidence:** `research/evidence/uplinked-home-inspect.json` (evidence id in file), `research/evidence/uplinked-home-viewport.png` (sha256 `c57f13fa…`). Raw captures are gitignored; they contain UpLinked's own text.
- **REA limits that applied:** attribute values (link targets) are not retained; network and console logging starts only at attach, so page-load requests were not seen; script sources were policy-filtered. So the tech stack was **not** confirmed from this session.

## Question
What features does UpLinked show a logged-out visitor, and how do they behave, so Lynkr can decide what to keep, change, remove or add?

## Observed facts (visible on the public page)
1. **Onboarding:** a short question set (what you do, who you want to reach, your tone) produces a personalised content strategy. Stated as about 5 minutes.
2. **Four-step flow:** (1) tell us who you are, (2) write with AI in your voice, (3) it improves with use, (4) plan campaigns. Steps 2 to 4 have headings only; no detail is public.
3. **Strategy:** tied to a business goal (leads, authority, launch); adjustable by chatting; "12-week strategy" listed in the trial benefits; posts, visuals and scheduling all derive from one strategy.
4. **Voice learning:** improves with each post; four profile areas named: Personal, Expertise, Style, Audience. A persona panel near the steps shows fields like core identity, adversary, unique perspective and formality.
5. **Visuals:** carousels, images and visual posts generated in-app.
6. **Publishing:** one-click publish or schedule through an official LinkedIn connection.
7. **Team:** unlimited collaborators per seat (for 2+ seats).
8. **Analytics:** impressions, engagement, follower growth.
9. **Content calendar:** a week view (Mon to Fri) and a month grid; items carry a status (Draft, Scheduled, Published), a time of day, a content-type tag (e.g. expertise tip, case study, personal story, educational) and campaign tags; items can be dragged between days; published items show reaction, comment and repost counts.
10. **Pricing:** €59 per seat per month, 14-day free trial; a "Pro" tier at €99 marked coming soon; yearly saves 20%.
11. **Audience:** B2B coaches, consultants and agencies with a proven business. Time promise: about one hour a week.

## Inferences (supported by the evidence, not verified)
- The strategy is the central object: calendar items, drafts and campaigns reference it.
- Content-type tags on calendar items come from the strategy (a mix of post types per week).
- Voice learning likely uses the user's edits to past drafts as signal ("the longer you use it, the less you need to adjust").

## Unknowns
- How the strategy is represented (pillars? weekly slots? themes?) and how chat edits change it.
- What "plan campaigns" does beyond tagging posts.
- How voice learning is stored or applied.
- Calendar: reminder behaviour, time zones, what happens to an unposted scheduled item.
- Front-end stack and services (not observed this session; `CONTEXT.md` lists them from the TrustMRR listing).

## Not studied
- Everything behind signup (onboarding screens, editor, real calendar, strategy chat). Studying it would need an account; not done.
- The external "15 min clarity tool" link (separate site).

## Mapping to Lynkr (decision input, not a decision)
| UpLinked (observed) | Lynkr phase 1 | Status in code |
|---|---|---|
| Onboarding questions → strategy | Adaptive voice/typed interview → Story Vault | Built |
| Writes in your voice | Drafts from the user's own facts, blanks for gaps | Built |
| Voice learning (4 profile areas) | Story Vault, visible and clearable | Built |
| 12-week strategy, adjust by chat | Weekly 3-action plan (3 messages, 2 comments, 1 post) | **Not built** |
| Content calendar (week/month, status, time, type tag) | Calendar with Draft → Scheduled → Posted, reminders via .ics / Google Calendar link | **Not built** |
| Campaigns | No (not in spec) | — |
| Visuals, publishing, team, analytics, pricing | Removed | Removed |
| (none) | Message checker | Built |
| (none) | Ask ladder by relationship | **Not built** |
| (none) | Connect Coach | **Not built** |
