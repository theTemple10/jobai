# Core-flow acceptance update — October 29, 2026

## Verified current state

- Supabase MCP calls reach the expected RoleAide project. CV/quota tables and quota function exist; CV ownership policies are present. SQL Editor provisioning did not populate migration history; do not rerun the migration just because history is empty.
- Live database transaction: created two random synthetic auth identities, exercised owner CV create/read/update/delete, rejected cross-user access and impersonated insert, checked AI requests 1–30 allowed/31 denied, job requests 1–40 allowed/41 denied, and separate user allowance. All assertions passed; the transaction was explicitly rolled back. No schema/auth configuration was changed, no email was sent, and no fixture records were committed.
- One actual Groq parse of a fictional CV returned 200. Expected name/target role/JavaScript skill were present; five skills, no invented paid-experience rows or contact fields in the checked profile. This is a single smoke test, not a general quality benchmark.
- One actual JSearch request based on that parsed role in Nigeria returned 200 and six listings, all with syntactically valid HTTP(S) application links and numeric text-evidence scores. Header reported 198 requests remaining. Employer pages were not individually checked; availability, freshness and eligibility remain candidate checks.
- These provider calls used local configuration directly. They do not establish production environment validity or a signed-in deployed end-to-end success.

## Authentication correction

The owner has not edited email templates. The app now prioritizes the existing email link; code entry is an explicit optional action. A same-browser, two-tab test verifies that a callback in the second tab establishes a session and resumes the original tab's selected CV. No token-template edit is needed for this path. The original tab must stay open; different browsers/origins do not share the session. Actual first-time/returning-user email delivery still requires verification.

Four targeted browser checks pass: email confirmation feedback, optional-code core flow including expired-code retry, cancellation preserving input, and email-link callback resuming the original tab. Their email, identity and provider responses are mocked. Prior regression/production-PDF evidence is in CORE_FLOW_ACCEPTANCE_2026-10-27.md. Lint, rebuilt production bundle and SEO checks pass after this change; the existing chunk-size warning remains.

## Deployment gap

Read-only checks found GitHub main still at 193b204 and the public homepage lacked the new primary upload-to-jobs action. The fixes had not been released. No core-workflow branch or PR existed remotely at inspection. Terminal push lacks Git credentials; the connected GitHub API is available for publishing the reviewed snapshot.

Next: publish a feature branch/draft PR, obtain CI and preview evidence, then release after the required critical-change notification/review. A preview's /account URL must be allowed by Supabase to test its email-link callback there; otherwise Supabase can return the user to production and the preview tab will not receive that origin's session. Production's existing allowed origin avoids that preview-specific configuration issue but still needs real acceptance after release.

## Advisory interpretation

- RLS with no policies on private.service_usage is intentional: clients cannot read the quota counters; the authenticated, auth.uid()-scoped security-definer RPC owns access.
- The quota function is deliberately callable by authenticated users and not by anon. Verified its source and ACLs before testing.
- Supabase's public rls_auto_enable function is an event-trigger function; the linter reports execute grants. No permission or platform-trigger changes were made. Review that hardening separately before broader launch: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Leaked-password protection is reported disabled. The current app uses email-link/code authentication; do not silently alter project-wide auth settings. Review if password login is enabled later: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Remaining acceptance

Actual email delivery; retained-tab login on the deployed origin; authenticated deployed parse/search; user review of extraction; original listing availability; real user pilot. A local/provider/database smoke test alone is not a claim that the live product is user-ready. No new database migration is needed for the verified existing objects.
