# The question for LinkedIn developer support (Posts plan A2, U0 step 3)

Drafted 2026-11-16. **Not sent.** Aryan sends it from the LinkedIn developer account that owns the Lynkr app. Production auto-publish stays off until there is a written answer (Posts plan KD4, R31; what counts as "allows" is decision D-P12).

## Where to send it

LinkedIn Developer Portal (https://www.linkedin.com/developers/apps), signed in as the app owner, then the **Support** or **Help** link there. The exact support form was not checked in this session. Choose the app "Lynkr" and the product "Share on LinkedIn" if the form asks.

## Subject

Does member-approved scheduled posting through Share on LinkedIn count as "automate posting" under API Terms of Use 3.1?

## Message

Hello,

I run Lynkr (client ID: the one on the app's Auth tab), a writing tool for individual LinkedIn members. I would like to confirm that one planned feature is allowed before I ship it.

What the feature does:

1. The member answers a short interview about their own work. Lynkr's AI drafts post text from those answers only.
2. The member reads the draft, edits it, and approves one version.
3. The member picks a date and time.
4. At that time, Lynkr's server publishes that one approved post, once, to the member's own profile, using Share on LinkedIn (`w_member_social`) with the member's own access token.
5. The member can edit or cancel until publishing starts. Nothing is published that the member did not approve. There is no bulk posting, no posting to other members' profiles or to pages, and no automated comments, reactions, messages or connection requests.

My question: does this count as "automate posting" under section 3.1 of the API Terms of Use, or is a member-approved, member-scheduled post through Share on LinkedIn permitted?

If it is permitted only with conditions (for example a limit on posts per day, or a required disclosure), please tell me what they are.

Thank you,
Aryan Subramanya J
Lynkr (https://www.lynkr.cloud)

## What to do with the answer

- **An explicit "permitted":** save the reply as `research/evidence/linkedin-terms-answer.pdf` and tell the build session. Production may then set `LYNKR_AUTOPUBLISH=on` (Posts plan A8).
- **"Not permitted", no reply, or only a link back to the terms:** production ships the copy-and-post-yourself path (R32) and auto-publish stays off (recommended option of D-P12).
