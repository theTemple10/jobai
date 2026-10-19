# JobAI production and experience review — 19 October 2026

**Verdict: a deployed product foundation with a strong visual identity, but not ready for a public launch or a claim that every advertised workflow works.** The immediate priorities are a broken typing experience and inactive production account configuration. A controlled beta becomes reasonable after those and the recovery/data-flow issues below are fixed and the real integrations pass acceptance checks.

This review covers local `main` at `76f14e4` and the public site at https://jobai-orpin.vercel.app/. The cleanup is now merged. The public interface reflects the current product design; the deployment's precise Git SHA was not independently verified through Vercel. No application code, cloud configuration, real account, or production record was changed during this audit. Synthetic test data was confined to isolated browser contexts. Provider-success scenarios were intercepted explicitly; they do not establish real provider quality or availability.

## Current position

| Area | Position | Evidence |
| --- | --- | --- |
| Source/build | Healthy foundation | Fresh lint and production build pass using Node 22.23.3. |
| Automated regression coverage | Passing but incomplete | All 13 regression tests and six browser tests pass. Natural typing, routing edge cases, and several recovery cases are missing from that coverage. |
| Deployment | Reachable | Public homepage returns HTTP 200; deployed routes render. |
| Manual CV creation | Launch blocker | The live form removes spaces and line breaks during normal keyboard entry. |
| PDF/Word export | Working in tested cases | Existing tests pass; a separate live four-page PDF retained all 72 synthetic achievements and an accented name. PDF and DOCX declare A4. |
| Sign-in/account CV saving | Inactive in production | Live workspace says “Account saving is being connected”; the builder has no account-saving button. |
| Live AI and job search | Blocked in production | Live job search, summary rewrite, and CV-analysis requests return HTTP 503 with an account-configuration error. |
| Import completeness | Partial | Existing Word import passes with a mocked parser, but the profile schema drops document categories and imported languages/certifications are not automatically included in exports. |
| Visual design | Cohesive, with workflow inconsistencies | Desktop/mobile and dark/light screenshots inspected; the older search flow retains purple gradients, emojis, and different component conventions. |
| Accessibility | Partial | Eight automated light/dark route scans found one confirmed contrast failure; manual keyboard testing also found a broken skip link. Automated scans left some contrast checks unresolved. |
| Security foundation | Useful controls, live setup unverified | Local PostgreSQL ownership/quota tests pass; current npm audit reports zero known advisories. Remote policies and authenticated access were not verified. |
| Long-term product operation | Incomplete | Account lifecycle, recovery, privacy/support information, monitoring, cost controls, and live integration acceptance still need work. |

## Findings in priority order

### 1. Critical: normal typing breaks CV content

**Confirmed on the deployed site.** Typing `Ada Obi` character by character results in `AdaObi`. Typing `I build tools.` followed by a newline and `For people.` results in `Ibuildtools.Forpeople.`.

`ResumeBuilder` normalizes its entire input on every render (`src/components/ResumeBuilder.jsx:19`). The shared text normalizer trims every string (`src/lib/resume.js:21`). Trailing spaces and newlines disappear before the next character arrives. This affects names, job titles, prose, and achievement lists. Filling a whole field at once, as the existing tests do, bypasses this interaction failure.

**Fix:** preserve raw editing text; normalize at explicit validation, import, persistence, or export boundaries as appropriate. Add real sequential-typing and Enter-key regression tests, including multiple achievement lines and caret editing. Acceptance: a first-time user can write an entire CV naturally without pasting prepared text.

### 2. Critical: the production account configuration is inactive

**Confirmed on the deployed site.** The workspace displays the unconfigured fallback. These safe, unauthenticated probes returned the same configuration failure:

| Request | Status | Response |
| --- | --- | --- |
| `GET /api/jobs?query=developer` | 503 | Account access is not connected yet. You can still build and download a CV. |
| `POST /api/groq`, summary rewrite | 503 | Same account-configuration error. |
| `POST /api/groq`, CV parsing | 503 | Same account-configuration error. |

