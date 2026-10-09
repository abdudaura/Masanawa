# F14/C01 — fail-closed page cursor calendar validation (2026-10-09)

## Five-minute ownership claim (before code edits)
- Window: GPT-6 F14/C01 independent continuation of existing draft PR #468; no duplicate feature PR.
- Claim UTC: 2026-10-09T00:58:08Z (Africa/Lagos 01:58:08). Prior PR activity 2026-10-08T23:48:29Z, older than five minutes.
- Main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`; existing C01 branch head before claim: `8f3755692a19bc17fafcbb30f762a260a4a35a70`.
- Exclusive paths for this continuation: `services/gateway/src/human_contacts/service.ts`, `services/gateway/src/human_contacts/service.test.ts`, and this handoff. Do not modify shared Gateway composition, migration, database schema, finance, Firebase, Flutter root, existing U21/U24 files or production.
- Actual source defect to close: cursor parser accepts calendar-overflow timestamps because JS `Date.parse` normalizes e.g. February 30; an attacker can forge their own actor-scoped (non-signed, positional) base64url token. PostgreSQL `::timestamptz` rejects invalid dates, converting a client 400 into a backend error. Year zero needs rejection for PostgreSQL date representation. Untrusted cursor data must be validated before SQL.
- Plan: strict UTC Gregorian calendar/range checks, preserve 6-digit microseconds and the current cursor format/actor-tenant binding; negative and valid-leap-day regression cases in the existing service unit suite. No new cursor authority, token signing, schema, API or plugin.
- Prior F14 keyset and terminal consent changes in #468 retained. Confirm no more recent competing exact-path claim before edits. Tests and immutable SHA-specific evidence follow below after implementation; CI, DB and physical E2E not inferred from source inspection.

## Implementation / execution / handoff
Pending. Preserve this initial claim record and append actual source, test outcomes, paths and final branch HEAD. Keep PR draft/unmerged.
