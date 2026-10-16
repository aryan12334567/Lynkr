# Feature spec: ask ladder

Source: `CONTEXT.md`, approved spec item 5. Lynkr-only; UpLinked shows no equivalent on its public pages, so there is no evidence step. Built after the weekly plan, as Aryan asked on 2026-10-16 ("implement both one after another").

## What it does
The Outreach tab asks "Who are you messaging?" and shows the first message that fits that relationship, plus a follow-up for 5–7 days later. The ask grows with how well the person knows you:

| Rung | Who | First message asks for | Must include | Must not include |
|---|---|---|---|---|
| 1 | Stranger | One specific question about their work | Their name, one specific thing about them (blank), one fact about you, one question, an easy out | Any referral ask |
| 2 | Same college / alumni | A 15-minute chat | Shared college (blank), one fact about you, the 15-minute ask, an easy out | A referral ask |
| 3 | Someone who knows you | A referral | Job ID or link, resume mention, a stated fit, one yes/no ask, an easy out | Pressure ("urgent", "kindly revert") |

The follow-up adds one new thing and ends with an easy yes/no question and a polite out. The hiring-manager message stays available under "Other drafts".

## Data
`GenerateReply.outreach` gains two drafts:
- `stranger`: rung 1, under 70 words.
- `alumni`: rung 2, under 80 words.
`referral` is rung 3 (unchanged), `follow_up` unchanged, `hiring_manager` kept.

## Rules
1. The relationship picker defaults to "A stranger": the safest rung, and the one that matches most cold outreach.
2. Each rung's draft is checked by the existing message checker against that relationship, so a stranger draft that mentions a referral fails.
3. Drafts follow the global rules: user's facts only, blanks for anything missing.
4. Results saved before this feature have no `stranger` or `alumni` draft. The tab shows a "Rewrite drafts to get this message" prompt instead of crashing.

## Out of scope
Per-person ladder memory (that belongs to Connect Coach's tracker), choosing the rung automatically.
