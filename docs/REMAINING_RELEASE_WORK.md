# RoleAide release work — October 26, 2026

This is the current product list. Local verification, remote deployment and observed user success are separate milestones. The October 19 production audit is historical; do not re-open already-fixed issues without checking current source.

## 1. PDF reader asset recovery and deployment

The reported production URL `/assets/pdf-BE5t8-JP.js` returned **404**. The current homepage referenced `/assets/pdf-CBRN-wbG.js`, which returned **200**. This supports an old open page or cached entry referring to a removed deployment asset; it does not identify which browser/cache retained the old reference.

Prepared local changes: revalidate HTML through `Cache-Control: no-cache`, retain operation errors while showing a persistent recovery notice on Vite preload failures, and offer an explicit reload rather than discarding an unsaved CV automatically. Replace the raw dynamic-module message in CV analysis with a useful instruction. No keys or CVs are included in this notice.

The first real production-PDF test also exposed a second import failure: the installed PDF.js version has `destroy()` on the loading task, not the document proxy. Cleanup threw after successful extraction and stopped analysis. The local parser now retains and destroys the loading task, including when loading rejects.

Added production-build browser checks using a real PDF and worker, plus an intercepted missing-module scenario that verifies an unsaved CV survives navigation back to the editor. Both production tests pass after the cleanup fix. These tests mock only the AI response; they do not establish real Groq CV-analysis quality. The existing development-browser tests did not previously cover this actual production chunk path.

Required before closing: complete checks, inspect a deployed preview, then verify the public routes' headers and PDF import on the released version. The local cache/recovery change is not live merely because tests pass. Existing open tabs can still need a manual refresh; this does not restore deleted old assets.

Local verification completed: lint, all seven Node test files, production build, generated SEO checks, both production-build browser tests and all 22 development-browser tests pass. No live CV/AI provider calls were made by these browser tests.

## 2. Account storage schema and live authorization

Latest direct Supabase resumes API probe returned `PGRST205`/404: the API schema cache cannot find `public.resumes`. Inspect schema, migration history and exposed schema/cache with authorized database access. Apply the checked-in migration only when appropriate; it is intentionally not idempotent. Do not blindly rerun it over existing objects/data.

Acceptance: a real account creates, reopens, edits and deletes its CV; a second account cannot read/update/delete the first account's records. Verify remote ownership policies and quota function, not only local PostgreSQL tests.

## 3. Hosted settings and actual sign-in

Required local environment fields are now present. Groq model metadata, one real JSearch search and Supabase Auth settings succeeded. These are local-credential/direct-provider checks, not proof of deployed Vercel settings or end-to-end app operation.

Verify existing Vercel project/environment, release commit, Supabase Auth redirect URLs and actual email delivery. Follow the email link, recover the intended draft and verify expired-session handling. Supabase/Vercel MCP definitions are configured but administrative tools are not exposed in this session; resolve authenticated access before claiming cloud setup is done.

## 4. Real document-to-application acceptance

Use consented or synthetic representative CVs through import → fact review/edit → PDF/Word download → real job search → reviewed letter preparation. Preserve education, projects, volunteering and optional sections. Check unusually long documents, language/font limits, malformed documents and unsupported scans/images. Real AI correctness and currently configured image-model support are unverified. Never promise hiring probability, universal ATS acceptance or automatic employer submission.

## 5. Operation, cost and data support

The single JSearch check reported 199 requests remaining; quotas reset according to the actual account plan. Per-user app quotas do not themselves establish a global provider spending ceiling. Confirm plan limits, aggregate cost controls, error monitoring, storage recovery/backups and a private support/deletion contact before wider release. Confirm revocation/replacement of the historically tracked SSH credential if it was valid; source removal is not revocation evidence.

## 6. Human pilot, proposition and pitch

After technical gates, observe at least three target applicants completing the promised workflow. Fix blocking friction, record actual outcomes/costs, and prepare the verified demo, one-page proposition and pricing/pilot hypothesis. No pilot users, paying customers or hiring outcomes have been established in this session. Continue the separate remote-work track while RoleAide remains the active product.

## Verification commands

Use supported Node 22. For a clean dependency install use `npm ci` when appropriate; current results must state whether installed dependencies or a fresh install were used.

```bash
npm run lint
npm test
npm run build
npm run test:seo
npm run test:production
npm run test:browser
```

Production browser tests require a fresh `dist` from `npm run build` and serve it on port 5174. Development browser tests use port 5173. The CI workflow is configured to run both and retain their failure traces; no remote CI result is claimed for this local change. Vercel cache headers are deployment configuration and must also be verified on the actual preview/production response.