The frontend only creates a Supabase client when both public configuration values exist (`src/lib/supabase.js:3`). The server deliberately rejects production access when its Supabase URL/key configuration is incomplete (`server/protection.js:6`). The observed behavior establishes inactive deployed account configuration; it does **not** identify exactly which values are absent or prove that Groq/JSearch keys are missing. The requests fail before those providers are checked.

**Fix:** verify/apply the Supabase migration; set matching browser and server Supabase configuration in Vercel; configure Auth URLs/email delivery; rebuild/redeploy; then verify actual sign-in, account CV CRUD, quota behavior, and owner isolation with two test identities. Verify provider keys and model availability after the account gate works. Creating the Supabase project alone does not activate these integrations.

### 3. High: progress can disappear during the saving/sign-in journey

**Reload loss confirmed live; sign-in consequence identified from code.** Unsaved text disappears on reload with no unsaved-work warning. Explicit device saving works and is disclosed, but the normal editing journey provides little protection from accidental refresh. Email-link sign-in redirects through a full page load to the site origin (`src/components/AccountPanel.jsx:21`); the current CV lives in memory unless explicitly saved. Once sign-in is activated, following the link cannot be relied on to carry an unsaved CV into the authenticated session.

**Fix:** establish a recovery policy that respects shared devices: explicit recovery consent or safe handoff before authentication, a clear saved/unsaved indicator, and navigation/reload protection where supported. Resume the intended action after authentication. Test the actual email-link journey; do not silently change the device-storage promise.

### 4. High: importing and preparing applications can leave out relevant facts

**Confirmed by source inspection and direct model checks.**

- The parsing schema (`src/JobSearch.jsx:38`) has no projects, volunteering, or portfolio field. `normalizeProfile` in `src/lib/jobs.js` drops unsupported fields even if a provider returns them.
- `resumeFromProfile` stores languages and certifications, but starts with the default section selection. Those two sections are disabled by default, so the imported facts are omitted from exports until the user manually enables them (`src/lib/resume.js:38`).
- `profileFromResume` excludes projects, volunteering, certifications, languages, and website. The cover-letter prompt also omits the available experience highlights and education. A first-time applicant whose main evidence is project/community work therefore loses much of that evidence during application preparation.

**Fix:** use one deliberate document/profile contract across import, editing, job search, and cover-letter generation. Preserve supported facts, enable populated imported sections, and show what could not be imported. Test a first-time applicant and an experienced applicant through the full chain.

### 5. High: malformed saved job data can blank the application

**Confirmed on the deployed site in an isolated test context.** Store `{}` under `jobai_applications`, with a valid saved profile and step 3, then open the jobs page. React crashes with `n.filter is not a function`; the page body is empty.

The job workflow's storage loader validates JSON syntax but not the resulting shape (`src/JobSearch.jsx:1181`). The app has no error boundary to provide recovery when rendering fails.

**Fix:** validate/migrate every persisted job-profile/activity/step value and introduce a useful error boundary with narrowly scoped reset/recovery controls. Acceptance: damaged or older browser data cannot prevent access to the builder or erase unrelated saved work.

### 6. Medium: the skip link navigates away from the current tool

**Confirmed live.** Activating “Skip to content” from the builder changes the hash to `#main-content`, which the hash router interprets as the home route. The landing page replaces the editor instead of moving focus into the editor (`src/ProductApp.jsx:10,68`).

**Fix:** move focus to the current main content without changing the application route; test the keyboard journey from each page.

### 7. Medium: restored cover letters lose assisted-application actions

**Confirmed with intercepted provider responses on the deployed UI.** Generate a letter: “Open listing & copy letter” is available. Reload and reopen the same listing: the saved text is present, but those assisted-application controls are absent. The `reviewing` flag always starts false even when a saved letter is restored (`src/JobSearch.jsx:804–809`).

**Fix:** model restored/editing/reviewed letter state explicitly. Let the user review and reuse an existing letter without paying for regeneration. Also provide device-letter deletion and clear storage disclosure.

### 8. Medium: “I already have a CV” does not consistently open import

**Confirmed with an existing saved profile and intercepted job responses.** The landing CTA navigates to the generic jobs route. If that route restores a prior profile/search step, the user sees old results instead of choosing a CV. Import intent is only explicit on the builder's separate import button.

