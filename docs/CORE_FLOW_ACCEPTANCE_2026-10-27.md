# Upload-to-matching acceptance — October 27, 2026

## Scope and causes

Owner priority: working authentication and existing CV → parsing → reviewed profile → related provider listings → explained match ranking today. CV-builder expansion is paused; no guarantee that passing local checks makes the public site ready.

Found two concrete blockers: homepage imports were redirected into the CV builder, and the quota function required by both paid endpoints did not exist. The owner supplied SQL showing absent `resumes` and quota objects, then reported successful execution of the prepared migration. An independent anonymous zero-row CV request now returns 401/42501 instead of 404/PGRST205, confirming recognition/access denial, not authenticated CRUD.

## Local implementation

- Homepage primary action uploads for job matching; extracted data proceeds to review and then discovery. Explicit imports started inside the builder still return to its editor.
- A protected-operation 401 opens an accessible in-page sign-in dialog, keeping the upload/search component mounted. Sending an email shows status/cooldown; `verifyOtp` establishes the SDK session and the pending operation resumes with its access token. Cancelling or entering an expired code keeps the selected input available. No selected File or OTP is silently persisted as a recovery mechanism.
- The owner's Magic Link and Confirm signup templates must include the token code. Redirects were reported corrected; actual delivery/return is not independently established.
- Reviewed target title and selected skills inform search/ranking. Missing skills can be added. Signed-in profiles use extended JSearch; public remote discovery remains a separate limited option.
- Text evidence ranking exposes 70% detected skill coverage and 30% target-title overlap when both exist, matched/missing terms and limitations. Existing candidate-skill coverage remains separate in details. No interview probability, universal ATS score or eligibility inference.
- AI requests retain cancellation and a 60-second browser timeout.

## Verification record

- Lint and all eight Node test files pass with installed dependencies under Node 22.23.3. New tests exercise server identity/quota/provider order, unsigned rejection, quota denial, alias/boundary matching and explained ranking.
- Build and SEO checks pass; existing 500KB chunk-size warning remains.
- Both production-bundle PDF/worker extraction and stale-asset recovery browser tests pass.
- Full development suite: 27 passed, one failed solely because it still selected the replaced homepage button text. That selector was updated to the actual primary upload action, preserving its assertion. All three targeted reruns passed: the updated returning-user action, complete auth-to-jobs path and sign-in cancellation.
- The complete core browser test uses a real DOCX extraction, an initial application 401, mocked email/code verification (including an expired code), authenticated parse retry, editable reviewed profile, one authenticated provider search, deterministic ranking and displayed calculation. No builder detour.
- One earlier browser attempt was interrupted/closed and had a timeout; it is not counted as acceptance. Provider/auth browser responses and server integration tests are mocked. No actual email, paid model generation, JSearch request or new database write was performed by the agent in this batch.

## Required deployment and real acceptance

1. Review/publish the code to a preview; confirm its deployed commit and environment variables.
2. Verify both email templates and actual first-time/returning-user code delivery. Enter codes in the app; do not paste credentials in chat.
3. Use a synthetic or consented CV through actual parse → review → actual JSearch → evidence explanation → original listing. Check a real provider response for factual extraction and useful results.
4. Verify authenticated CV CRUD/two-user isolation and server quotas. The owner's migration success and anonymous denial do not replace these tests.
5. Check mobile, expired session, empty/unreadable document, no listings and provider outage states on the deployed version.

Record the actual outcome and remaining limits. Only then label the released core flow ready for a small user pilot and record the marketing demo. Research and demo scripts are prepared; no finished video or public posting is claimed.
