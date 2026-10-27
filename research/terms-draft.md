# DRAFT: Terms changes for the free interview and account storage

Status: ready for Aryan's approval. **Not published.** Nothing in `app/terms/page.tsx` or `components/Landing.tsx` has been changed by this draft.
Why: decision 1 (build plan section 6) puts the interview, Story Vault and first-win draft before the paywall, with a free account. Part 1b stores the person's context in their account. Three parts of the published Terms would then be untrue: "no free tier and no free trial" (section 1), "Dodo emails you a license key" as the only way in (section 3), and "Your Story Vault, drafts and plan are kept in your browser … not stored by Lynkr" (section 6).
Publish these in the same release that sets `LYNKR_INTERVIEW=v2` in production, not before. Section 6 is already untrue for account holders today if production runs the account-storage code, so check that first.

## Section 1, price (app/terms/page.tsx, line 24)

**Before**
> Lynkr costs {SITE.price} per {SITE.period}, including applicable taxes (GST). You pay first, then use Lynkr: there is no free tier and no free trial.

**After**
> Lynkr costs {SITE.price} per {SITE.period}, including applicable taxes (GST). With a free Lynkr account you can do the interview, keep your Story Vault and get a first draft (a headline and one referral message) without paying. Free use has daily limits. Everything else, including full profile fixes, outreach and follow-up messages, posts, comments, Connect Coach and the weekly plan, needs an active subscription. There is no free trial of the paid features.

## Section 3, title "Your license key" (lines 33 to 37)

**Before**
> 3. Your license key. After you subscribe, Dodo Payments emails you a license key. You enter it in Lynkr to unlock access. The key is for your own use, works in a limited number of browsers, and must not be shared, sold or posted publicly. A key stops working when the subscription is cancelled or ends, when a payment fails, or after a refund. We may disable a key that is shared or misused.

**After**
> 3. Your account and access. You subscribe from your Lynkr account, and access follows that account on any device you sign in on. Your account is for your own use and must not be shared. If you subscribed earlier and received a license key, it keeps working: it is for your own use, works in a limited number of browsers, and must not be shared, sold or posted publicly. Access, by account or by key, stops when the subscription is cancelled or ends, when a payment fails, or after a refund. We may suspend an account or key that is shared or misused.

## Section 6, your content and data (lines 56 to 60)

**Before**
> What you type is yours. Your Story Vault, drafts and plan are kept in your browser. To write drafts, what you enter is sent through our server to an AI provider and is not stored by Lynkr.

**After**
> What you type is yours. With an account, your context (the brief from your interview, your Story Vault, your answers unless you switch saving them off, your drafts and your plan) is stored in your account so it's the same on every device; you can download it or delete it at any time in the app, and it is deleted automatically after 12 months without activity. Without an account, it stays in your browser. To write drafts, what you enter is sent through our server to an AI provider. Files you import, such as your LinkedIn PDF, are read in your browser and never uploaded. The Privacy Policy explains this in detail.

## Other lines that would change (outside the Terms)

| Where | Today | Proposed |
|---|---|---|
| `components/Landing.tsx` line 223, FAQ "Is there a free trial?" | "No. Create your account, subscribe, and Lynkr unlocks straight away on any device you sign in on." | Question: "Can I try it first?" Answer: "Yes. Create a free account to do the interview, build your Story Vault and see your first draft: a new headline and one referral message. Subscribe for everything else." |
| `components/Landing.tsx` line 518, pricing card | "No free tier and no free trial. Payments are handled by Dodo Payments, our Merchant of Record" | "The interview and your first draft are free with an account. Payments are handled by Dodo Payments, our Merchant of Record" |
| `components/Landing.tsx` line 508, pricing heading | "One plan. Pay first, then use it." | "Start free. Subscribe for the full toolkit." |
| Landing copy "No LinkedIn login" (hero line, promises row, privacy section) | "No LinkedIn login" / "Ask for your LinkedIn login" | Once Sign in with LinkedIn is switched on: "Never asks for your LinkedIn password" (still true). Until then, no change. |
| `components/Paywall.tsx` | Shown before the interview | Shown after the first draft, for the paid tools only (the v2 flow does this behind the switch) |
| `lib/site.ts` `updated` | "20 October 2026" | the release date |

## Check before publishing
- Dodo reviewed the live site against "pay first, no free tier". Changing pricing wording after approval may need telling Dodo; check their merchant policy.
- The Privacy Policy for account storage is updated on this branch (`app/privacy/page.tsx`); publish it together with these Terms.
- Not legal advice.
