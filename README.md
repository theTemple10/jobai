# JobAI

A guided CV builder and job-application preparation workspace by Philos Digital Labs.

Start with your own facts, import an existing CV, or choose sections and write a few pointers. Review the result, download a readable document, and prepare your next application.

## Implemented

- Navy, ivory, and gold landing page with light/dark themes, original daily encouragements, and a paper companion that respects reduced-motion preferences.
- Optional CV sections, editable facts, live preview, and reviewed PDF, Word, and plain-text exports.
- PDF/DOCX text extraction and optional image analysis when a vision-capable provider model is configured.
- Optional AI wording suggestions based on supplied facts, never a guarantee of correctness.
- Job search with deterministic listed-skill coverage, full posting context, truthful missing dates/salary, and explicit provider failures.
- Editable cover letters and external application-page assistance. The user submits on the employer's site.
- Device-local application activity with user-confirmed submission status; explicit device CV saving and deletion.
- Supabase email-link authentication and account CV insert/read/update/delete integration. These require the migration and environment configuration below; they are not automatically activated by cloning the repo.
- Supabase-backed atomic provider quotas, server-selected models/token limits, input validation, and timeouts.

ATS-friendly describes simple formatting and selectable text. JobAI does not promise a universal ATS score, employer acceptance, geographic eligibility, automated submission, or hiring probability. See [CV research and acceptance criteria](docs/ATS_RESEARCH.md).

## Local development

Use **Node 22.12+ within the Node 22 series** (`.nvmrc` is included).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Vite serves the UI at `http://localhost:5173`. It does not execute Vercel serverless functions. Use authenticated `vercel dev` for live local API testing; the manual CV builder and exports work with Vite alone.

Supabase project: `https://qxhkrepvoqnsxcofarno.supabase.co`.

Apply `supabase/migrations/202610090001_workspace.sql` once. Add the project's publishable key to `VITE_SUPABASE_PUBLISHABLE_KEY` and server `SUPABASE_PUBLISHABLE_KEY`, and its URL to the matching URL variables. Configure Supabase Auth's Site URL and allowed redirect origins. Never put a service-role key, database password, or AI provider secret in a `VITE_` variable.

`GROQ_API_KEY` and `JSEARCH_KEY` are server-only. The server selects `GROQ_TEXT_MODEL`, defaulting to `openai/gpt-oss-120b`. Image analysis is unavailable until a verified `GROQ_VISION_MODEL` is set. Production provider endpoints require authenticated access and the quota RPC; they fail closed if setup is incomplete. Guest CV creation/download remains available.

EmailJS is optional, uses the three `VITE_EMAILJS_*` public values in `.env.example`, and sends only when the user opts in. Delivery failures are reported independently of application activity.

## Checks

```bash
npm run lint
npm test
npm run build
npm run test:browser
```

Browser checks use locally installed Chrome. In CI, Playwright uses Chromium. Install it with `npx playwright install --with-deps chromium` and set `CI=true` when using that browser locally. PDF text checks require `pdftotext` (Poppler). CI installs it.

Regression tests cover document section exclusion, profile validation, deterministic job data, provider constraints, daily encouragement, and PostgreSQL ownership/quota behavior using a local PGlite database. Browser tests cover small-screen layouts, real exports with accented names, Word import, draft recovery, confirmed application activity, and service failures. Mocked browser provider checks do not prove live AI quality or email delivery.

## Architecture

```text
src/ProductApp.jsx        Landing, builder, workspace navigation and sign-in state
src/components/          LandingPage, ResumeBuilder, AccountPanel
src/lib/resume.js         Shared factual document model and completeness guidance
src/lib/exportResume.js   PDF, Word, and plain-text exports
src/lib/parseDocument.js  PDF and DOCX text extraction
src/lib/jobs.js           Deterministic job normalization and profile validation
src/lib/supabase.js       Public client and account CV queries (RLS protected)
src/index.jsx            Existing job discovery, cover letters, local activity
api/                     Vercel provider endpoints
server/protection.js     Verified account identity and shared hourly quotas
supabase/migrations/     CV ownership policies and atomic usage counters
```

Exports use open-licensed Noto Sans for PDF and standard Word paragraphs. Font licensing is included under `public/fonts/OFL.txt`. Document parsers and export tools load separately from the initial landing-page bundle.

## Delivery and current limits

Vercel target: `thetemple10s-projects/jobai`. Use feature-branch previews and review before changing production. See [delivery/configuration plan](docs/DELIVERY_PLAN.md).

Account saving needs deployed Supabase configuration and live verification. Application activity and cover-letter drafts currently remain on the device. CV editing is manual with optional summary wording assistance; comprehensive job-specific CV tailoring is a future batch. PDF font coverage and export pagination should be checked for each supported language and unusually long document. Scanned PDFs need image conversion or manual entry.

Operating cost depends on provider plans, traffic, token usage, and hosting terms; no permanent $0 operating claim is made. The baseline assessment in [CODEBASE_REVIEW.md](CODEBASE_REVIEW.md) records the pre-change findings, not the current implementation state.
