# UpLinked: calendar, planning and follow-up evidence (for A4 Outreach and A5 Calendar)

Date 2026-10-30. Public sources only. Nothing here is UpLinked code, prompts or text to reuse.

**Evidence:**
- **E1. REA `capture_browser_scenario` of https://www.uplinked.app/en** (`ev_cf316fa9…`). Accessibility tree of the landing page and its interactive product demo. Saved as `tool-results/uplinked-home-a11y.txt` in the session folder.
- **E2. REA `capture_browser_scenario` clicking the demo's Strategy and Planning tabs** (`ev_a84f4b38…`). The demo's accessible text didn't change between tabs: the demo is rendered visually, so tab content isn't in the accessibility tree. The "Plan campaigns" step click failed on a strict-locator match. Result: tab content **not found** through REA. E3 covers the same screens.
- **E3. The developer's case study,** https://www.hacktisch.com/work/uplinked (Firecrawl scrape, 2026-10-30). Text and screenshot captions written by the full-stack developer who built UpLinked's rebuild.
- **Earlier passes:** `research/feature-evidence.md` (2026-10-16, public pages) and `research/feature-evidence-posts.md` (2026-10-29, the posting flow).

## What UpLinked's calendar is

| # | Finding | Source |
|---|---|---|
| 1 | **The app's navigation:** Write, To do's, Posts, Planning, Strategy, Intelligence, Analytics. There is **no contacts, people, outreach, CRM or follow-up section** | E3, first screenshot caption; E1 demo sidebar: "Write", "Posts", "Planning", "Strategy", "Intelligence", "Analytics" |
| 2 | **A month grid,** Mon–Sun. Each item shows its post type ("Thought Leadership", "Case Study", "Personal Story", "Educational", "Product Update", "Behind the Scenes"), a time ("09:00") and a campaign label ("Q2 Strategy", "Product Launch") | E1: "October 2026 … Thought Leadership 09:00 Q2 Strategy" |
| 3 | **Item status** is Draft, Scheduled (with time) or Published. Published items show the post's opening line and four counts. The four counts' labels: **not found** (likely impressions, reactions, comments, reposts) | E1: "Published Q2 Strategy 09:00 … 2.8K 89 23 12"; "Draft Q2 Strategy 10:00"; "18 Scheduled 12:00" |
| 4 | **Editing by drag:** "Drag, move and schedule your posts for the week. See at a glance what goes out when." | E1 "Visual content calendar" |
| 5 | **The calendar is generated from a strategy:** 12 settings, a fixed 7-step calculation, a 12-week plan over 18 post types, a sales cycle of 2–12 weeks, and a reach/convert split. "The language model only names and describes what the sum decided." The first week is ready in about 15 seconds; the other eleven are written in the background | E3, "From a strategy to this week's posts" |
| 6 | **Funnel label on each slot** (TOFU or BOFU), and three posts a week | E3, Strategy page caption |
| 7 | **The agent edits the calendar with operations:** "insert, update or delete, which are applied in one go with an id each, so a retried message does not add a post twice, and the whole change is one step in an undo history the team shares" | E3 |
| 8 | **Window:** "a month back and five ahead, the same window as the calendar" | E3 |
| 9 | **Adjust by chatting:** "Don't like a direction? Just say so. Your strategy adapts through conversation" | E1 |
| 10 | **Scheduling:** one scheduled job per post. "Rescheduling replaces the job; the old one is struck through and will not fire." A post's timeline shows draft created, scheduled, and each reschedule | E3, Posts caption; `feature-evidence-posts.md` item 18 |
| 11 | **The week, from the user's side:** "Then it is Monday. You pick this week's posts, the agent interviews you about each one". On the phone: "You have 3 posts to write for this week", a week view with each slot's type and "pending" status, and "Get started with 3 posts" | E3, interview section and phone caption |
| 12 | **Reminders and habit:** "Every Monday there are a few tasks, upload your analytics, answer a quiz, check your strategy, and finishing them keeps a weekly streak going." The To do's page shows "Week complete" and week numbers with a flame on the current week | E3, "Pictures, numbers and a reason to come back" |
| 13 | **Notifications:** the phone app has "push sent straight to Apple and Google and a widget on the home screen." Email reminders: **not found** | E3, "In your pocket" |
| 14 | **The phone calendar:** a month view with dots under days that have planned posts. Selecting a day lists its posts with type and time ("Documentation post at 08:45") | E3, phone caption |
| 15 | **Feedback loop:** a nightly job fetches each post's public numbers. "Performance goes back into the strategy agent." Top posts are ranked against the user's own median | E3 |
| 16 | **Knowledge with provenance (Intelligence):** everything the user says first becomes a "data point". Elements are derived from data points, "each with a confidence and a link back to where it came from". Contradictions "show up as a conflict instead of the newest one quietly winning". "Data points go stale after ninety days." | E3, "What it knows about you" |
| 17 | **Background jobs:** 181 tables, 27 cron jobs, seven agents | E3 |
| 18 | **Export** (.ics, Google Calendar) of the content calendar: **not found** | E1, E3 |
| 19 | **Anything person- or relationship-related** (contacts, invites, replies, meetings, follow-ups): **not found**. UpLinked's goal is "attract leads", and its ROI is "the conversations that come from them" (E1), but tracking those conversations is outside the product | E1, E3 |

## What this means for Lynkr

**What Lynkr adopts for the Calendar (A5) and for scheduling Outreach steps (A4):**
1. **One calendar of typed items,** each with a type, time, status and a label tying it to a goal: UpLinked's campaign label becomes Lynkr's goal (#2, #3, #6).
2. **Plans are calculated, and the model only explains them:** UpLinked's "the language model only names and describes what the sum decided" (#5). This matches Lynkr's existing rule-based 3B7 follow-up timing (`lib/outreach/followup.ts`).
3. **Calendar changes as id-keyed operations:** a retry never duplicates, and a change can be undone (#7). Lynkr's `saveOutreachEvent` already replaces by id (`lib/outreach/calendar.ts` lines 80–86).
4. **Every item keeps a timeline,** where superseded schedules stay visible but struck through (#10).
5. **A weekly to-do list with a streak** as the reason to return (#12). This is the role Lynkr's Today and This week play.
6. **Facts with provenance and staleness** (#16), applied to what Lynkr learns about each contact: what the user noted after a call, and when.
7. **Drag to reschedule, and changes by chat** (#4, #9). Plan chat already exists in Lynkr (`lib/plan.ts`).

**What Lynkr must design without an UpLinked model** (#1, #19):
- the person-level chain: why connected → invite → accepted → reply → meeting → how it went → next step
- calendar export (#18)
- reminders outside the app (#13: UpLinked uses push from a native app; Lynkr has no app)

For these, the sources are Lynkr's own code:
- `lib/outreach/calendar.ts` event types, including `meeting_scheduled`, `meeting_completed`, `meetingOutcome`
- `lib/outreach/followup.ts`
- `lib/ics.ts`
- `research/build-plan-outreach.md` R25–R28

**Not found:**
- how UpLinked's calendar looks in the logged-in app beyond the case-study screenshots
- the labels of the four counts on published items
- export
- email reminders

A logged-in view would settle them. That needs Aryan to log in to UpLinked in the REA Chrome profile.
