# Authentication, resume parsing and job matching research

Researched October 27, 2026. Sources are maintainers' repositories, vendor help pages and official platform documentation. This is a public product research note; private career/relocation context belongs in the local Launchpad.

## Release decision

Today's core promise is **existing CV → extraction → candidate review → relevant job retrieval → explained ranking → original application listing**. CV generation remains a separate optional feature; new templates, dictation and editor expansion are deferred. Public-feed discovery is a limited browsing option, not acceptance evidence for authenticated profile-to-JSearch matching.

## What established products actually demonstrate

| Product/source | Observed approach | Lesson for RoleAide | Limits of this research |
| --- | --- | --- | --- |
| [Rezi account guide](https://www.rezi.ai/rezi-docs/how-to-create-a-rezi-account) | Documents email/password or social entry and an emailed confirmation code before dashboard access | Explicit account state, visible delivery feedback, and verification inside the app | Documentation is not an independent sign-in usability test; no private account created |
| [Jobscan tutorial](https://www.jobscan.co/jobscan-tutorial) | Compares a specific resume with a specific job posting; reports skill, title and other gaps | Match against actual posting text and expose the reasons rather than a free-floating resume score | Its scoring priorities and marketing outcomes are not a validated model for our users; do not copy claimed interview probabilities |
| [Teal job matcher](https://help.tealhq.com/en/articles/9923251-using-job-matching-resume-curation) | Search-index excerpt describes linking a saved job to a resume and reviewing suggested content selection | Preserve the connection between source facts and one target posting; let candidates review changes | Search excerpt available; direct help-page fetch returned 404. Treat this finding as provisional |
| [Reactive Resume](https://github.com/reactive-resume/reactive-resume) | Structured documents, recovery/versioning, preview/export, readable-PDF imports without AI, optional provider-backed assistance, application tracking | Separate extraction, structured data, editing, export and job preparation. AI is an optional layer, not a substitute for document state | README feature claims inspected; current runtime, cost and deployment not tested |
| [OpenResume](https://github.com/xitanggg/open-resume) | Browser-based PDF parsing and CV building, with an explicit parser/readability tool | Client-side extraction can offer useful review without a provider round trip; evaluate a deterministic fallback after today's connected flow works | Repository is AGPL-3.0; no source code copied. Layout-aware parsing requires evaluation on diverse actual formats |
| [Kickresume editor guide](https://www.kickresume.com/en/help-center/resume/) | Several entry paths: existing profile, examples, manual creation and AI assistance | Offer a small number of understandable starting points and review each imported fact | Feature documentation inspected; no claim that every import format is reliable |

Reactive Resume is the strongest builder reference for later investigation: structured import/export, recovery, undo and explicit acceptance of suggestions. OpenResume is the stronger focused reference for inexpensive local parsing. Rezi and Jobscan supply relevant account and comparison patterns. None justifies replacing our entire stack during today's release repair.

## Authentication implementation choice

Keep Supabase Auth as the identity provider. Replacing it today would add a user migration and session/security work without fixing the existing broken routing or missing database function.

1. Request the user's email with a clear explanation of what account access unlocks.
2. Show a persistent confirmation containing the requested address, spam guidance and resend cooldown; do not claim delivery based on request success.
3. Accept the emailed code in the same tab. Keep the upload component mounted behind an accessible dialog, preserving the selected File and consent in memory.
4. Let Supabase verify the code and persist/refresh its session. Resume only the pending operation after the SDK reports a signed-in user.
5. Send the access token to protected application endpoints. Server validates it against Supabase and calls the atomic database quota before a provider.
6. Invalid/expired codes show an actionable error. Closing the dialog cancels the pending retry without discarding the selected input.

[Supabase's official email OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless) specifies the template token and `verifyOtp` flow. Both the Magic Link and Confirm signup templates should expose `{{ .Token }}` for returning and new users. Keep `{{ .ConfirmationURL }}` as an alternative link and correct Site URL/allowed redirects. SMTP restrictions, spam placement and provider rate limits still need real-account verification. Social login remains a later improvement, enabled only after its actual provider configuration is complete; no decorative nonworking button.

## Match definition implemented for this release

The previous candidate-skill overlap remains separately labelled in job details. The ranking now has an explicit **text evidence match**:

- Extract recognized skill mentions from the posting using a limited vocabulary plus the candidate's listed skills, with a small explicit alias map and word boundaries.
- Detected skill coverage = mentions also in candidate skills / detected posting skill terms.
- Title overlap = target-title tokens also present in posting title / target-title tokens.
- If both are available, score = 70% skill coverage + 30% title overlap. If only one component is available, use it and expose the unavailable component. No numeric score when neither is available.
- Show matched terms, posting terms absent from the profile, both component values and the formula.

Example: a Developer listing mentions JavaScript, SQL and Python; the candidate lists JavaScript and SQL and targets Developer. Detected skill coverage is 67%, title overlap 100%, resulting text evidence match 77%. Another listing containing only JavaScript and SQL scores 100% under this limited heuristic. Neither score establishes seniority, mandatory qualifications or eligibility.

This is our transparent initial heuristic, not a borrowed proprietary algorithm or calibrated ATS model. Mentions may be optional, negated or incidental. The vocabulary is incomplete, exact title tokens miss synonyms, and experience duration/education/work authorization are not scored. These limitations are visible. Evaluate relevance with real target users before changing weights or making stronger claims. No hidden AI scoring call is needed per listing.

## Document pipeline and release evidence

PDF/DOCX text extraction already happens locally; images need the separately configured vision model. Extracted text is sent with consent to the protected parse endpoint. The result is normalized into editable role/skills and retained experience/education/projects. Review precedes job search. The homepage import must continue to this review, not silently enter the CV-generation editor. Explicit imports from the builder may still return to that editor.

JSearch retrieves actual provider listings; RoleAide does not independently scrape employer pages or fabricate jobs. Search uses the reviewed target role and selected location. The first release does not claim a comprehensive search across every extracted related title. Results are deduplicated, normalized and ranked deterministically in the browser. Location restrictions are shown separately from the score. The candidate opens the original posting to verify availability and apply.

Required release evidence: real email/code receipt, authenticated parse, reviewed profile, authenticated job retrieval, explanation consistent with source text, valid application link, invalid-session retry, supported mobile/desktop layouts, isolated account storage and verified deployed commit. Mocked tests establish control flow and calculations, not provider accuracy, email delivery or live release readiness.
