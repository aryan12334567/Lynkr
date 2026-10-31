# Handoff: Lynkr build documentation (Stage A and B)

Written 2026-10-30 by the Claude Code session that started this work. Read this file first, then the read-first list. The work continues at **Next**.

## 1. Where things stand

**Done (saved in `research/`):**
- `context-brief.md`: the Phase 0 brief, with the free/paid answer added.
- `build-plan-interview.md` (A1): updated in place, reviewed by all 7 `ce-doc-review` personas, fixes applied. Decisions D-I1 to D-I10 are at the end.
- `build-plan-posts.md` (A2): reviewed by 7 personas, fixes applied. Decisions D-P1 to D-P15 are at the end.
- `feature-evidence-posts.md`: UpLinked evidence for Posts (REA, public pages, the developer's case study).
- `jetwriter-feature-table.md`: the A3 JetWriter table.
- `reddit-pain-points.md`: has an appended section "Extension, 2026-10-30" with the A3 Reddit table (21 quotes, 6 themes).

**Next, in order:**
1. **A3 Commenter, `research/build-plan-commenter.md`: DONE** (2026-10-30, second session). Reviewed by 7 personas, fixes applied (review log at the end). Decisions D-C1 to D-C9. Two slices: core flow to testers first, tracking/links after. Key technical finding: `info.selectionText` loses line breaks, so the selection is read via `executeScript(getSelection)` under the context-menu activeTab grant. Note: `scripts/migrations/003_posts.sql` reappeared at 02:19, written by another model; it is broken (text FK to uuid) and is not the Posts plan's U1 migration. Left in place pending Aryan.
   - Existing code to reuse: `app/api/comment/route.ts`, `lib/prompts.ts` `COMMENT_SYSTEM`, `lib/comment.ts`, `components/CommentHelper.tsx`, the extension (`extension/src/background.ts` context menu "Write with Lynkr" on a selection, `extension/src/insert.ts`).
   - **The open design call:** how the post text and author reach Lynkr, given Outreach KD1 ("the extension reads only selected text, never the page", because LinkedIn shut down Kleo's extension in June 2025, `research/outreach-draft-v0.md` line 22). The options to put as a [DECISION]:
     - A: selection plus right-click, the current KD1.
     - B: on a user click, read only the one post around the focused comment box through `activeTab`, with no standing host permission.
     - C: JetWriter's way, `<all_urls>` and injected buttons. Not recommended.
   - Insert at the cursor with `execCommand("insertText")`. Never wipe the box, never post.
   - **Conflict to list:** the request names a "freelancer" goal, but the interview only has the fresher, experienced and networker buckets so far (`build-plan-interview.md` KD2).
2. **A4 Outreach: DONE** (2026-10-30). Contact timeline added as dated amendments (KD10–KD13, R38–R47, KTD14–KTD21, U14–U20), via ce-brainstorm → ce-plan → ce-doc-review (7 personas, fixes applied, review log in the plan). UpLinked calendar evidence: `research/feature-evidence-calendar.md` (REA + case study). Decisions D-O1–D-O5. Original note: revise `research/build-plan-outreach.md`. It already carries 2026-10-29 amendments to KD2 and KD8. Its V3 code is uncommitted on branch `feat/outreach-v2` (about 1,100 lines, foundations only). `research/progress-vertical3.md` is stale.
3. **A5 Calendar: DONE** (all 7 reviews applied; Aryan: Calendar free for every user). Older note: **A5 Calendar: WRITTEN, REVIEW PARTIAL** (2026-10-30). ce-brainstorm (Aryan: goal-based week rules; streak = 70% real actions) → ce-plan (U1–U11) → ce-doc-review: only design-lens returned (applied). coherence, feasibility, scope-guardian, security-lens, adversarial, product-lens hit the 5-hour usage limit (reset 4:40pm IST); re-run them, apply fixes, update the plan's Review log, then start Stage B. Original note: UpLinked calendar evidence is in `feature-evidence-posts.md` and https://www.hacktisch.com/work/uplinked.
4. **Stage B: DONE** (2026-10-30). `research/build-plan-combined.md` reviewed by 7 personas, fixes applied; `research/decisions.md` lists every decision (D-X1–X9 cross-part). NEXT: Aryan answers decisions.md; then build starts at Wave 0 (§4). Original note: **Stage B, `research/build-plan-combined.md`** and **`research/decisions.md`** (every [DECISION] and [VISIBLE] from all plans). The combined plan also owns billing lifecycle for every part: past-due grace, access after cancelling, webhook revocation, the customer portal (`build-plan-interview.md` "Payments and access changes", D-I5 to D-I7).

## 2. Read-first list
- `C:\OS\CLAUDE.md` and `C:\OS\memory.md` (Aryan's rules and every decision, dated).
- `research/context-brief.md`, `build-plan-outreach.md` (the format to copy), `build-plan-interview.md`, `build-plan-posts.md`.
- For A3: `jetwriter-feature-table.md`, `reddit-pain-points.md` (the end section).
- For A5: `lib/plan.ts`, `lib/ics.ts`, `components/WeekPlan.tsx`, `lib/outreach/calendar.ts`.

## 3. Decisions Aryan made in the session
Also in `C:\OS\memory.md`:
- **Free/paid:** "Keep today's split." Free with an account: the interview, Story Vault and first win. Paid: ₹499/month for everything else. No trial.
- **Posts follow UpLinked:** an interview before every post, complete drafts with no blanks, visuals (AI image, carousel, own photo) with a monthly allowance, and auto-publish through LinkedIn's official API. "Make changes as per UpLinked, override."
- **The production auto-publish gate:** it waits for LinkedIn developer support's written answer on API Terms 3.1 ("automate posting").
- **The scheduler timer is cron-job.org.** GitHub Actions was rejected (private-repo minutes) and so was Vercel Pro (cost).
- **Profile fix is removed.**
- **Outreach messages, connection requests and comments never send automatically.**
- **Build on existing plans and code;** change them as dated amendments. Never mention deadlines.

## 4. Method
Each document goes through: brainstorm, then plan, then `ce-doc-review` with all 7 personas (coherence, feasibility, scope-guardian, security-lens, adversarial, product-lens, design-lens), then apply the fixes.

The persona prompts, template and schema are in `C:\Users\Aryan Subramanya J\.claude\plugins\cache\compound-engineering-plugin\compound-engineering\3.30.4\skills\ce-doc-review\references\`.

Format: the `ce-unified-plan/v1` structure from `build-plan-outreach.md` (Goal Capsule, Working Agreement, Aryan's part, Product Contract with KD/R/AE, Planning Contract with KTDs, Units, Verification Contract, Definition of Done). Every plan gets a "Payments and access changes" section citing Dodo docs (dodopayments skills or the `search_docs` tool), and ends with a "Decisions for Aryan" list.

Rules: every claim cites a path, URL or quote. Gaps are written "not found" and go to the decisions list. Conflicts between files are listed, not settled.

## 5. Boundaries (confirmed in `context-brief.md` §7)
1. No secrets in code or chat (`build-plan-outreach.md` S7).
2. No production, live Dodo, Vercel Production or production database change without Aryan's yes. Write these as steps for him (S1).
3. Never mention deadlines (`memory.md` 2026-10-16).
4. Public promises ("nothing posted for you", "never your LinkedIn password", in `components/Landing.tsx` and `app/privacy/page.tsx`) change only through a [DECISION] that includes the copy.

## 6. Gotchas
- **Reddit:** the Reddit MCP tool returns HTTP 403 and logged-out browsers hit a login wall, so use web-search snippets with links. Firecrawl can't scrape reddit.com.
- **Shell heredocs fail in this environment.** Write scripts with a file tool, then run them.
- **Untrusted JetWriter files:** the extension is unpacked at `C:\OS\lynkr\rea-evidence\jetwriter-crx\`. Read it, never run it. Run Python with `-I`.
- **The REA Chrome debug profile** may still be running on port 9222 (`C:\OS\lynkr\rea-profile`).
- **Uncommitted V3 Outreach work:** don't run `git clean`, `git checkout` or `git reset` on `feat/outreach-v2`.
- **Wrong drafts in two places:** another model once wrote a wrong posts plan into `C:\Users\Aryan Subramanya J\.claude\plans\`. Ignore that folder. The repo's `research/` files are the truth.

## 7. Original request (Aryan, verbatim; the spec)

GOAL
Produce Lynkr's complete build documentation in two stages.
  Stage A: one build plan per part of the product, written separately.
  Stage B: one combined plan that stitches the parts into a single experience, with the
  free and paid split, and the Dodo Payments changes that split requires.
The parts are: Interview, Posts, Comments (the Commenter), Outreach, and the Calendar.
Save everything under C:\OS\lynkr\app\research\.

HOW TO WORK
- Follow the order below. Finish and save each document before starting the next.
- Use Compound Engineering for every plan: /ce-brainstorm, then /ce-plan, then
  /ce-doc-review, then fix what the review finds. Use any other skill, tool or agent that helps.
- Learn from the sources, then design. For JetWriter and UpLinked, use the REA tools to find
  out how they actually work, and let what you find shape the design. Where they do something
  better than Lynkr's current approach, adopt the approach. Do not copy their code, prompts or
  text. Use what is publicly reachable. If you need a logged-in view, ask me to open it and
  describe what you need.
- Do not invent facts or rules. Every statement about Lynkr, a competitor, a user complaint
  or a platform's rules needs a source: a file path, a URL, or a quote. If you cannot find
  something, write "not found" and put it on my decisions list. Do not fill the gap.
- When two files disagree, list the conflict. Do not pick a side silently.
- Existing work has real effort in it, especially Outreach. For each existing plan or feature,
  decide KEEP, CHANGE or REPLACE, and say why. You have full freedom to change or replace
  anything that limits the new design.

BOUNDARIES
Only the following are boundaries. Each one comes from a source, and you must confirm the
source in Phase 0 before relying on it. Everything not on this list is open to redesign.
  1. No secrets in code or chat. Anything that needs a key tells me exactly where to paste it.
     (Source: my standing instructions; research/build-plan-outreach.md S7)
  2. Nothing changes in production, on live Dodo Payments, in Vercel Production variables or
     in the production database without my explicit yes. Write those as steps for me.
     (Source: my standing instructions; research/build-plan-outreach.md S1)
  3. Never mention deadlines or time pressure. (Source: memory.md, 2026-10-16)
  4. Public promises already shown to users, such as "nothing posted for you" and "never your
     LinkedIn password" (components/Landing.tsx, the privacy page). If the best design needs to
     go past one of these, propose it as a [DECISION], including the page copy that would
     have to change. Do not break it quietly.
If you think a boundary is wrong or missing, say so and give your reason.

OPEN TO REDESIGN
Any existing feature, file, table, schema or earlier decision: the outreach work already
planned or started, migration 002, the extension and its permissions, the checker, the
weekly plan, the Story Vault, and the settled decisions KD1-KD9, including "selected text
only", "no fill-in-the-blank" and "low friction". If you reverse a settled decision, argue
for it and label it [DECISION].

PHASE 0 (done): Context Brief, research/context-brief.md.

THE NEW FREE AND PAID OFFER
Answered by Aryan: "Keep today's split" (see §3).

STAGE A: INDIVIDUAL BUILD PLANS (one file each, same structure as research/build-plan-outreach.md:
Goal Capsule, Working Agreement, Requirements with IDs, Implementation Units with dependencies
and test scenarios, Verification Contract, Definition of Done)

A1. Interview, research/build-plan-interview.md (done)
A2. Posts, research/build-plan-posts.md (done)
A3. Comments (the Commenter), research/build-plan-commenter.md
    A Chrome extension feature that helps a user write organic LinkedIn comments while they
    scroll their own feed, based on the user's context and goals, the post they are commenting
    on, and who posted it.
    - Use the REA tools to break down https://jetwriter.ai/ end to end (done: research/jetwriter-feature-table.md).
    - Extend research/reddit-pain-points.md with at least 15 new quotes (done).
    - Decide how the post text and author reach Lynkr and how the comment gets into the box,
      using what you learned. Label any departure from current decisions [DECISION].
    - Cover: output (complete options with a "why this works" line), goal fit (job seeker,
      freelancer, visibility builder), the quality checks, limits, tracking, and how it feeds
      the Calendar and warms up Outreach.
A4. Outreach, revise research/build-plan-outreach.md
    A lot of work is already in it. Keep what holds up. Change anything that limits the new
    design, including the data model, the extension and the draft engine.
    Include the tracking chain end to end: the person, why we connected, whether the invite
    was accepted, the reply, whether a meeting happened and how it went, and the next step,
    all tied to the purpose of that contact and scheduled on the Calendar.
    Mark what you changed from the old plan and why.
A5. Calendar, research/build-plan-calendar.md
    - Use the REA tools to break down UpLinked's calendar end to end: structure, data model,
      how items are scheduled and edited, reminders, export, and how it connects to the rest
      of the product. Start with what is public. Let what you learn decide the design.
    - Start from lib/plan.ts, lib/ics.ts and components/WeekPlan.tsx. Decide KEEP, CHANGE or REPLACE.
    - It must handle posts, comments and outreach follow-ups from one place, driven by each
      user's goals, with the follow-up chain from A4 (send, wait, follow up, meeting, outcome).

For each plan A1-A5, add a section "Payments and access changes": what the new free and paid
offer means for that part, which routes and screens are gated, and what must change in Dodo
Payments and in the code (Dodo product and plan setup, checkout, webhooks and entitlements,
the license-key and Better Auth integration, requireLicense on routes, paywall screens,
cancellation and refund handling, and the Terms and landing copy that must change).
Use the Dodo docs and cite them. Do not guess an API.

STAGE B: COMBINED BUILD PLAN, research/build-plan-combined.md
Only after A1-A5 are saved and reviewed. Read them all, then write the plan that joins them:
  1. One user journey from first visit to daily use, with the free and paid line.
  2. The free vs paid split: what is gated, how limits work, the upgrade moment, what a free
     user keeps if they stop paying.
  3. How the parts connect: Story Vault and goals, the extension, the Calendar, the weekly plan,
     the quality checks. Name shared tables, routes and components, and who owns each file.
  4. Build order across all parts, with dependencies and what can run in parallel.
  5. Every Dodo Payments and access change in order, builder vs Aryan (live mode, Vercel
     Production variables, production migrations, Terms and listing), moving existing paying
     users, and testing in Dodo test mode first.
  6. Switches and rollout: what is behind which flag, and how to roll back.
  7. The verification contract for the whole product, and a definition of done.
  8. One list of every [DECISION] and [VISIBLE] item from all plans, with a recommendation each.

LABELS
  [SAFE]      internal change, user-visible behaviour identical, ships behind a switch
  [VISIBLE]   changes what users see or do, needs my approval
  [DECISION]  reverses an earlier decision or needs my call, with 2-3 options and a recommendation

DELIVERABLES
research/context-brief.md; research/build-plan-interview.md; research/build-plan-posts.md;
research/build-plan-commenter.md; research/build-plan-outreach.md (revised);
research/build-plan-calendar.md; research/build-plan-combined.md; the JetWriter table and the
Reddit table; and one decisions list for me.
