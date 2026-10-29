# Connect the live services

Guided notes, the section editor, PDF/Word/text downloads, and public remote-job discovery work without an account. Public remote listings come from Remotive; AI assistance, imported-CV analysis, account saving, and extended JSearch listings need the connections below. Having a Supabase project URL alone does not activate these features.

## Environment variables

An ignored `.env.local` has been prepared locally with blank credentials. Fill it locally, and add the corresponding values to Vercel → JobAI project → Settings → Environment Variables. Choose the intended Preview/Production environments and redeploy after saving. Do not send secrets in chat or commit them.

| Variable | Where to get it | Use |
| --- | --- | --- |
| `GROQ_API_KEY` | Groq console → API Keys | Server-only CV analysis, draft wording, cover letters |
| `JSEARCH_KEY` | The JSearch API provider account (RapidAPI) | Server-only live job listings; requires an active subscription/plan |
| `VITE_SUPABASE_URL` and `SUPABASE_URL` | Supabase project URL | Both use `https://qxhkrepvoqnsxcofarno.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → publishable key | Both use the same public project key; never use a secret/service-role key |
| `VITE_PUBLIC_SITE_URL` | Your production website URL | Current example uses `https://jobai-orpin.vercel.app`; update if the domain changes |
| `VITE_SUPPORT_EMAIL` | A monitored support inbox | Optional private support contact shown in the app |

The server model defaults to `openai/gpt-oss-120b`. `GROQ_VISION_MODEL` is optional and must name a currently available vision model before image CV uploads can be analysed. Regular text PDFs and Word documents do not require vision. EmailJS settings are optional for emailed copies.

No database password, Supabase secret key, or service-role key is required by this application. Never prefix a Groq/JSearch secret with `VITE_`: those values become public browser code.

Run `npm run check:config` with Node 22 to check variable presence without revealing values. This command does not validate credentials or inspect the remote database. Vite alone does not run `/api/*`; use `vercel dev` for live local serverless testing, or a Vercel preview.

## Supabase database and email sign-in

1. Open the project's SQL Editor. Apply `supabase/migrations/202610090001_workspace.sql` once on a fresh project. It creates the resumes table, row ownership policies, and per-user provider quotas. If the objects already exist, inspect the migration history before rerunning: this migration deliberately does not hide an existing conflicting schema.
2. In Authentication → URL Configuration, set **Site URL** to `https://jobai-orpin.vercel.app`. Add **Redirect URLs**: `https://jobai-orpin.vercel.app/account` and your intended preview's exact `/account` URL. Add local `/account` redirects only when testing locally. The application requests `/account` on the current origin. If the confirmation email still goes to localhost, inspect both the Confirm signup and Magic Link email templates: their sign-in anchor should normally use `{{ .ConfirmationURL }}`, rather than a hardcoded localhost link or `{{ .SiteURL }}` alone. Request a new email after correcting these settings; old emails retain their original links. These are Supabase dashboard settings, not `.env.local` values.
3. Keep the normal email-link templates with their `{{ .ConfirmationURL }}` links. The app asks users to retain the CV tab, open the email link in the same browser, and return; SDK session synchronization resumes their pending request. Optional code verification is available via “My email has a sign-in code.” To enable that alternative, add `Your sign-in code: {{ .Token }}` to both Magic Link and Confirm signup templates, retaining their links. This optional template edit is not required for link sign-in. Enable the email provider. Configure production email delivery/SMTP and check the project's actual sending limits. An accepted sign-in request does not prove the email arrived.
4. Set the environment variables, redeploy, and test with two separate users. Each should be able to create, reopen, update, and delete only their own CVs. An unsigned request to a paid provider must be rejected; a signed request must pass the quota RPC before calling the provider. Public remote discovery uses `/api/public-jobs`, requires neither account nor provider key, and must never invoke the paid endpoints.

## Public remote-job discovery

`/api/public-jobs` fetches the fixed Remotive public feed. The browser filters it by role/company text and stated location. It displays attribution, the source's original country restriction, and links back to the Remotive listing. Results are delayed by at least 24 hours, have limited coverage, and are not proof of eligibility. This feed is not a replacement for broad local/on-site JSearch coverage.

The fixed endpoint uses a six-hour CDN cache and a six-hour per-process cache, coalescing simultaneous refreshes within a process. No JSearch/Groq requests or signups are involved. Remotive advises no more than four feed fetches per day; per-process and regional CDN caching do not guarantee a global fetch ceiling across cold starts/regions. Verify deployed caching and request volume; use a single scheduled/shared feed cache before scaling traffic. Source guidance: [Remotive API documentation](https://github.com/remotive-com/remote-jobs-api).

See [Supabase redirect URL guidance](https://supabase.com/docs/guides/auth/redirect-urls) and [email-link authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless). Check current provider plans and limits in your accounts before public launch.

## Live acceptance still required

- Receive a sign-in email and return to the intended preview/production account page.
- Create and edit a CV, save it to the account, reload, reopen it, then delete it.
- Verify user isolation with a second account and server authorization/quota failures.
- Try AI drafting and existing PDF/DOCX import with real representative CVs; review factual accuracy and provider errors.
- Search for real jobs, open a valid employer link, prepare a cover letter, and confirm submission manually.
- Test mail delivery and unusual export lengths/languages on supported devices.

Automated provider tests use mocks; they do not establish live Groq quality, JSearch coverage, email delivery, or deployed database permissions. Local database tests verify the checked-in migration separately.
