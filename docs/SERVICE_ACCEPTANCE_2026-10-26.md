# RoleAide service checks — October 26, 2026

Checks used the owner's local configuration without printing key values, personal data or provider response bodies. All required environment values are now present, browser/server Supabase project settings match, and the publishable-key fields contain matching non-service-role keys. Presence and successful authentication do not establish full workflow acceptance.

| Check | Observed result | What remains |
| --- | --- | --- |
| Supabase Auth settings | HTTP 200; email provider enabled | Actual sign-in email delivery, redirects and account session |
| Supabase `resumes` API, anonymous metadata-only request (`select=id&limit=0`) | HTTP 404; `PGRST205` | Inspect actual database/migration state and schema exposure/cache. The table was not found by the API; this check alone does not prove the physical database has no table. |
| Groq model-list request | HTTP 200; configured text model listed | Real drafting correctness, application authorization and quota behavior; no text generation performed |
| JSearch search request | HTTP 200; five results; response reported 199 requests remaining | Authenticated application integration, posting coverage/freshness and account-specific reset/billing details |

Exactly one JSearch search request completed. Groq check only listed models. No CV content was sent, no account was created, no email was sent, and no database records, migrations, production settings or deployments were changed. The initial sandbox attempt failed DNS before reaching the services; the successful checks required approved network access.

## Agent connections

Supabase and Vercel MCP server definitions exist in the configuration used by this VS Code Codex installation. CLI listing reports both enabled with authentication status `unknown`; this session does not expose either server's tools. This establishes configured server entries, not successful authenticated administrative access. Vercel project/settings/deployment access remains unverified. No OAuth credentials were inspected or copied.

## Next acceptance step

With authorized database access, inspect schema and migration history before applying `supabase/migrations/202610090001_workspace.sql`. It is intentionally not an idempotent migration: do not blindly re-run it against partially applied objects or existing data. The current missing-table API response prevents treating account CV saving as working.

After storage is configured, verify actual sign-in and two-user create/read/update/delete isolation, then authenticated application AI/job requests and service limits. Inspect the existing Vercel project/environment and verify a preview before any production release. Never replace these checks with the successful direct-provider smoke checks above.
