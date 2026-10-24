# DRAFT: Terms changes for a free interview before the paywall

Status: draft for Aryan's approval. **Not published.** Nothing in `app/terms/page.tsx` or `components/Landing.tsx` has been changed.
Why: decision 1 (build plan section 6) puts the interview, Story Vault and first draft before the paywall. The published Terms say "there is no free tier and no free trial", which would be untrue once `LYNKR_INTERVIEW=v2` is on in production. Publish these changes in the same release that switches production to v2, not before.

## Terms, section on price (app/terms/page.tsx, line 24)

**Before**
> Lynkr costs {SITE.price} per {SITE.period}, including applicable taxes (GST). You pay first, then use Lynkr: there is no free tier and no free trial.

**After (proposed)**
> Lynkr costs {SITE.price} per {SITE.period}, including applicable taxes (GST). With a free Lynkr account you can do the interview, keep your Story Vault and get one first draft (a headline and one referral message) without paying. Everything else, including full profile fixes, outreach and follow-up messages, posts, comments, Connect Coach and the weekly plan, needs an active subscription. There is no free trial of the paid features.

## Other lines that would change

| Where | Today | Proposed |
|---|---|---|
| `components/Landing.tsx` line 223, FAQ "Is there a free trial?" | "No. Create your account, subscribe, and Lynkr unlocks straight away on any device you sign in on." | Question: "Can I try it first?" Answer: "Yes. Create a free account to do the interview, build your Story Vault and see your first draft: a new headline and one referral message. Subscribe for everything else." |
| `components/Landing.tsx` line 518, pricing card | "No free tier and no free trial. Payments are handled by Dodo Payments, our Merchant of Record" | "The interview and your first draft are free with an account. Payments are handled by Dodo Payments, our Merchant of Record" |
| Landing hero and pricing headings ("One plan. Pay first, then use it.") | Pay first | "Start free. Subscribe for the full toolkit." (check against Dodo's review of the live site before changing) |
| `components/Paywall.tsx` | Shown before the interview | Shown after the first draft, for the paid tools only |
| `lib/site.ts` `updated` | "20 October 2026" | the release date |

## Check before publishing
- Dodo reviewed the live site against "pay first, no free tier". Changing pricing wording after approval may need telling Dodo; check their merchant policy.
- The Privacy Policy changes for account storage are already drafted in `app/privacy/page.tsx` on this branch.
- Not legal advice.
