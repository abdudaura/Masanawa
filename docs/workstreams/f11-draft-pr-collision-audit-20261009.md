# F11 — isolated read-only draft PR collision audit

Updated UTC: 2026-10-08T23:47Z; owner: autonomous scoped verification window.
**Status: PARTIAL_IMPLEMENTATION / SOURCE_WRITTEN / UNVERIFIED ON EXACT PUSHED SOURCE.**
Claim: this file, `scripts/audit-draft-pr-collisions.mjs`, `scripts/audit-draft-pr-collisions.test.mjs` only; five-minute exact-path lease revalidated at checkpoint. Does **not** claim whole F11 or shared CI/Work.
Base main: `5e758673ae91082520b21b3153da53791ae2cbf3`; branch: `work/f11-draft-pr-collision-auditor-20261009`.
Source/test prior commit: `735d43efee24602bf30a275c7a6a586ebd531f63`. Final handoff commit is the latest head of PR #518.
Draft/unmerged PR: https://github.com/Baatiku/masanawa/pull/518.
Trace: F11 verification/branch recovery, R16/CI #457, R14/F10 Firebase-preservation guard, C02/C05/C06 collision visibility; J/K end-to-end journeys **not qualified**.

## Exact source implementation

- `scripts/audit-draft-pr-collisions.mjs`: read-only GitHub REST snapshot with token, 100-row pagination, 3-worker concurrency and explicit caps; separate offline snapshot mode for reproducible input; SHA-identified open PRs and main. Reports per-file overlaps, schema-root+version SQL migration collisions, explicit U/F title scope overlaps, advisory missing PR-body handoff links and exact-file-list incompleteness. Shared Firebase, router, composer, finance, lockfile changes are flagged critical. JSON output with optional `--strict` review exit status; incomplete lists or missing main/head fail closed with exit 3. No GitHub writes, token printing, source edits, merges or inference that duplicate paths mean incompatible semantics.
- `scripts/audit-draft-pr-collisions.test.mjs`: 10 Node built-in regression tests for migration collisions, duplicate titles, same-SHA Firebase overlap, missing evidence, malformed input, CLI semantics, credential gating, two-page GitHub files listing, auth redaction, and JSON artifact.

### Actual local verification vs authored-but-unexecuted code

- **Executed:** `node --test /mnt/data/f11-audit/audit-draft-pr-collisions.test.mjs` (Node 22.16.0) on an *earlier standalone prototype* with the same intended audit contract: **13 passed, 0 failed**. This was **not** the exact smaller final GitHub source; it cannot be cited as a passing branch test. Node syntax checks also passed for that prototype. GitHub connector confirmed three branch changes against latest main only (two new scripts + this handoff).
- **NOT executed:** `node --test scripts/audit-draft-pr-collisions.test.mjs` against PR #518's *exact committed source*, because this window can author/fetch the private GitHub repository via the linked connector but cannot git-clone it into the shell (container DNS: `Could not resolve host: github.com`). Run this in a full authenticated checkout before marking LOCAL_TESTED.
- **NOT executed:** `GITHUB_TOKEN=<repo-read-token> node scripts/audit-draft-pr-collisions.mjs --live --repo Baatiku/masanawa --output /tmp/masanawa-pr-audit.json --strict`. No GitHub token was exposed to shell or used; verified via authenticated connector read-only instead. Even a successful audit is not feature, CI, database, provider or Android qualification.
- CI #457 Actions quota, full Gateway/Flutter build, real PostgreSQL, two-device, FCM/APNs, wallet and provider gates: **not run, not implied by this isolated tooling**.

## Current authenticated connector evidence (read-only, 2026-10-08 23:46Z)

Inspected exact changed filenames and current heads of draft/source PRs: #472 `344c56f`, #475 `91973de`, #474 `0567c82`, #476 `0ebf63c`, #487 `0950b0c`, #490 `532b158`, Firebase #461 `11de436`, Work #497 `d23a8fa`, C01 #468 `8f37556`, U21 #508 `3e2e780`.

