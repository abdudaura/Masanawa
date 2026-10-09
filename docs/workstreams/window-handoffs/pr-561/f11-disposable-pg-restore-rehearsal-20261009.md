# F11 — disposable PostgreSQL restore rehearsal (isolated verification/recovery)

Updated UTC: 2026-10-09T02:45:16.425Z  
Owner/window: GPT-6 F11 isolated recovery (NOT F11 shared database/CI integrator)  
Status: **PARTIAL_IMPLEMENTATION — DRAFT, UNMERGED, NOT DATABASE-VERIFIED**

## Repository-visible ownership / SHA handoff

- Initial exact-path claim: **2026-10-09T02:41:19.969Z**, committed as **`b5f924af594d12701547928d723f43f2438e1797`** before production/test source edits.
- Base `main`: **`5e758673ae91082520b21b3153da53791ae2cbf3`**.
- Branch: `work/f11-disposable-pg-restore-rehearsal-20261009`; source+test commit: **`540fd528ee961bbc153237ec01d3720311885c0a`**. This document's own later commit and final PR HEAD are separately pinned in the PR metadata.
- Exclusively owned paths: `tools/db-restore/inspect-and-restore.mjs`, `tools/db-restore/inspect-and-restore.test.mjs`, this document. No shared SQL migrations, Gateway, Flutter, Firebase, CI, native, finance, backup contents or production configuration edited. Lease relinquished at handoff.
- Checked existing in-flight F11 #518, R16 #479/#485, U20 #527, APK #559 changed paths; all distinct. #497 remains separate and unmerged. Do not duplicate or replace these.
- Canonical obligations: F11/R16 database restore portability, `docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md`, `docs/BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md`, `docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md`. This isolated tool is NOT a complete F11 release lane.

## Implemented behavior and safety boundaries

`inspect-and-restore.mjs` is a dependency-free Node CLI using PostgreSQL-native `pg_restore` and `psql` when present.

1. **Default read-only:** require regular non-symlink file with `PGDMP` custom archive magic; hash the file with streamed SHA-256; bound and parse actual `pg_restore --list` metadata; require at least one table definition. Emit only digest and counts, never archive paths, table names, customer records or credentials. Never issue a database command in this mode.
2. **Explicit disposable restore:** require `--restore-disposable`, `PGDATABASE=masanawa_restore_test_<suffix>`, matching `RESTORE_DISPOSABLE_DATABASE_CONFIRM`, `RESTORE_EXTERNAL_EFFECTS_DISABLED=I_CONFIRM_ISOLATED_NETWORK` and `RESTORE_DISPOSABLE_ONLY=I_AUTHORIZE_TEST_RESTORE`. Invalid consent/name is refused **before invoking any command**. These inputs are operator attestations, NOT independent proof that an endpoint is isolated.
3. Preflight target with read-only `psql` identity and non-system relation-count query; reject any pre-populated target, mismatched identity or ambiguous count. Restore with `pg_restore --exit-on-error --single-transaction --no-owner --no-acl` (never `--clean`/`--create`), using the confirmed test database name rather than including credentialed connection URLs in process arguments.
4. Repeat read-only relation count afterward; fail closed on missing relations. Process errors are sanitized rather than relaying secret-bearing stderr. No provider, wallet, payment, webhook, notification, live-media or worker calls. No automatic deletion of target database.
5. **Explicit limitation:** this superficial post-readback is NOT data-integrity, role/extension/grant, object-store, financial ledger, privacy, schema-hash, restore-point, RPO/RTO or full recovery qualification. An archive checksum alone is NOT an encrypted off-account backup. This tool does not create backups.

## Safe operator reproduction (only authorized disposable environment)

