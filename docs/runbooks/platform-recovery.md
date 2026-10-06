# Platform recovery runbook

This runbook defines how Masanawa recovery drills are executed and evidenced. It does not replace provider-specific PostgreSQL, object-store, vault, Railway, DigitalOcean, or device procedures.

## Global rules

- Preserve canonical evidence before changing anything.
- Production database migrations are forward-only. Recovery from a bad migration uses verified backup/recovery plus an application/schema compatibility plan; do not improvise destructive down-migrations.
- Never restore raw secrets from source control or incident notes. Restore secret references/configuration through approved vault/platform procedures.
- A recovery is not complete until tenant isolation, ledger/event continuity, object references, and stale lease/worker behavior are verified.
- Record evidence references for every mandatory checkpoint and measured RTO/RPO.

## Backup and restore drill

1. Create/identify a valid canonical backup and record its provider reference/checksum.
2. Restore into an isolated recovery target.
3. Verify schema/migration compatibility and database readiness.
4. Verify tenant ownership boundaries with representative tenants.
5. Verify append-only ledger/event continuity and balanced/replay-safe state.
6. Verify referenced object metadata/content remains resolvable.
7. Prove expired/stale leases or workers were not resurrected.
8. Measure recovery time and data-loss window.

## Migration recovery drill

1. Verify a preflight backup exists.
2. Apply only the forward migration under test.
3. Verify current application/schema readiness.
4. Exercise the planned application rollback/compatibility path when required.
5. Execute the documented recovery plan rather than a destructive reverse migration.
6. Verify data integrity and canonical migrations after recovery.

## Data export and deletion drills

Exports require authorized tenant/user scope, completeness evidence, stable export hashing and cross-tenant exclusion checks.

Deletion requires authorization and retention classification first. Remove/anonymize private payloads where policy requires while preserving mandatory tombstones, audit/security/financial structure, and proving no other tenant was affected.

## Credential recovery drill

Rotate/recover by generation: revoke the old generation, activate the new one, prove old credentials are rejected and new credentials work, and verify no secret material appears in logs/evidence.

## Device recovery drill

Revoke the old device/credential, pair the replacement through the canonical pairing flow, prove the old device is rejected, revalidate Character/device assignments and capability readiness, and verify custody of pending consequential operations before replay.

## Completion

A drill passes only when every mandatory checkpoint passes and measured RTO/RPO are within the declared policy. Missing evidence is a failed drill, not an assumed pass.
