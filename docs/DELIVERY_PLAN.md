# JobAI delivery plan

## Branches and review

`feat/product-foundation` is the integration branch. Keep `main` as the production baseline while previews are reviewed. Small commits identify the dependency order:

1. Trustworthy API/data foundation: deterministic skill coverage, truthful dates/salary, no fictional outage fallback, validated bounded provider operations, supported runtime, and removal of tracked key material.
2. Landing and CV workspace: reference-inspired visual system, reduced-motion-safe illustration, daily encouragements, guided sections, import, review, editable preview, and PDF/Word exports.
3. Persistence and release readiness: Supabase ownership migration, configuration, CI/browser checks, documentation, and preview handoff.

For genuinely independent future work, branch from the integration branch (`feat/cv-tailoring`, `feat/application-workspace`, or `feat/accessibility`) and merge via focused PRs. Branches and PRs expose technical ownership and review history; they do not establish multiple contributors when one person or agent performed the work.

## External configuration

Vercel target: `thetemple10s-projects/jobai`.
Supabase target: `https://qxhkrepvoqnsxcofarno.supabase.co`.

1. Apply `supabase/migrations/202610090001_workspace.sql` once to the Supabase project.
2. Add the public project URL and publishable key to Vercel using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
3. Set server `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to the same project values. Do not use a service-role key in the browser.
4. Configure Supabase Auth Site URL and allowed redirect origins for production and the preview under review. Redirects use the site's origin. Configure email delivery appropriate to the pilot.
5. Supply server-only Groq/JSearch secrets and verified model settings. Text default is `openai/gpt-oss-120b`; image analysis remains disabled until a compatible vision model is configured and tested.
6. The migration includes atomic Supabase-backed hourly quotas: 30 AI requests and 40 job-provider requests per user. Production provider endpoints fail closed if account/quota configuration is absent. Guest CV editing/export remains usable.
7. Use Node 22 for Vercel builds. The project specifies the Node 22 engine and `.nvmrc`.

Use `.env.example` as the variable inventory. Keep secrets in local environment files or provider settings. No billing plan, provider subscription, or paid resource was created automatically.

## Preview deployment

Push the feature branch to the connected GitHub repository. If Vercel's Git integration is enabled for this branch, it will create a preview. Verify the build/deployment status and return its actual URL; a Git push alone is not evidence of successful deployment. Alternatively use an authenticated Vercel integration to deploy a preview to the same project.

Never describe account saving, external providers, or image parsing as live before the configuration and end-to-end checks are complete. Local draft storage and account CV storage are separate. Application activity currently remains device-local; account synchronization of activity is a later batch.

## Release checks

- Clean installation with supported Node; lint, regression tests, and production build.
- Browser checks for 320/375/768/1440 widths, actual document exports, explicit local draft recovery/deletion, import, error states, and user-confirmed submission.
- Verify authentication and CV insert/read/update/delete with two separate test users. Confirm RLS denies cross-user access. No authenticated cloud check can be replaced by a client-only mock.
- Provider smoke checks using a consented or synthetic profile, checking failures, quotas, latency, and cost.
- A small pilot to assess task completion, relevance, preparation time, and return use.

## Repository credential follow-up

The original tracked `jobai` file was identified as an OpenSSH private key without reading its contents. Remove it from tracked source while preserving the local file. Its historical presence in a public repository remains a separate exposure: revoke/replace the associated credential if valid. Removing a file from a feature branch does not clean existing `main` or past commits. History rewriting and remote credential revocation need the relevant service context.