```bash
node tools/db-restore/inspect-and-restore.mjs --help
node tools/db-restore/inspect-and-restore.mjs /isolated/approved/snapshot.custom
# Do not run restore against any real production host, account or customer data.
# On an independently provisioned isolated DB, with injected PG* environment credentials:
export PGDATABASE=masanawa_restore_test_rehearsal1
export RESTORE_DISPOSABLE_DATABASE_CONFIRM="$PGDATABASE"
export RESTORE_EXTERNAL_EFFECTS_DISABLED=I_CONFIRM_ISOLATED_NETWORK
export RESTORE_DISPOSABLE_ONLY=I_AUTHORIZE_TEST_RESTORE
node tools/db-restore/inspect-and-restore.mjs /isolated/approved/snapshot.custom --restore-disposable
```

**Before executing restore:** independently confirm the target PostgreSQL server/account is disposable, provider egress is network-fenced, archived content is approved and encrypted in transit/at rest, scoped credentials/roles and extensions exist, and target DB has no prior data. The flags do not enforce external network isolation. The script deliberately does not create or destroy any DB or inspect live production.

## Evidence actually executed (Node v22.16.0, isolated local copy)

- `node --check tools/db-restore/inspect-and-restore.mjs` → **PASS**.
- `node --check tools/db-restore/inspect-and-restore.test.mjs` → **PASS**.
- `node --test tools/db-restore/inspect-and-restore.test.mjs` → **12 passed, 0 failed**; test mocks `pg_restore`/`psql` command responses and uses only artificial local PGDMP-prefix fixtures. Tests include positive bounded read-only path, disposable consent/name, preflight/freshness, transaction argv, post-readback, no destructive flags, symlink, malformed/missing metadata, unsafe target, spoofed identity, injected tool error.
- `node tools/db-restore/inspect-and-restore.mjs --help` → **PASS**; no DB operation.
- Exact local Git blob digests match GitHub connector readback on committed branch: source **`58628180a264ae41c7445b10e509068efd82d0d6`**, tests **`311a1e7ab4974941a74beac54738e48eb093b37f`**. These validate tested **source/test byte parity**, not actual database qualification.

## Verification unavailable / missing integration work

- **NOT EXECUTED:** real `pg_restore --list` with an authentic custom archive, actual disposable PostgreSQL restore/readback, pgvector/PG18/role/extension compatibility, schema-migration checksum status, row/ledger/tombstone integrity, private S3/media object snapshots, encryption/decryption, off-account copy and measured RPO/RTO. Local runner has **no `pg_restore` nor `psql`** and no permitted disposable DB; no real backup was provided. Do not use this isolated tool on live production.
- **NOT EXECUTED:** `pnpm` Gateway suite, Flutter, CI issue #457, Android/iOS/Firebase/device/provider tests; private repo cannot be cloned from execution container (GitHub DNS unavailable). Separate F11/R/C work remains unmerged.
- **Missing source across total F11:** verified off-account encrypted backup and independent restore, actual schema-only migration rehearsal and effective release/CI/device/provider/rollback gates remain other owners' responsibility. This utility does not replace #479/#485 schema-admin source or #518 PR conflict verifier.
- **Integration next:** final Work owner recheck fresh `main`, PR heads and claims; validate this specific tool against native `pg_restore` and sanctioned synthetic archive; run once against **independently provisioned** disposable PG18/pgvector; inspect actual role/schema/migration/ledger/media evidence under private audit, no private content in logs; run the broader `DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md` Tests 1–2, gated by authorization and side-effect fencing. Coordinate with finance and privacy owners. Do not merge this as release proof.

## Risk / release gates

- SOURCE_WRITTEN: yes, isolated tool+tests; LOCAL_TESTED: yes, mocked command-path unit tests only.
- CI_EXECUTED: no; DB_INTEGRATED: no; APP_INTEGRATED: not applicable to standalone CLI; DEVICE_VERIFIED: no; PROVIDER_QUALIFIED: no; DEPLOYED: no; MERGED: no.
- Rollback: remove only this additive isolated CLI/tests/docs after review; no schema or production state mutation made.
- High-risk caveat: a matching disposable name and operator flags alone do not prove network isolation; operators must independently inspect the actual target host/project and credentials before authorizing **any** restore.
