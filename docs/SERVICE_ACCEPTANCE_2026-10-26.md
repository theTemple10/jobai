# RoleAide service checks — October 26, 2026

Checks used the owner's local configuration without printing key values, personal data or provider response bodies. All required environment values are now present, browser/server Supabase project settings match, and the publishable-key fields contain matching non-service-role keys. Presence and successful authentication do not establish full workflow acceptance.

| Check | Observed result | What remains |
| --- | --- | --- |
| Supabase Auth settings | HTTP 200; email provider enabled | Actual sign-in email delivery, redirects and account session |
| Supabase `resumes` API, anonymous metadata-only request (`select=id&limit=0`) | October 26: 404/PGRST205. October 27 after owner-reported migration: 401/42501, access denied as expected | The table is now recognized and anonymous access is denied. Authenticated CRUD and two-user isolation still need live acceptance. |
| Groq model-list request | HTTP 200; configured text model listed | Real drafting correctness, application authorization and quota behavior; no text generation performed |
| JSearch search request | HTTP 200; five results; response reported 199 requests remaining | Authenticated application integration, posting coverage/freshness and account-specific reset/billing details |
| Production `/api/jobs?query=developer`, no authorization header | Recheck after owner's configuration fix: HTTP 401; "Please sign in to use AI assistance and live job search." Previously HTTP 503. | The server configuration gate now passes and unauthenticated requests are rejected as expected. Valid Supabase credentials, actual sign-in, database access and authenticated provider requests still need verification. This request stops before quota/provider calls. |

Exactly one JSearch search request completed. Groq check only listed models. No CV content was sent, no account was created, no email was sent, and no database records, migrations, production settings or deployments were changed. The initial sandbox attempt failed DNS before reaching the services; the successful checks required approved network access.

## Agent connections

Supabase and Vercel MCP server definitions exist in the configuration used by this VS Code Codex installation. CLI listing reports both enabled with authentication status `unknown`; this session does not expose either server's tools. This establishes configured server entries, not successful authenticated administrative access. Vercel project/settings/deployment access remains unverified. No OAuth credentials were inspected or copied.

## Next acceptance step

The production server configuration blocker is cleared by the latest unauthenticated probe. Browser configuration and actual sign-in still require acceptance testing; local `.env.local` changes alone do not configure hosted functions.

The owner inadvertently included a Groq credential in chat through an IDE selection, then reported completing the fix. Rotation/replacement is user-reported, not independently verified. No credential value is recorded here.

October 27: owner supplied a read-only schema result showing both `public.resumes` and `public.consume_service_quota(text)` absent, then ran `supabase/migrations/202610090001_workspace.sql` and reported “Success. No rows returned.” A follow-up zero-row anonymous CV request returned 401/42501, replacing the missing-table response. Do not rerun the migration. Authenticated account storage and quota behavior remain to be tested live.

After storage is configured, verify actual sign-in and two-user create/read/update/delete isolation, then authenticated application AI/job requests and service limits. Inspect the existing Vercel project/environment and verify a preview before any production release. Never replace these checks with the successful direct-provider smoke checks above.
