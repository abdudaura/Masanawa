# Production backup/restore/DR/recovery drill qualification — Task 148

Owner/window: current ChatGPT continuation window — Task 148
Branch: `work/production-recovery-drills-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 148 — backup/restore/DR, migration rollback, data export/deletion and credential/device recovery drills.

## Exact owned paths

- `scripts/recovery-drill-qualification.mjs` (new)
- `scripts/recovery-drill-qualification.test.mjs` (new)
- `docs/workstreams/production-recovery-drills-20261006.md`

## Explicitly excluded/shared paths

- production databases, backups, credentials and devices;
- migration files and migration application state;
- Gateway/Worker/Ops/mobile and PR #136;
- provider infrastructure/deployments;
- Security credential implementation;
- Device registration/credential/control-plane implementation;
- Task 147 observability/runbook owner;
- Tasks 149-150 pilot/cutover/release.

## Implementation boundary

- validate externally produced recovery-drill evidence only;
- required drill families:
  - database backup -> isolated restore -> integrity verification;
  - forward migration -> rollback/restore compatibility;
  - tenant/user data export;
  - deletion/tombstone verification with protected retention exceptions explicit;
  - credential revoke/rotate/rebind recovery;
  - device revoke/replacement/reassignment recovery;
- every drill requires exact source snapshot/build/schema identity, timestamps, bounded RTO/RPO, evidence hashes and pass/fail steps;
- backup restore must prove restored data is isolated from production before verification;
- migration rollback must prove schema/data compatibility and no silent forward-only assumption;
- export/deletion must prove requested scope and exclusions rather than only file creation;
- credential/device recovery must prove old authority is unusable before replacement is accepted;
- missing drill families or insufficient evidence -> INCOMPLETE;
- failed invariants -> FAILED;
- no production mutation, restore, deletion, credential rotation or device replacement is executed by this window.

State: CLAIMED. Implement deterministic recovery-drill qualification and tests; real production-like drills remain external execution.