**Fix:** give import, resume existing search, and explore jobs distinct intents and destinations. Reuse the import path for both entry buttons.

### 9. Medium: eligibility and empty-document feedback need correction

- The profile screen labels people “Remote Eligible” based on a keyword list of professions (`src/JobSearch.jsx:413,458`). This cannot establish a person's country/work authorization or a particular job's restrictions. Replace it with wording about remote roles to explore and per-listing eligibility checks.
- A completely empty CV can enable PDF download after checking the review box. Completeness checks are advisory only. Prevent an entirely empty export and provide clear guidance for missing contact/evidence, without forcing applicants to invent information.
- The “Remote Only” control filters fetched results; it is separate from the remote-search location. Clarify that behavior and show active filter state accessibly.

### 10. Medium: public operation and account lifecycle remain unfinished

These are source/coverage gaps, not claims of a proven breach:

- No privacy/retention explanation page, support route, or account-deletion interface was found. A CV tool needs a clear explanation of device data, account data, and provider transfers, plus a practical deletion/contact process.
- The workspace has open/delete controls, but no clear new-CV, duplicate/save-as, or version-management journey. Loading an account CV retains its ID for subsequent updates; creating a separate version needs an explicit action.
- Account CV deletion has no confirmation/undo and no pending state. Account-list loading initially looks like an empty workspace.
- Device application history and letters remain local rather than account-synchronized. Sign-out does not clear all device work. Explain this and provide appropriate shared-device cleanup.
- Atomic per-user quotas exist, but provider budget alerts, overall cost ceilings, production error monitoring, and operational recovery procedures are not established by the repository. Vercel Analytics is present; it does not itself establish error alerting or meaningful completion measurement.
- An OpenSSH private-key file was previously tracked and remains in Git history. Its contents were not inspected. If the credential was valid, confirm revocation/replacement; deleting the tracked file does not revoke a credential. Revocation status could not be verified here.

## Interface assessment

The navy/ivory/gold palette, serif hierarchy, paper companion, approachable copy, and restrained motion provide a recognizable identity. The landing page and desktop builder look coherent. Reduced-motion behavior is present and tested. Fresh layout checks found no horizontal page overflow at 320, 375, 768, and 1440 pixels in the covered routes.

The remaining design work should focus on completing tasks comfortably:

1. Bring the purple gradients, emojis, labels, step indicators, notices, and buttons in search/application preparation into the same visual system as the landing and builder.
2. Improve small labels/help text and mobile action targets. The mobile builder is a long stack; its preview is far below the editor. Give users an easy Edit/Preview switch and a clear next-section action that keeps the active editor in view.
3. Add visible save state, clear import review, friendly loading states, destructive-action confirmation, and useful sign-in/retry actions before asking users to upload or wait on unavailable services.
4. Fix the confirmed light-mode upload label contrast failure: axe measured 4.34:1 for 12px text against a required 4.5:1. The automated scans found no other confirmed violations in the initial states tested, but left some contrast checks unresolved. This is not a full accessibility certification; result/detail states and assistive-technology testing need further coverage.
5. Keep the warm, detailed landing copy the product was designed for, while ensuring its calls to action lead to capabilities that are actually available.

The visual identity is sufficiently developed to continue with it. Another full redesign would not resolve the current readiness problems.

## Product promise and portfolio strength

The implemented CV feature is a manual structured builder with imports, exports, and optional summary rewriting. It is not yet a comprehensive generator that turns rough pointers into a polished, job-specific CV across all selected categories. That distinction should remain explicit. Readable single-column documents and factual review are a useful baseline; actual AI-output quality and resume-parser compatibility still need a representative evaluation set.

For a strong portfolio case study, show the completed guest-to-account journey, first-time-applicant workflow, real integration evidence, data isolation/recovery tests, accessibility improvements, and observed results from a small user pilot. Current tests and source organization demonstrate engineering work, but do not support claims about recommendation rates, hiring probability, universal ATS performance, or public reliability.

## Small release batches and acceptance gates

