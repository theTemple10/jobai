# RoleAide release candidate

Working branch: `feat/career-workspace-refresh`.

## Scope

- Fix natural CV typing, including trailing spaces, newlines, and achievement lists.
- Preserve imported optional sections and project/community evidence in application preparation.
- Validate legacy device data and provide a recoverable rendering error screen.
- Fix skip navigation, explicit import intent, saved-letter actions, empty exports, and unsupported remote-eligibility claims.
- Add opt-in device autosaving, saved-state feedback, unsaved-work protection, short-lived consented sign-in recovery, and saved-CV deletion confirmation.
- Introduce a responsive job-search workspace with direct role/location search, fewer provider requests, skill context, accessible result cards, and service recovery actions.
- Adopt the owner-selected RoleAide identity: original document/forward-arrow mark, wordmark, favicon exports, hero illustration export, and social-sharing image. Keep the warm navy/ivory/gold direction.
- Add real URL routing, built public HTML, canonical and social metadata, public sitemap/robots, private-workspace noindex, help/data information, and CI checks for generated SEO assets.

## Name and publishing

The owner selected RoleAide after public searches revealed direct career-service collisions for CareerSprint and JobAid. Initial searches found no obvious exact-name career service for RoleAide; this is not a domain reservation, trademark clearance, or claim of global uniqueness. No domain, repository, project, or database has been renamed remotely.

The existing Vercel domain remains the canonical default until a real production domain is selected. Configure `VITE_PUBLIC_SITE_URL`, verify its ownership, and update Supabase Auth redirect settings before switching domains. The source key names remain stable to preserve existing work.

## Remaining external acceptance

The audit confirmed that production account configuration was inactive. This code change cannot establish that remote setup is complete. Verify the supplied Supabase migration, browser/server environment values, email delivery and redirect URLs, two-user CV ownership, quota behavior, actual Groq output and any vision model, and JSearch credentials/coverage. No real applications or emails were sent as part of this release work.

Set a private support contact (`VITE_SUPPORT_EMAIL`) before wider release. The current data/help pages describe the implemented behavior and disclose incomplete account closure; they are not a compliance certification. Production error alerting, provider budget limits, representative AI evaluations, and a small human pilot remain release requirements.

## References

- Baseline findings: `PRODUCTION_REVIEW_2026-10-19.md` (historical before these fixes).
- Google guidance for real URL routing: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- Google guidance for structured data and truthful eligibility: https://developers.google.com/search/docs/appearance/structured-data/software-app
- Existing CareerSprint service: https://aicareersprint.com/
- Existing JobAid AI service: https://www.linkedin.com/company/jobaid-ai

## Verification for this candidate

- Lint and production build pass with Node 22; generated HTML/SEO/icon checks pass.
- Seventeen regression tests pass, including PostgreSQL ownership/quota tests and added editing/data/routing coverage.
- Sixteen browser tests pass; targeted device-saving, restored-letter, and responsive-detail checks also pass after the final layout correction.
- Twelve initial route/theme accessibility scans found no confirmed violations. Separate mobile job-detail scans pass in light/dark modes after badge contrast fixes. Some dark-mode contrast checks remain manual; this is not a claim of complete accessibility conformance.
- New direct job-search and letter-success scenarios use intercepted provider responses. Exports are actual browser downloads. Real Supabase/Auth/Groq/JSearch/EmailJS acceptance remains outstanding.
- Screenshots and the social asset were visually inspected. A squeezed mobile detail title was corrected with an explicit header grid and a separate coverage row; width-only tests were strengthened to catch that failure.
