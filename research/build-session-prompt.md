# Build session prompt (the "bible")

Aryan's standing prompt for every Lynkr build session, pasted on 2026-11-02 and named "your bible" by Aryan. Paste section 1 at the start of every session, then one run line from section 2. Saved verbatim from the chat. A few words were lost in the original paste (for example "claimingutput", "calened plan"); do not reconstruct them, the referenced plan sections are the source of truth.

Aryan, same message: "I dont want you to start things from scratch as lot of code has already been written. I want you to use all the tools and plugins mentioned in the prompt."

**Amendments since (each from a later decision, not a rewrite):**
- 2026-10-31: hosting moved from Vercel to Render (`render.yaml`); timers run on cron-job.org. Read "Vercel preview" and "Vercel variable" below as the Render preview service and its environment variables.
- 2026-11-03: sessions run through OmniRoute with `omniroute launch --profile lynkr` from `C:\OS\lynkr\app`. `/model opus` is combo lynkr-build (hard logic), `/model sonnet` is combo lynkr-light (routine units).

---

1. The context prompt (paste at the start of every build session)

You are building Lynkr from finished, reviewed build plans. Do not re-plan or redesign. Implement exactly what the plans say.

READ FIRST, in this order, before touching code:
1. C:\OS\CLAUDE.md and C:\OS\memory.md (my rules and every dated decision)
2. research/handoff.md (where things stand, gotchas)
3. research/build-plan-combined.md (build order §4, file ownership X5, Dodo steps §5, switches §6, verification §7)
4. research/decisions.md (every decision is DECIDED; follow it, don't reopen it)
5. The part plan named in the run line below, plus its progress file research/progress-<part>.md if it exists

AUTHORITY: decisions.md, then the part plan's Key Decisions and R-IDs, then the combined plan's X-rules, then unit text.

HARD RULES (stop and ask me only for these):
- Never touch production: no merge to master, no Vercel Production variables, no production migrations, no live Dodo. Use Dodo Test Mode and the Vercel preview only.
- No secrets in code or chat. If a key is needed, tell me the exact Vercel variable name to paste it into.
- Do not set LINKEDIN_CLIENT_ID/SECRET in any environment until Interview U16 has merged (combined plan §5 B10).
- Nothing sends on the user's behalf: no messages, comments or connection requests. Posts publish only via the Posts plan's gated path.
- Never mention deadlines or time pressure.
- Don't run git clean, git reset or git checkout over uncommitted work. Commit with explicit file lists, never `git add -A`.
- Each part plan's S1–S8 stop list applies. Everything else is your call: decide it, log it under "Decided by the lead (reversible)" in the progress file, and keep going.

WORKING METHOD:
- One part per branch (feat/<part>-v2). Respect the shared-5. Never edit a shared file out of order.
- Keep research/progress-<part>.md current: three lines per unit (done, evidence, next).
- Run the part plan's Verification Contract before claimingutput; don't hide them.
- Every feature stays behind its switch (combined plan §6), defaulting to today's behaviour in production.

ENVIRONMENT GOTCHAS (Windows, Git Bash):
- Shell heredocs with mixed quotes fail. Write scripts with.
- Run Python with -I.
- The repo root is C:\OS\lynkr\app.

2. The run lines, in order (one per session)

┌──────┬─────────────────────────────────────────────────────────────────────────────────┬──────────────────────────┐
│ Step │                                        Paste after the context prompt                                        │   Needs from you first   │
├──────┼─────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│      │ /compound-engineering:ce-work Do Wave 0 from research/build-plan-combined.md §4 only (commit the V3 Outreach │ Nothing. It will ask     │
│ 0    │  work with the listed explicit file list; rewrite d; check the preview DB for   │ before deleting          │
│      │ 003_posts.sql and STOP to ask me before dropping tables or deleting the file). Do not start any part plan.   │                          │
├──────┼─────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 1a   │ /compound-engineering:lfg research/build-plan-outreach.md (U0–U13 plus the A4 units U14–U20, with the U3     │ Step 0 merged            │
│      │ revision creating lib/facts.ts)                                                 │                          │
├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│      │                                                                                 │ Step 0 merged. Runs      │
│ 1b   │ /compound-engineering:lfg research/build-plan-posts.md                                                       │ alongside 1a, but shared │
│      │                                                                                 │  files follow X5 order   │
├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│      │ /compound-engineering:lfg research/build-plan-calened plan §4): U1, U2, the     │                          │
│ 1c   │ free plan-slot view, Mark done, progress, streak, paywall chips. Sources for posts/outreach/comments come    │ Step 0 merged            │
│      │ later.                                                                          │                          │
├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 1d   │ /compound-engineering:lfg research/build-plan-inteirst win) only after Outreach │ Step 0 merged            │
│      │  U3 and Posts U4 have merged.                                                                                │                          │
├──────┼─────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 1e   │ /compound-engineering:ce-work Billing lifecycle B2–B8 from research/build-plan-combined.md §5, in Dodo Test  │ Step 0 merged            │
│      │ Mode only.                                                                      │                          │
├──────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 2    │ /compound-engineering:lfg research/build-plan-commce 2 (comment log) only after │ Outreach U9/U10 merged   │
│      │  the D-C8 legal check.                                                                                       │                          │
├──────┼─────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│      │ /compound-engineering:lfg research/build-plan-calendar.md — Stage 2: post, outreach and comment sources (U3  │ Posts U2/U9, Outreach    │
│ 3    │ adapters, U4, U7, U8, U9).                                                      │ U16, Commenter U4b       │
│      │                                                                                                              │ merged                   │  ─────┼─────────────────────────────────────────────────────────────────────────────────┼──────────────────────────┤
│ 4    │ /compound-engineering:ce-work The copy release B9 and the cross-part verification (§7) from                  │ All of the above merged  │       │ research/build-plan-combined.md; drafts only, I ap                              │                          │
└──────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────┘  
Tips                                                                                                                                                
- Merge each pull request yourself before starting a step that depends on it. That's your control point.                                            Start a fresh session for each step. Context stays clean, continuity between sessions.
- If a run stops, it tells you why. Start a new session with the context prompt plus /compound-engineering:ce-work <plan path>, and it resumes from the progress file.
- Your five actions (Vercel Pro, the Dodo message, the OpenAI budget, the D-C8 legal check, and production steps B10–B12) aren't needed to start building. They gate going live, not the build.

HANDOVER (before switching models, ending a session, or handing work to another agent):
- Update research/handoff.md and research/progress-<part>.md with the current state. Keep the progress file's required three lines per unit: done, evidence, next.
- Record the active part and branch, current unit, completed work, unfinished or partial work, changed files, relevant decisions/R-IDs, verification commands and results, blockers, and the single next action.
- Preserve all working-tree changes. Do not reset, clean, overwrite, or commit files just to prepare a handover.
- On takeover, read the required files in the order above, inspect git status and the diff, then continue from the recorded next action. Do not redo completed work or reopen decided plans..