| Batch | Work | Acceptance gate |
| --- | --- | --- |
| 1 — Editing and recovery | Fix whitespace/line breaks, validate saved data, add error recovery, fix skip routing, protect unsaved work. | A user types a complete CV naturally; refresh/auth recovery is deliberate; corrupt storage does not blank the app. |
| 2 — Activate integrations | Supabase configuration/migration/Auth, provider credentials, preview deployment. | Real email-link sign-in; two users create/read/update/delete only their own CVs; real job/AI requests succeed; expired sessions and quotas fail clearly. |
| 3 — Complete document workflow | Preserve imported facts, include project evidence, restore letter actions, consistent import intent, explicit new/duplicate CV actions. | Both first-time and experienced applicants complete import/create → edit → export → job → letter → confirmed activity without losing facts or state. |
| 4 — Interface and operation | Shared UI conventions, mobile editor navigation, accessibility fixes, privacy/support/deletion, monitoring and budget controls. | Keyboard/mobile checks pass; users understand save/provider behavior; errors and cost limits have an owner and alert path. |
| 5 — Controlled pilot | Invite a small group across target applicant types, collect task completion and confusion reports, review AI facts and exports. | Launch decisions use observed failures and user feedback rather than an invented readiness score. |

Do not open a broad public launch before the editing and integration blockers are resolved. A private pilot should follow the first three batches and basic data/support safeguards.

## What the project owner still needs to do

No new Vercel or Supabase account is needed: both already exist. The remaining owner tasks concern access and service decisions:

1. **Provide authorized Vercel and Supabase access** through their integrations if configuration is to be inspected/applied here. Neither integration was connected when checked. Alternatively, configure the existing projects using the migration and environment list in the README, then arrange live verification.
2. **Verify provider credentials and plans** in secure project settings: Groq and JSearch/RapidAPI; a vision model only if image import is part of the launch. The current account-configuration error does not establish whether these credentials are already present. EmailJS is optional, not a prerequisite for the core product. Do not paste secret keys into chat or put provider secrets in `VITE_` values.
3. **Complete one real sign-in/email-delivery test** once configured and confirm the intended support/contact and retention approach for launch.
4. **Confirm that the previously tracked SSH credential was revoked/replaced if it was valid.**

The code fixes, migration preparation, tests, interface adjustments, and release verification are implementation work; they do not require the owner to manually reproduce every bug.

## Verification record and limitations

- Fresh lint and Vite production build: pass on Node 22.23.3. The host default is Node 18, so the compatible installed Node 22 runtime was selected explicitly.
- Fresh regression suite: 13 pass, including local PostgreSQL owner isolation and atomic quota behavior.
- Fresh browser suite: six pass, including actual PDF/DOCX downloads, Word extraction with mocked AI, explicit device saving/deletion, mobile layout/reduced motion, application activity, and provider failures.
- Current npm audit: zero known advisories across the installed dependency graph. This does not establish complete security.
- Public homepage/header checks: HTTP 200; HTTPS and configured anti-framing/content-type/referrer headers are present.
- Independent public-site checks: natural keyboard typing, skip link, saved-data corruption, initial account state, safe endpoint probes, light/dark scans, and responsive screenshots.
- Additional synthetic provider-interception checks: saved-letter restoration and returning-user import CTA behavior. No paid provider calls or real external applications were made.
- Additional actual live exports: 12 synthetic roles, 72 achievement lines, four-page A4 PDF, accented name preserved, all achievements present in extracted PDF text, and last achievement present in DOCX XML. PDF layout still needs visual review across more languages and edge cases; text preservation alone does not prove perfect pagination.
- Not verified: remote migration/policies, actual email-link completion, real account CRUD, live AI quality, image models, live job freshness/coverage, EmailJS delivery, Safari/Firefox, screen-reader interaction, load behavior, production alerts/backups, or credential revocation.

Evidence is saved in `docs/audits/2026-10-19/`. Temporary screenshots, browser scripts, and synthetic downloads are in `/tmp/jobai-audit-2026-10-19/` for this session. The earlier `IMPLEMENTATION_STATUS.md` is a historical handoff and its publication/access statements should not be treated as current deployment status.