**Concrete candidates — DO NOT blindly merge them:**

1. **C02/F15:** #472 `packages/talks/migrations/0017_human_dm_core.sql`, #475 `packages/talks/migrations/0017_human_dm_text.sql`; #497 contains the core 0017. Version collision, independently of filename.
2. **C06/F06:** #487 `packages/commerce/migrations/0110_crypto_internal_transfers.sql`, #490 `packages/commerce/migrations/0110_internal_crypto_transfers.sql`; #497 includes #487's named 0110. Must elect one custody/ledger contract; no financial enablement.
3. **C05/F16:** #474 and #476 both edit `apps/mobile/pubspec.yaml` and supply alternate client caches; semantic selection still required.
4. **Firebase/F10:** #461 and #497 contain identical native configuration *paths*, including `.firebaserc`, Android `google-services.json`, iOS `GoogleService-Info.plist`, Gradle/Xcode config and PowerShell qualification. Same path does **not** show that content is lost or altered. Preserve Work/Firebase evidence before any branch disposition.
5. **C01/R18 / global Gateway:** #468/#497 and #475/#487/#490/#497 touch common `services/gateway/src/app.ts` or `main.ts` at various heads. Work composition must reconcile behavior; overlap alone is not an unresolved Git conflict.
6. **Work #497 vs C02:** #497 includes canonical C02 files from #472 and alternate isolated Flutter files from #475; compare actual code before closing either source PR.

These are **file-level observations**, not a complete per-PR exhaustive semantic audit. Existing source work, Firebase #461 and active Work #497 are unchanged.

## Security/data review

This branch creates **no database migration**, service endpoint, financial task or consumer UI. The CLI only issues authenticated GETs, aborts on HTTP/pagination failure without leaking credentials, and avoids secrets in output. The tool identifies **candidate** overlaps; it does not infer safe ownership from five-minute timestamps, validate actual Git mergeability, or select one ledger implementation. No new Firebase values, native files or finance guards are changed.

## Missing implementation / Work integration instructions

1. In a Node 24 authenticated full checkout, `node --test scripts/audit-draft-pr-collisions.test.mjs`; inspect failures and align any test/source discrepancies. This script is intentionally independent of pnpm packages.
2. Supply a repo-read GitHub token in the **shell environment, never a committed fixture**; run live CLI as above. Treat exit 2 as review candidates, exit 3 as insufficient inventory, and 0 as only audit completion (not E2E green).
3. Compare actual changed-file diffs, migration SHAs, handoff documents, claims and integrated #497 source. Snapshot output must be updated as PRs move; no automatic merges, branch deletions or content overwrite.
4. Rebase/merge #518 only if independent verification passes and F11/Work owner accepts the helper; it is not a release blocker or substitute for Work verification.
5. Resume feature work in the **already claimed** U21–U30 branches and existing R/C PRs. This branch intentionally does not implement or replace any of those feature slices.

Rollback risk: no runtime effect. Source/test additions can be omitted if the Work integrator replaces them with a stronger audited system. No production changes.

| Release gate | Evidence |
| --- | --- |
| SOURCE_WRITTEN | Yes, exact two standalone files committed |
| LOCAL_TESTED on exact branch | **NO — requires checkout execution** |
| CI_EXECUTED | NO — issue #457 |
| DB_INTEGRATED / APP_INTEGRATED / DEVICE_VERIFIED | N/A for standalone verification CLI, NO for product |
| PROVIDER_QUALIFIED / DEPLOYED / MERGED | NO |

---

## 2026-10-09 continuation — locally verified exact audit blobs

**This addendum supersedes the earlier "tests not executed on exact pushed source" evidence for the two audited script blobs only; it does not change the F11 overall `PARTIAL_IMPLEMENTATION` or full release gates.** Exact-path claim and five-minute renewal posted in PR #518; previous owner claim was expired and PR head stable before edits.

