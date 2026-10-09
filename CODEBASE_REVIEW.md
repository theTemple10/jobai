# JobAI codebase and product review

Reviewed 9 October 2026. This is a source-level baseline before implementation changes.

## Assessment

JobAI has a coherent prototype: extract a CV, review a profile, discover jobs, draft a cover letter, and open an application page. It demonstrates useful integration work. It does not yet provide enough reliability, truthful feedback, or evidence of user value to present as a mature public product or flagship engineering project.

The next phase should establish trustworthy behavior before visual polish. Product demand and recommendation rates cannot be inferred from source code; they require observed use.

## Architecture and ownership

| File | Responsibility |
| --- | --- |
| `src/main.jsx` | React mount, StrictMode, Vercel Analytics |
| `src/index.jsx` | Approximately 1,531 lines containing all workflow components, prompts, API calls, file parsing, theme management, notifications, and persistence |
| `src/index.css`, `tailwind.config.js` | Light/dark theme tokens and utility styling |
| `api/groq.js` | Vercel function forwarding AI requests with a server-side API key |
| `api/jobs.js` | Vercel function forwarding search requests to JSearch |
| `src/api.js` | Unused legacy direct-browser Anthropic integration; would expose a Vite-prefixed secret if activated |
| `src/App.css`, starter assets | Apparently unused starter material |
| `README.md` | Product claims and setup instructions, several inconsistent with implementation |

Actual dependencies are React 19, Vite 8, Tailwind 3, and Vercel Analytics. No account service, database, automated test suite, or CI workflow is present in the inspected files. PDF.js, Mammoth, and EmailJS are dynamically loaded from third-party CDNs. React state drives navigation; profile, workflow step, theme, and application records persist in localStorage. Job results and cover-letter drafts do not persist.

The active frontend sends AI requests to `/api/groq` and searches to `/api/jobs`; the active flow does keep provider keys server-side. These are two thin integration proxies rather than a backend that validates product operations.

## Current user journey

1. Upload a PDF, DOCX, or supported image, optionally adding freeform context.
2. Extract document text locally or send an image for vision analysis. Ask AI for a JSON profile.
3. Review profile information. Edit name/title and remove skills; most other information is read-only.
4. Search up to three suggested titles, plus an extra remote query for selected professions. Normalize, deduplicate, score, and display results.
5. Filter results or open details. Generate and edit a cover letter.
6. Copy the letter and open the external application page. The user submits on that external site.
7. Store an application-related record locally; optionally attempt an EmailJS notification.

The five-step indicator never advances to its fifth step: details/application assistance remain inside workflow step 3.

## Findings in priority order

### Immediate repository and reliability issues

