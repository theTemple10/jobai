# RoleAide acceptance — October 23, 2026

## Outcome

The guest workflow passes fresh checks, including two corrected draft-recovery failures. This is not production launch approval: real account, AI and job-provider acceptance remains open.

## Changes verified

- Starting a new CV now asks before discarding facts in excluded sections. Unsaved guided answers also count as draft work before they become exportable CV sections.
- A restored sign-in recovery copy is marked unsaved, enabling the existing refresh/leave protection until the user deliberately saves it. Recovery still consumes the consented temporary copy and does not silently enable device saving.
- Invalid recovery documents and expired/future-dated copies are rejected.

Both browser failures were reproduced before changing the implementation. New unit coverage also failed before the fix. The new browser cases verify cancellation preserves excluded skills and that a recovered CV can be explicitly saved, reloaded and reopened.

## Fresh verification

Runtime: cached Node **22.23.3**, used explicitly instead of the shell's Node 18 default. No runtime download or new service spending.

```bash
export PATH="/home/gamp/.npm/_npx/1838e33cf768caf6/node_modules/node/bin:$PATH"
npm run lint
npm test
npm run build
npm run test:seo
npm run test:browser
```

This path is an original-machine runtime hint. On another machine use a supported Node 22 runtime per `.nvmrc` and `package.json`.

Results: lint passes; all seven Node test files pass, including local PostgreSQL ownership/quota checks; production build and generated SEO checks pass; **22 Playwright tests pass**. Browser coverage includes real PDF/DOCX downloads, guided guest creation, import, keyboard typing, mobile layouts, device saving and simulated provider/error states. The browser server required execution outside this session's local-server sandbox restriction. No changes were made to production.

## Local configuration and external acceptance

`npm run check:config` was run without printing values. The local project URL variables are set; these required values are missing:

- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_PUBLISHABLE_KEY`
- `GROQ_API_KEY`
- `JSEARCH_KEY`

The migration file is present; its application to the remote project is unverified. Local absence does not prove those values are absent from production. Supabase and Vercel integrations were discovered as available but not connected. Victor chose to connect them; completion has not yet been confirmed.

After connection: inspect the existing deployment/project and settings without exposing secrets; verify migration/Auth redirects/email delivery; use two test identities for real CV create/read/update/delete and isolation; verify actual authenticated provider behavior and quota failures within confirmed cost limits. An accepted email request is not evidence of delivery. Do not substitute intercepted provider tests for live success.

Production URL retrieval through the web tool failed during this session; this does not establish that the site is down. No production settings, database rows, emails, paid provider calls or application submissions were changed or sent.

## Remaining release gates

Live integrations and owner isolation; private support contact and operating costs; confirmation of any historical credential revocation; release preview/production verification; representative user sessions and proposition/pitch handover. Refer to `SERVICE_SETUP.md` for configuration instructions. The older October 19 audit is historical and describes behavior before later fixes.
