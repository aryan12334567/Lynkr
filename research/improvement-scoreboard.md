# Improvement scoreboard

States: **run** = verified by running it; **demo** = demo mode only (no model, key or network); **nv** = not verified. Every row cites its evidence.

| # | Dimension | Baseline | After | Evidence |
|---|---|---|---|---|
| 1a | Draft quality: outreach guard vs. invented text | 11 of 12 invented drafts **passed** the server guard (invented internship, spelled-out years of experience, invented outcome, flattery, invented meeting, mutual connection, identity upgrade, award, quantity words, urgency, second ask). 4 of 4 honest drafts passed. (demo) | 12 of 12 rejected (claim, quantity, flattery, shared_history, tone, asks, grounding); 5 of 5 honest drafts pass, including a paraphrase and a person whose facts really hold an internship and an award (demo) | `scripts/probe-drafts.mts`, `tests/draft-hard-cases.test.mts` (24 tests) |
| 1b | Draft quality: composer with a Hinglish fact | The Hinglish sentence is pasted into the English message and marked "Looks ready" (demo) | The Hinglish line is left out; the message uses the goal's own wording and stays complete (demo). The person gets a generic message, so see proposal P1 | `scripts/probe-drafts.mts`, composer block |
| 1c | Draft quality: composer with two contradicting facts | Both are pasted one after the other ("I led a team of 5…", "I worked alone…") (demo) | Only the first is used; a second fact that adds a result is still used (demo) | same |
| 1d | Commenter generation time, live | 49 s for one call, one option, 2 flagged lines (run, preview, 2026-11-16) | effort lowered; **not re-timed** (nv) | `research/progress-commenter.md` |
| 3a | Reliability: model call timeout | OpenAI path `fetch` has no timeout; Anthropic client uses SDK defaults; callers retry twice; routes allow 60 s (read) | pending | `lib/llm.ts:78,107,175` |
| 3b | Reliability: email send timeout | Resend `fetch` has no timeout (read) | pending | `lib/email.ts:46` |
| 3c | Reliability: database pool | No connect or statement timeout on either pool (read) | pending | `lib/db.ts:84`, `lib/auth.ts:63` |
| 3d | Reliability: quota spent before the provider call, not returned on failure | search, AI spend and first-win all count before calling (read) | pending | `lib/outreach/brief.ts`, `app/api/first-win/route.ts:42` |
| 5a | Paywall: paid routes gated before paid work | All paid-value routes gated first; no client-only gate found (read) | no change needed | sub-agent inventory, `lib/billing.ts:208` |
| 5b | Paywall: production blueprint | `render.yaml` production sets Dodo test mode and allows test payments (read) | Aryan's step | `render.yaml:28-33` |
| 8a | Landing page for a crawler | The whole page is client-only (`ssr: false`): a crawler without JavaScript gets an empty body. No Open Graph, Twitter card, canonical, sitemap, robots or OG image (read) | pending | `components/ClientApp.tsx:1-6`, `app/layout.tsx:26-32` |
| 11a | Operations: caps | In-memory only; reset on restart; "free demo" wording in the daily-cap message (read) | pending | `lib/limit.ts:1-8,68` |
| 12a | `.env.example` | About 33 names read by code are missing; 2 listed names are read by nothing (read) | pending | sub-agent inventory |
