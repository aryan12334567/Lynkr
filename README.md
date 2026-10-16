# Lynkr

A free "get-noticed" coach for Indian freshers and early-career job seekers. It interviews you (voice or typing), builds a private Story Vault of your real facts, then drafts a profile fix, outreach and referral messages, connection notes, 3 posts and 2 comments with fill-in-the-blank gaps. You copy and send everything yourself in LinkedIn. Nothing is posted for you.

Full product spec, feature matrix and decisions: [`CONTEXT.md`](CONTEXT.md). Reddit evidence: [`research/reddit-pain-points.md`](research/reddit-pain-points.md). Build plan: [`research/build-plan.md`](research/build-plan.md).

## Status
Draft, not yet verified. API routes and `lib/` exist, and a first-draft UI is in `components/` (untested). Nothing is approved to build beyond the scaffold yet. See the status section in `CONTEXT.md`.

## Stack
Mirrors UpLinked's published stack where phase 1 allows: Next.js 16 (App Router), TypeScript, Tailwind v4, Vercel. LLM through the Anthropic SDK (`claude-opus-5-5`, override with `LYNKR_MODEL`). Convex, WorkOS and Capacitor are phase 2.

## Run
```bash
npm install
npm run dev
```
Open http://localhost:3000.

## Environment
Create `.env.local` (never commit it):

```
ANTHROPIC_API_KEY=
LYNKR_MODEL=claude-opus-5-5
LYNKR_DAILY_CAP=400
LYNKR_MOCK=0
```

With no `ANTHROPIC_API_KEY`, or `LYNKR_MOCK=1`, the app runs in mock mode: the whole flow works using the user's own answers and blanks, with no AI calls. Set a monthly spend limit in the Anthropic console; the in-app limits are best-effort only.

## Layout
```
app/api/interview   next interview question
app/api/generate    all drafts
app/api/status      mock mode / model
lib/                schemas, prompts, llm wrapper, mock engine, limits, slots, specificity
components/         UI (first draft, untested)
```

## Rules
- No LinkedIn login, scraping, auto-posting or automated sending.
- Drafts use only facts the user gave; gaps are blanks, never invented.