**Base:** `main` `5e758673ae91082520b21b3153da53791ae2cbf3`.
**Branch:** `work/f11-draft-pr-collision-auditor-20261009`; PR #518, draft/unmerged.
**Source update:** `1e802ed271e9e030c15d951cb01b496372550982`.
**Test update:** `c3567631d2fa0be60ac2a67cb3d55920520bcb61`.
**Exactly modified:** `scripts/audit-draft-pr-collisions.mjs`, `scripts/audit-draft-pr-collisions.test.mjs`, and this handoff. No Gateway/migration/Flutter/Firebase/finance/Actions/production changes.

### Implemented verified fixes

1. Duplicate migration sequence versions **within a single PR** now produce a critical `migrationCollisions` entry rather than disappearing from the previous cross-PR-only detector; `withinPullRequest` annotates this special case. Existing C02/C06 cross-PR collision checks remain.
2. Live mode re-fetches read-only PR detail after its files. If its SHA changed during the scan, `headStable=false`, `completeFiles=false` and an explicit `head_changed_during_audit` incomplete reason are reported. A changed-file-count mismatch on detailed PR metadata also fails closed. This adds one authorized GitHub GET per PR and does not mutate any PR or merge anything.
3. Regression coverage added for intra-PR SQL migration numbering, PR head rotation during scans and detailed changed-file count mismatch. Updated the existing paginated-file mock for the new documented detail read.

### Evidence, independently reproducible on exact pushed bytes

- Node version: **v22.16.0**.
- `node --check scripts/audit-draft-pr-collisions.mjs` and `node --check scripts/audit-draft-pr-collisions.test.mjs`: **PASS**.
- `node --test scripts/audit-draft-pr-collisions.test.mjs`: **13 passed, 0 failed** in the isolated local working copy.
- `node scripts/audit-draft-pr-collisions.mjs --snapshot <single-PR-duplicate-migration-fixture> --strict`: **exit 2**, `migrationCollisions=1`, `withinPullRequest=true`, `pathCollisions=0`.
- **Exact blob attestation:** `git hash-object` locally produced `9f20439a35b1e78deacf0f7cd618c3dd427fc03b` (script) and `b9ed763c6c84b96ac73dd8acd1d54ea3d21e393e` (tests), identical to the GitHub connector's returned content SHAs after both commits. Thus the local Node tests were run against *byte-identical script and test files* to the pushed PR, though not a full cloned repository checkout.

### What remains unverified and exact next actions

- **NOT RUN:** authenticated live mode against GitHub REST, because the container has no shell GitHub DNS/network connectivity and no repo-read `GITHUB_TOKEN`; the injected-fetcher tests cover its request and error behavior, not actual GitHub transport, concurrent write races or rate limits. Work owner can run `GITHUB_TOKEN=<read-only-token> node scripts/audit-draft-pr-collisions.mjs --live --repo Baatiku/masanawa --output /tmp/masanawa-pr-audit.json --strict`. Capture report and inspect individual PR diffs; exit 2 is advisory review, exit 3 insufficient inventory.
- **NOT RUN:** CI #457, full Gateway/Flutter build, DB/ledger migration apply, Android, Firebase, providers, external backups/restore, release signing or production verification. Continue preserving #497, #461 and all R/C/other U PR source.
- **LIMIT:** PR list and file API are mutable; one post-file head re-read narrows but cannot completely eliminate race windows after that read. Treat all counts and heads as a recorded snapshot, not a transaction, and audit again immediately before actual release integration.
- **Status:** audited helper LOCAL_TESTED on exact blobs; F11 overall **PARTIAL_IMPLEMENTATION**, CI/DB/APP/DEVICE/PROVIDER/DEPLOYED **UNVERIFIED**. Draft and unmerged; no automatic merging or production operations authorized.
