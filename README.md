# RoleAide

A guided CV builder, job-discovery tool, and application-preparation workspace by Philos Digital Labs.

Start with your own facts, import an existing CV, or choose sections and write a few pointers. Review the result, download a readable document, and prepare your next application.

## Implemented

- Navy, ivory, and gold landing page with light/dark themes, original daily encouragements, and a paper companion that respects reduced-motion preferences.
- Guided first-CV intake: role choices, relevant-category checkboxes, short notes, and selectable skills. Arrange original words without AI or review an optional AI draft before applying it.
- Optional CV sections, editable facts, live preview, and reviewed PDF, Word, and plain-text exports.
- PDF/DOCX text extraction and optional image analysis when a vision-capable provider model is configured.
- Optional AI wording suggestions based on supplied facts, never a guarantee of correctness.
- Job search with deterministic listed-skill coverage, full posting context, truthful missing dates/salary, and explicit provider failures.
- Editable cover letters and external application-page assistance. The user submits on the employer's site.
- Optional account-owned application history, cover letters and user-reported statuses; explicit device CV saving and deletion.
- Supabase email/password signup, login and recovery, configured Google entry, protected builder, and account CV version history. These require the migration and environment configuration below; they are not automatically activated by cloning the repo.
- Supabase-backed atomic provider quotas, server-selected models/token limits, input validation, and timeouts.

ATS-friendly describes simple formatting and selectable text. RoleAide does not promise a universal ATS score, employer acceptance, geographic eligibility, automated submission, or hiring probability. See [CV research and acceptance criteria](docs/ATS_RESEARCH.md).

## Local development

Use **Node 22.12+ within the Node 22 series** (`.nvmrc` is included).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Vite serves the UI at `http://localhost:5173`. It does not execute Vercel serverless functions. Use authenticated `vercel dev` for live local API testing; the authenticated manual CV builder and exports need no live AI endpoints.

Supabase project: `https://qxhkrepvoqnsxcofarno.supabase.co`.

Apply the migrations in order as described in the service setup guide; inspect remote history first. Add the project's publishable key to `VITE_SUPABASE_PUBLISHABLE_KEY` and server `SUPABASE_PUBLISHABLE_KEY`, and its URL to the matching URL variables. Configure Supabase Auth's Site URL and allowed redirect origins. Never put a service-role key, database password, or AI provider secret in a `VITE_` variable.

`GROQ_API_KEY` and `JSEARCH_KEY` are server-only. The server selects `GROQ_TEXT_MODEL`, defaulting to `openai/gpt-oss-120b`. Vision defaults to `qwen/qwen3.8-27b`; verify availability for the connected provider account. Guest parsing, job search and cover letters use proof-protected shared quotas and cached listings, without account creation. Set the server-only `SERVICE_ACCESS_SECRET` and database verifier as documented. CV drafting/optimization and the builder require sign-in; incomplete provider configuration fails closed.

EmailJS is optional, uses the three `VITE_EMAILJS_*` public values in `.env.example`, and sends only when the user opts in. Delivery failures are reported independently of application activity.

See [live service setup](docs/SERVICE_SETUP.md) for the exact key names, database migration, Auth redirects, and remaining live acceptance tests. Run `npm run check:config` to list missing configuration without printing values. The intake design and competitor references are recorded in [guided CV research](docs/GUIDED_CV_RESEARCH.md).

## Checks

```bash
npm run lint
npm test
npm run build
npm run test:browser
npm run test:production
```

Browser checks use locally installed Chrome. In CI, Playwright uses Chromium. Install it with `npx playwright install --with-deps chromium` and set `CI=true` when using that browser locally. PDF text checks require `pdftotext` (Poppler). CI installs it.

Regression tests cover document section exclusion, profile validation, deterministic job data, provider constraints, daily encouragement, and PostgreSQL ownership/quota behavior using a local PGlite database. Browser tests cover small-screen layouts, real exports with accented names, Word import, draft recovery, confirmed application activity, and service failures. Mocked browser provider checks do not prove live AI quality or email delivery.

## Architecture

```text
src/app/                 App shell and navigation
src/features/resume/     Guided intake, editor, document model, parsing and exports
src/features/jobs/       Discovery, application preparation and activity
src/features/account/    Sign-in, workspace and Supabase queries
src/features/marketing/  Landing, public information and encouragement
src/shared/              Shared components, services, brand and styles
api/                     Vercel provider endpoints
server/                  Identity, quotas and provider operations
supabase/migrations/     CV ownership policies and atomic usage counters
```

See [source organization](docs/ARCHITECTURE.md) for the boundaries and entry points.

Exports use open-licensed Noto Sans for PDF and standard Word paragraphs. Font licensing is included under `public/fonts/OFL.txt`. Document parsers and export tools load separately from the initial landing-page bundle.

## Delivery and current limits

Vercel target: `thetemple10s-projects/jobai`. Use feature-branch previews and review before changing production. See [delivery/configuration plan](docs/DELIVERY_PLAN.md).

Account saving needs deployed Supabase configuration and live verification. Explicitly tracked applications/letters are stored in the owned workspace; guest letters remain in the tab. CV creation supports guided notes, optional AI drafting, and the section editor; comprehensive job-specific CV tailoring is a future batch. PDF font coverage and export pagination should be checked for each supported language and unusually long document. Scanned PDFs need image conversion or manual entry.

Operating cost depends on provider plans, traffic, token usage, and hosting terms; no permanent $0 operating claim is made. The baseline assessment in [CODEBASE_REVIEW.md](CODEBASE_REVIEW.md) records the pre-change findings, not the current implementation state.


## RoleAide refresh

The product now uses RoleAide as its working public identity. The GitHub repository, Vercel project, Supabase target, and existing `jobai_*` device/database keys keep their current names so integrations and returning users retain their data. No new domain has been purchased or claimed.

The Find Jobs workspace supports direct role/location search without a CV upload, one provider request per submitted search, skill-context cards, filters, and distinct service/error/loading states. Guest search does not require sign-in.

New URLs are `/builder`, `/jobs`, `/account`, `/privacy`, and `/help`. Existing `/#/...` links continue to resolve. The build renders public landing/help/privacy HTML, creates workspace pages with `noindex`, and generates canonical metadata, sitemap, robots file, manifest, and social tags. Only public information pages belong in the sitemap. `VITE_PUBLIC_SITE_URL` must be the real production HTTPS origin; it defaults to the existing Vercel domain. Preview builds get `noindex` metadata. A domain change needs this setting updated and a rebuild, plus Auth redirect settings and Search Console verification.

Run `npm run build` followed by `npm run test:seo` to validate public markup, workspace indexing, and icon dimensions. The SVG source files in `public/` are the editable identity assets. `og-image.png` is a 1200×630 social image; favicon variants include 32, 192, and 512 pixels, plus a 180-pixel Apple touch icon.

Device autosaving is off until explicitly enabled. An unsaved-work browser warning protects active edits where supported. A sign-in recovery copy requires consent, restores for up to 30 minutes, and is removed when the app next starts. Account email delivery and each production release still require live acceptance testing. See [the product contract](docs/PRODUCT_CONTRACT.md) and [prepared delivery issues](docs/issues/README.md).
