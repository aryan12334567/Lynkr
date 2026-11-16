# Runbook: when something looks wrong

For Aryan. Plain steps, in the order to try them. Nothing here needs code.

## 1. Is the app up?

1. Open `https://www.lynkr.cloud/api/status` (preview: `https://lynkr-preview.onrender.com/api/status`).
2. A page of text in curly brackets means the server is running. Read these words in it:
   - `"mock": true` means **no AI key is set**: people get template drafts. Fix: set `OPENAI_API_KEY` in Render, then deploy.
   - `"paywall": false` on the real site means **everyone gets paid features free**. Fix: remove `LYNKR_PAYWALL=0` in Render, then deploy.
   - `"checkout": false` means payments are not set up or test payments are blocked.
3. No answer, or an error page: go to step 2. The preview sleeps when unused and takes about 50 seconds to wake; wait once before deciding it is down.

## 2. What to check first

In the Render dashboard, open the service, then:
1. **Events:** did a deploy just fail? If yes, go to step 4 (roll back).
2. **Logs:** look for the last red lines.
   - `AI request failed (401` or `(403`: the AI key is wrong or revoked.
   - `AI request failed (429`: the AI account is out of credit or rate limited. Add credit at the provider.
   - `Email send failed`: Resend is down or `EMAIL_FROM` is not on a verified domain. People cannot get sign-in codes.
   - `connection` or `timeout` with `postgres`/`neon`: the database is unreachable. Check the Neon dashboard.
3. **Environment:** was a variable changed today? A variable only takes effect after a deploy.

## 3. What people see when a service is slow or down

| Service | What the person sees | What to do |
|---|---|---|
| AI provider | "The AI took too long to answer. Please try again." after at most about a minute. Outreach still gives offline drafts. | Check the provider's status page and your credit. |
| Email (Resend) | Sign-in shows an error within about 10 seconds. | Check Resend's dashboard. |
| Database (Neon) | Screens that need the account show an error after 10 to 20 seconds. | Check Neon; a paused branch wakes on the first request. |
| Payments (Dodo) | "Couldn't open checkout." People who paid in the last 24 hours keep access. | Check Dodo's dashboard. |
| Daily AI limit reached | "Lynkr has reached today's writing limit. Your work is saved. Please come back tomorrow." | Raise `LYNKR_DAILY_CAP` in Render and deploy, if the spend is acceptable. |

## 4. How to roll back

1. Render dashboard, the service, **Deploys**.
2. Find the last deploy that worked and press **Rollback** on its row.
3. Open `/api/status` again to confirm.
A rollback changes the code only. It does not undo a database migration or a variable change.

## 5. Things that are easy to forget

- The preview does **not** deploy by itself: **Manual Deploy**, then **Deploy latest commit**.
- Limits are counted in the server's memory. A deploy or restart resets them.
- Before charging anyone: `DODO_ENVIRONMENT=live_mode`, remove `LYNKR_ALLOW_TEST_PAYMENTS`, and make sure `LYNKR_PAYWALL` is not `0` on the real site.
