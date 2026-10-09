# F11 / release recovery — disposable PostgreSQL restore rehearsal
Claimed UTC: 2026-10-09T02:41:19.969Z
Lease: five minutes from claim; refresh before modifying or releasing.
Owner/window: GPT-6 independent F11 verification/recovery.
Base main: 5e758673ae91082520b21b3153da53791ae2cbf3
Branch: work/f11-disposable-pg-restore-rehearsal-20261009
Owned exact paths only:
- `tools/db-restore/inspect-and-restore.mjs`
- `tools/db-restore/inspect-and-restore.test.mjs`
- `docs/workstreams/f11-disposable-pg-restore-rehearsal-20261009.md`
Intent: implement **offline backup inspection** and an explicitly gated, disposable-only PostgreSQL custom archive restore rehearsal with adversarial mocked-command tests. No production system change or actual database write; CI/ops owners retain real restore qualification. Existing F11 PR #518 inventory, R16 #479/#485 migrations and U20 #527 release evidence are preserved.
Collision check: inspected main tree and exact changed filenames of #518/#479/#485/#527/#559; none owns these exact paths.
Status: CLAIMED — source/tests pending; this claim is not evidence of release readiness.
