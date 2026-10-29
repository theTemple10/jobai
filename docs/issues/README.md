# Delivery issues: three-page correction

GitHub issue creation was attempted on October 29 and rejected with HTTP 403 by the integration. These are prepared issue records, not claims of published GitHub issues. Use these IDs in commits/tests until actual issue numbers are available.

| ID | Issue | Acceptance | Dependency |
| --- | --- | --- | --- |
| R001 | Guest CV-to-application pipeline | Unsigned PDF/DOCX/paste/supported-image parsing, search and cover-letter generation work without an account; preference edits affect search; copy/download and original listing work | R002 |
| R002 | Shared guest service limits and cache | Anonymous browser never receives server secret; wrong RPC proof rejected; per-visitor and global quotas atomic across instances; repeat job searches use cache; provider failures preserve user input | Additive migration + server environment |
| R003 | Standard account entry and builder protection | Email/password signup/login/recovery, configured Google, session-loading state; unsigned builder renders account entry rather than editor; guest jobs remain open | Existing Supabase Auth |
| R004 | Owned workspace history | Authenticated CV versions and application/letter snapshots; user-reported status edits and deletion; guests invited to sign in; cross-user reads/writes denied | Additive application table |
| R005 | Low-effort builder and honest guidance | Import existing CV, role/skill/region choices remain editable, sensible contact fields, straightforward review/export; no promised interview or applicant-pool rank | R003 |
| R006 | Release regression and real acceptance | Browser/API/database boundary tests; reviewed migration/config rollout; real guest and account journeys on deployed release; record actual CI and migration state | All above |

Implementation order: prepare/test R002 + R004 schema; implement R001 + R003; connect R004 + R005; validate R006. Do not close an issue merely because UI code exists.