- **Tracked private key:** `file jobai` identifies an OpenSSH private key, and `git ls-files jobai` confirms it is tracked. Its contents were not opened. Whether it is active or grants access was not established. Treat it as exposed if valid: revoke/replace it at the relevant service, remove it from tracked source, and assess history cleanup. Merely deleting the current file does not revoke a key or remove past commits. No credentials or Git history were changed during this review.
- **Retired AI model IDs:** `src/index.jsx:184` hard-codes Llama 3.3 70B and Llama 4 Scout. Groq documents retirement of these IDs for free/developer accounts on 16 August 2026 and 17 July 2026 respectively, with enterprise committed-spend exceptions. This makes the claimed free-tier flow a likely failure point today. Select and verify an available model with the required modality; a text replacement alone does not establish image support. Source: [Groq deprecations](https://console.groq.com/docs/deprecations).
- **Local setup mismatch:** the lockfile requires Node `^20.19.0 || >=22.12.0` for Vite/plugin-react, while README says Node 18+. The current environment is Node 18.19.1. Vite alone does not run the Vercel functions and there is no local proxy configuration.

### Trust and correctness

- **Randomized match percentages:** `src/index.jsx:706–709` computes `min(98, 65 + skillMatches * 4 + random(0..7))`. This is substring matching, not AI ranking or a calibrated suitability probability. Zero skill overlap still earns 65–72%. A reproducible relevance rubric should expose matched evidence, missing criteria, and uncertainty without suggesting hiring odds.
- **Invented posting dates and urgency:** missing dates receive random ages of 1–14 days (`:702–704`). Ages of three days or less are labeled urgent (`:735`, `:943`) even though recent posting does not establish urgency.
- **Fictional fallback jobs:** search failures call `sampleJobs` (`:805–821`), displaying TechCorp, GlobalBank, and Startup Inc alongside realistic salaries, sources, and scores. A temporary error toast does not distinguish these cards from real opportunities. Demo data needs an explicit mode; outages and genuine empty searches need honest states.
- **Opened is labeled applied:** `oneClickApply` and `manualApply` record an action when opening a page (`:1039`, `:1070`). Cards and details say “Applied”/“already applied” (`:944`, `:1127`) without knowing whether submission happened. Track saved, opened, draft prepared, and user-confirmed submitted separately.
- **False delivery/copy success:** missing EmailJS configuration returns successfully (`:201–204`), so assistance can claim a confirmation email was sent. Clipboard failures are swallowed, yet success copy still says the letter was copied. Email notifications contain an activity message, not the cover letter promised in README.
- **Insufficient job context:** normalization truncates descriptions to 180 characters and qualifications to three items (`:729–732`). Cover letters use that truncated context (`:1003–1004`). Preserve complete source details and distinguish card summaries from generation input.
- **Salary/data semantics:** the formatter turns a USD 20–30 hourly range into `USD0k – 0k`. “Industry” is populated with the publisher. Missing employment type becomes Full-time. “Remote (Anywhere)” implies geographic eligibility that a remote flag does not establish.

### Public-operation resilience

- `/api/groq` forwards the complete request body, including caller-selected model and token limit. An isolated mocked request confirmed that an arbitrary model and `max_tokens: 999999` pass through unchanged. Provider limits may reject it, but the application does not impose its own operation boundaries.
- Its IP counter lives in instance memory, resets on cold starts, and is not shared between instances. `/api/jobs` has no application-level rate limit and forwards all query parameters. No shared budget, request schema, operation allowlist, server-side search cache, or upstream timeout is implemented.
- Search issues three or four upstream calls per new location in a normal eligible profile. Browser caching helps only the current component/session. For example, 100 such searches imply roughly 300–400 upstream calls before retries. Monthly cost cannot be estimated honestly without the subscribed plan, traffic, token use, and cache behavior.
- Search responses are parsed without checking HTTP status. Provider authentication, quota, and outage errors can collapse into generic “no results” and fictional fallback cards.
- AI JSON is parsed without validating field types or shape (`:474`). Valid JSON with malformed arrays/objects can crash downstream rendering. Extraction prompts also ask AI to estimate salary without a grounded market source.
- Parsing has no cancellation/timeout and delayed callbacks can run after reset/unmount. Loading percentages are timer-driven rather than actual task completion. StrictMode's effect cleanup combined with the `done` ref can stop the progress interval during development.
- Personal details are sent to the AI provider and the extracted profile persists on the device. There is no pre-upload explanation of this flow, persistence choice, or separate delete/export control. Fresh Start deletes application history together with the profile. This is a UX/data-handling finding, not a legal compliance assessment.
- CDN-loaded parsing/email libraries create additional network failure points. The active code has no shared loader, integrity verification, or explicit loader timeout.

Vercel documents Hobby as personal, non-commercial hosting and notes that exceeded quotas can pause service. A free prototype does not establish a sustainable commercial operating model. Source: [Vercel Hobby documentation](https://vercel.com/docs/plans/hobby).

### UI, accessibility, and repeat-use UX

These observations come from JSX/CSS, not a completed browser audit.

- Clickable upload areas and job cards are divs without keyboard interaction. Several fields lack programmatic labels. Icon-only close/remove controls need accessible names.
- Toasts lack live-region semantics. The tracker lacks dialog semantics, focus management, Escape handling, and focus return.
- Many light-theme text colors use very low ink opacity, while success/warning badges retain pale colors intended for dark backgrounds. Measure contrast in both themes.
- The navbar has several fixed-size actions without a small-screen wrap strategy; the step indicator also uses fixed connectors and non-wrapping labels. Narrow-screen overflow needs browser verification.
- Profile review cannot add skills or correct location, email, experience, or search titles. Editing the displayed title does not necessarily change AI-suggested search titles.
- The tracker persists records but not stable job IDs or submitted timestamps; applied badges use separate ephemeral state. Refreshing loses those badges and can produce duplicate records. There are no status edits, notes, follow-up dates, or draft recovery.
- Returning users cannot easily update a profile without resetting their history. Cover letters disappear when leaving job detail. Browser back/navigation is not represented by routes.

## Promise audit

| Promise | Implementation today | Needed clarification |
| --- | --- | --- |
| AI-matched jobs | AI suggests titles; job scores use random substring-overlap heuristics | Explainable relevance, evaluated against labeled examples |
| Real jobs | Provider results, plus fictional outage fallback | Real/demo separation and source provenance |
| Apply in one click | Clipboard assistance and external navigation | Clearly describe preparation; user confirms submission |
| Remote anywhere | Provider remote boolean and broad keyword eligibility | Country restrictions and work authorization where known |
| Email a copy of the cover letter | Optional EmailJS activity notification | Explicit opt-in, actual letter content, accurate delivery state |
| Free to operate | External quotas and plan restrictions | Verified demo limits and measured operating cost |
| Review/edit profile | Name/title edits and skill removal | Correction of all information that affects search and letters |

README also references `App.jsx`, a `MODEL` constant, React 18, and non-prefixed EmailJS setup variables that do not match the active code.

## Feasibility and positioning

Technical feasibility is good for a focused application-assistance tool. The existing integrations provide a plausible foundation, but an unrestricted public launch would expose avoidable trust and quota problems.

A potential initial audience is Nigerian early-career developers seeking locally available or explicitly eligible remote roles. This is a positioning hypothesis suggested by the existing Nigeria filter, not proven demand. Validate it before specializing the product. The central user value would be: fewer irrelevant listings, faster truthful application preparation, and reliable tracking across repeat visits.

Avoid promising employment probability, globally eligible remote work, or automated submission. Useful differentiation would be evidence-backed relevance and location eligibility, grounded letters that do not invent candidate achievements, and recoverable application history. Accounts can follow demonstrated cross-device demand; they are not a prerequisite for making a local-first prototype dependable.

## Validation of demand and recommendation

There is no defensible numeric recommendation probability from this code. Vercel Analytics being present does not establish successful tasks, repeat usage, referrals, or hiring outcomes.

Run an initial usability pilot with roughly 10–15 consenting target users using redacted or synthetic CVs when possible. This is formative research, not a statistically representative success estimate. Observe:

- Can they find and understand a relevant, eligible role without help?
- Are extracted facts correct, and can errors be corrected?
- Does the letter use only supported candidate facts?
- Do they understand that submission happens externally?
- Can they resume their draft/history on a later visit?
- Does measured preparation time improve against their usual workflow?
- Do they return during active job searches and actually share the tool?

Record upload-to-profile completion, search failure rates, relevance judgments, draft completion, user-confirmed submissions, preparation time, and active-search return behavior. Collect minimal event data rather than CV content. Declare pilot acceptance criteria in advance; report actual sample sizes and limitations.

## Path to a flagship portfolio project

The prototype can currently support a claim of building a React app with AI and job-search integrations. A stronger flagship claim needs demonstrable engineering depth and observed user benefit:

1. Reproducible local setup and clean checks, with the architecture and provider assumptions documented.
2. Honest deterministic matching, full job context, validated extraction, and regression examples for failures.
3. Accessible mobile/desktop workflows and durable drafts/tracker state.
4. Shared rate limits, bounded provider operations, cost measurement, and useful operational error reporting.
5. A measured pilot and case study explaining design tradeoffs, outcomes, and limitations.

This can make JobAI a credible centerpiece for applications to major technology companies. It cannot establish a hiring probability or replace the rest of a candidate's experience and interview performance. A CV claim should describe verified work and measured results; do not invent user counts, time savings, accuracy, or scale.

## Suggested implementation order

1. Address the exposed-key situation and establish a supported runtime/model configuration.
2. Remove randomized facts and fictional outage behavior; correct application/email/clipboard status semantics.
3. Validate AI/provider data, constrain proxy operations, handle timeouts/errors, and introduce shared quota protection.
4. Improve profile corrections, full job context, draft persistence, and tracker lifecycle.
5. Verify keyboard access, mobile layouts, light/dark contrast, and understandable onboarding.
6. Run the pilot, evaluate relevance and cost, and use the results to guide further product work.

## Verification performed and limits

- Read active frontend, both server functions, styles/configuration, package manifest/lockfile, README, and tracked-file metadata. Did not read key contents or local secrets.
- Executed the source normalization function in an isolated Node VM. Repeated identical zero-overlap inputs returned differing 66–71% scores in that run and differing fabricated posting ages. The formula establishes the full 65–72% possible range. An hourly salary fixture produced `USD0k – 0k`.
- Imported the Groq handler with mocked fetch and a temporary placeholder environment value to verify unchecked request forwarding. No real provider requests or charges occurred.
- `npm run build` could not run: project dependencies are absent (`vite: not found`). `npm run lint` fell through to globally installed ESLint 6.4.0, which cannot use the repository's modern configuration. These are environment/setup blockers, not evidence of a passing or failing application build.
- Lockfile inspection confirmed the current Node runtime does not satisfy Vite/plugin-react engine requirements. Dependencies/runtime were not installed or changed.
- Checked current official Groq model retirement and Vercel Hobby documentation. The README demo URL could not be inspected successfully through the web reader; that does not prove it is offline.
- No browser-rendered UI, production provider configuration, deployed endpoint protections, real CV extraction, email delivery, or end-to-end application flow was verified. Findings about those live behaviors remain source-derived or explicitly qualified.
- Only this review document was added. Application code, credentials, deployment, and Git history remain unchanged.
