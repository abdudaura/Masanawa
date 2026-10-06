# Backup/restore/DR/migration/export/deletion/credential-device recovery drills — Task 148

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/platform-recovery-drills-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **148** Complete backup/restore/DR, migration, rollback, data export/deletion and credential/device recovery drills.
- `docs/DATA-ARCHITECTURE.md` — restore integrity/schema/tenant/ledger/object/lease invariants and forward-only production migration rules.

## Owned paths
- `tests/support/recovery-drill-evidence.ts` (new)
- `tests/recovery/platform-recovery-drill.test.ts` (new)
- `docs/runbooks/platform-recovery.md` (new)
- `docs/workstreams/platform-recovery-drills-20261006.md`

## Excluded/shared paths
- No database/object-store/vault/device mutations, migrations, deployment rollback execution, package manifests/lockfile or production credentials.
- This branch defines/validates drill evidence; infrastructure owners execute real drills.

## Current state
CLAIMED. Add per-drill mandatory checkpoints, RTO/RPO evidence, tenant/ledger/lease invariants, forward-only migration recovery rules, and a concrete operator recovery runbook.