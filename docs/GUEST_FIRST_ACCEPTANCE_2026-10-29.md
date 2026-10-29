# Three-page correction: October 29, 2026

## Scope and actual release state

Owner contract: guest jobs/applications (including parsing and letters), authenticated CV builder/optimization, authenticated saved workspace. Email/password replaces primary magic-link entry. See [contract](PRODUCT_CONTRACT.md) and [issue records](issues/README.md).

Implementation branch: `feat/three-page-guest-first`, based on released main `562dcf6`. This report records local verification and the separately applied additive database change, not a claim that the new source is deployed. GitHub issue creation returned 403; R001–R006 are local prepared records, not published issues.

## Implementation

- Guest PDF/DOCX/image/pasted CV analysis, editable profile/skills/location/remote preference, actual JSearch retrieval and explained text-evidence ranking; no account gate.
- Guest editable cover letter with copy/TXT download and original application link. No hiring or applicant-pool guarantee.
- Email/password signup/login/recovery; signup confirmation explains signing in on each device. Google shown only when the real provider is configured. Unsigned builder shows account entry before tools.
- Account CV saves preserve changed versions instead of overwriting earlier snapshots. Optional owned application records include listing, profile evidence, letter and candidate-reported status; opening a page is not submission. Account changes remount the workspace so previous account rows cannot persist after a failed refresh.
- Shared atomic personal/global provider quotas and six-hour JSearch cache. Proof-protected RPCs keep private tables inaccessible to browser roles. Production config failures fail closed.
- Privacy/help/setup documentation updated to the current behavior; issue and PR templates added.

## Local verification

Supported cached Node 22, existing dependencies (no fresh npm install claimed):

- `npm run lint`: passed, no lint warnings after the preference dependency fix.
- `npm test`: all nine test files passed, including PGlite application-owner isolation, spoof rejection, invalid proof, guest/global quotas and cache expiry.
- `npm run build` and `npm run test:seo`: passed. Vite still reports the main-chunk size advisory.
- `npm run test:browser`: 30 passed. Provider/Auth network fixtures establish UI behavior, not actual email/Google delivery.
- `npm run test:production`: two passed. Real PDF/worker assets and extraction tested from the built app; missing-module recovery preserves an unsaved CV. AI output is mocked in these asset tests.

The CV-version test initially queried the device-save status rather than the account-save notice. Corrected the assertion to observe the actual new-version message; POST occurred and no PATCH overwrote the old CV.

## Actual service/database evidence

After advance notification, applied additive migration `guest_services_and_applications`, remote version `20261029133101`. Existing CV records/policies were not changed. Added owned `public.application_activity`, private quota/cache/settings tables and proof-protected functions; all new tables have RLS. The server capability verifier was configured, then rotated after its underlying secret appeared in a user-supplied IDE selection. The replacement verifier accepts the new local proof and rejects an invalid proof (HTTP 401). No secret or proof is recorded here.

Using fictional candidate facts and the actual local server handlers in production mode, without bearer authentication:

| Check | Observed result |
| --- | --- |
| Groq text CV parse | 200; checked name/JavaScript facts retained |
| JSearch search | 200; five listings, cache MISS |
| Repeated identical search | 200; same five listings, cache HIT |
| Groq cover letter | 200; 182 words, no checked guarantee claim |
| Groq synthetic image CV parse | 200; checked name/JavaScript facts retained |

These checks consumed one actual JSearch request and three Groq generation requests; normal quota/cache records remain. They are not deployed-browser acceptance or a general AI accuracy assessment. No real applicant CV was sent and no application was submitted. Model metadata confirmed the configured vision model was available.

Actual public Supabase Auth settings: HTTP 200, Email enabled, Google disabled. Owner previously reported correcting production callback settings and receiving an email. Current password signup/recovery delivery still requires real owner-controlled acceptance. No Auth template/provider configuration was changed by this implementation.

Post-migration security advisories were reviewed: private RLS/no-policy notices reflect intentional client denial; the three new SECURITY DEFINER RPCs intentionally accept browser roles but independently require server proof and fixed search paths. Wrong proof is tested. Existing `rls_auto_enable` execution advisory and disabled leaked-password protection remain; they were not silently changed. See [function-execution advisory](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Rollout and remaining gates

1. Owner confirmed the **replacement** local `SERVICE_ACCESS_SECRET` is saved in Vercel Preview and Production after rotation. Verify the next deployment actually uses it; no Vercel administrative API is exposed in this session.
2. Publish the reviewed feature branch, verify actual CI/preview and notify before production release. Existing Vercel previews may require owner access; a login page is not successful app acceptance.
3. Exercise the complete released guest flow and real account signup/password/recovery, saved versions/history, deletion and two-account access. Google remains conditional, not claimed operational.
4. Observe applicant pilots, verify spend/plan limits and private support, and produce the demo from verified behavior.

Rollback source by restoring the previous deployment/reverting the release. Leave additive tables protected and preserve new user history. Do not restore the exposed secret. Source deployment, cloud schema state and local checks are separate milestones.
