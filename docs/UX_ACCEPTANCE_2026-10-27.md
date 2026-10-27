# Guest discovery and sign-in feedback — October 27, 2026

Owner reports: sign-in emails redirect to localhost; sending a link has insufficient visible feedback; account requirements interrupt job discovery. Wants easier CV input, including existing CVs, selections, and possibly dictation.

## Implemented locally

- Default job discovery uses a public Remotive feed without account, CV, database, or JSearch key. Signed-in extended JSearch is a separate explicit source choice. Public jobs are attributed and link to Remotive. Country matching is a text filter with the original restriction visible, never an eligibility determination. Public coverage is limited and delayed by at least 24 hours.
- Sign-in success has a focused, persistent inbox confirmation with the requested address, spam-folder guidance, a continue-building action, and a 60-second resend cooldown. Errors remain visible and permit retry. Only successful request acceptance is claimed; delivery remains unverified. Draft recovery still requires consent when a CV exists.
- CV import accepts pasted text or rough notes as well as files. Failed analysis retains input in the tab for retry; nothing is silently saved to device storage. A visible action offers the guest short-answer builder. AI import and drafting still require sign-in and provider quotas. Dictation is deferred, not implemented; device keyboard dictation can already enter text into normal fields.

## Cloud correction still needed

No Supabase/Vercel admin tools are exposed in this session. Code already requests the current origin's `/account` redirect. Correct Site URL/allowed redirects and inspect email templates as described in `SERVICE_SETUP.md`; request a fresh email afterwards. Changing source code alone cannot repair the project's localhost Site URL or an overridden email template.

The earlier production gate recheck returned 401 instead of 503, establishing configuration presence only. Database schema/storage, delivery, redirects, two-user isolation and authenticated provider workflows remain pending.

## Evidence

- One real read-only public-feed check returned HTTP 200 with 10 listings. No paid provider request, CV transmission, signup email, database write or deployment was made.
- All eight Node test files pass, including public-feed attribution/link validation, shared refreshes and country filtering. Lint, build and SEO checks pass; the existing bundle-size warning remains.
- The development browser suite passed 25 checks before the final guest-filter scenario and synthetic test configuration were added. All four final targeted checks pass using synthetic Supabase configuration: sign-in success, sign-in rejection, pasted-CV retry, and attributed guest results/country filtering. Browser auth/provider responses are mocked; they do not prove actual email delivery or AI quality.
- Both built-site PDF/worker and missing-asset recovery checks pass.

Local changes require a reviewed deployment before live verification. See `REMAINING_RELEASE_WORK.md` for the wider release gates.
