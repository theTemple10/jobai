# Live services: three-page contract

Guest CV parsing, job search and cover letters do not require an account. The CV builder and saved progress workspace do. See [the product contract](PRODUCT_CONTRACT.md). This guide supersedes the earlier mandatory sign-in/link flow.

## Environment

Use Node 22.12+ (Node 22 series). Fill ignored `.env.local` and the corresponding Vercel Preview/Production settings; redeploy after saving. Never post secrets or commit that file.

| Variable | Source / purpose |
| --- | --- |
| `GROQ_API_KEY` | Groq console API key; server-only analysis/writing |
| `JSEARCH_KEY` | RapidAPI JSearch subscription API key; server-only listings |
| `SUPABASE_URL`, `VITE_SUPABASE_URL` | Same Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Same public project publishable key, never service-role |
| `SERVICE_ACCESS_SECRET` | Generated server-only capability for shared quotas/cache; minimum 32 characters |
| `VITE_PUBLIC_SITE_URL` | Production HTTPS origin, currently `https://jobai-orpin.vercel.app` |
| `VITE_SUPPORT_EMAIL` | Optional monitored private support inbox |

Never prefix provider keys or `SERVICE_ACCESS_SECRET` with `VITE_`. The browser needs only public configuration. No service-role key or database password is required by the application.

Text defaults to `openai/gpt-oss-120b`; vision defaults to `qwen/qwen3.8-27b`. Overrides `GROQ_TEXT_MODEL` / `GROQ_VISION_MODEL` must identify models available to the actual Groq account. Images require vision; text PDF/DOCX extraction runs in the browser. Optional EmailJS copies use the public `VITE_EMAILJS_*` settings.

`npm run check:config` checks presence only, never prints values and does not establish live acceptance. Vite alone serves UI, not Vercel API functions; use `vercel dev` or a preview for live APIs.

## Database and server capability

Notify the owner before database or security changes, explaining scope, risks and recovery. On a fresh project, apply in order:

1. `supabase/migrations/202610090001_workspace.sql` — CV ownership and original account quota support.
2. `supabase/migrations/20261029133101_guest_services_and_applications.sql` — owned application history and private guest quota/cache/settings tables. Already applied to the current project on October 29, version `20261029133101`; do not rerun blindly.
3. Run `node scripts/configure-service-access.mjs` locally. It creates a secret only if absent/invalid, and writes hash-only SQL to `/tmp/roleaide-service-verifier.sql`. Apply that verifier SQL using an administrative connection, then set the same local secret in Vercel Preview and Production. Neither the secret nor its derived proof belongs in browser code.

The RPCs accept the publishable key but require a derived server proof; missing/wrong proof fails closed. Private tables intentionally have RLS enabled with no client policies or direct client grants. Application-history policies restrict CRUD to the record owner; CV policies remain unchanged.

For a necessary rotation, notify the owner, run the helper with `--rotate`, apply its replacement verifier, update both Vercel environments and redeploy together. An intermediate mismatch makes the new provider routes unavailable. Never recover by restoring an exposed secret. Keep the previous source deployment available during rollout; its older provider flow does not depend on this verifier.

Initial limits: guest AI 5/hour, authenticated AI 30/hour; AI global 300/day and 3,000/month. Uncached guest jobs 10/hour, authenticated jobs 40/hour; JSearch global 15/day and 90/month. Six-hour shared job cache hits consume no JSearch requests. These are conservative pilot limits, not a promise that a provider plan is free or sufficient. Adjust only after checking actual subscription and usage. Visitor identifiers are keyed hashes, not raw IP addresses; shared-network users can share a guest allowance.

## Standard account entry

Enable Supabase Email authentication with password signup/login. Set Site URL to the production origin, and allow its exact `/account` redirect plus intended preview/local callback URLs. Keep `{{ .ConfirmationURL }}` in Confirm signup and Reset password templates. No `.Token` template edit is needed by the current flow.

First-time users confirm their email, then sign in with email/password on any device. Existing magic-link-only users can set a password through Forgot password. Confirmation on a phone does not create a PC session. Verify real email delivery and SMTP limits.

Google entry appears only if the actual public Auth settings report Google enabled. Configure Google credentials and allowed callback/origins in the provider dashboards before claiming Google is operational. Do not publish placeholder credentials or a nonfunctional button.

## Public remote feed

`/api/public-jobs` remains an optional Remotive alternative with attribution, stated country restrictions and a six-hour process/CDN cache. Listings are delayed at least 24 hours and eligibility must be checked. Per-process caching does not guarantee a worldwide fetch ceiling across cold starts/regions; use shared feed caching before scaling. [Remotive source guidance](https://github.com/remotive-com/remote-jobs-api).

## Release acceptance

Distinguish local source, published branch, protected preview, and verified production. Require lint, Node/database tests, production build, public-page checks, browser flows and built-asset checks. Mocked tests establish behavior, not provider quality or email delivery.

Use a fictional CV for real guest text/image/PDF → preferences → jobs → cover-letter copy/download → original listing checks. Verify cache hits and denied proof/quota paths. Test email/password signup, confirmation, login and recovery with a real owner-controlled email. Verify two-account CV/application isolation, saved versions, status edits and deletion. Review actual provider charges/allowances.

Rollback source by reverting the release/restoring the previous Vercel deployment. Leave new tables protected and preserve records created after release; do not drop user history to undo UI changes.
