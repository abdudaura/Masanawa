# AF13 — evidence ledger & guarded qualification (MASANAWA-01)

**Source state:** PARTIAL_IMPLEMENTATION — deterministic core and native Node unit/CLI-negative tests run on byte-for-byte fetched source; cross-boundary/provider/device executions not run. **Never deployed.** This is one completed code slice of AF13, not AF13 overall acceptance.

## Ownership / provenance

- Window/owner: `MASANAWA-01 / AF13`.
- Claim ID: `masanawa-01-af13-evidence-ledger-20261009`, first published and read back on the `factory/claims` coordination branch at **2026-10-09T21:59:05Z**. Renewed 22:01:06Z and 22:03:55Z.
- Branch: `work/af13-evidence-ledger-20261009-masanawa01`.
- Main base: `f381f077c485c04261459b77a42c215d3ce3a14b`. Source/test checkpoint: `e830bd9dca7b005aee357e820db694998d76a31a`. Latest code-only source: `399693456bd7d90be4d2803558931f18e109e43d`.
- PR: https://github.com/Baatiku/masanawa/pull/596 (draft until native tests/integration checks).
- Exact owned paths: `tools/audio-first-qualification/qualify.mjs`, `tools/audio-first-qualification/qualify.test.mjs`, `tools/audio-first-qualification/journeys.json`, and this handoff file. No runtime/CI/router/migration/ledger/prod configuration paths changed.

## Implemented

A read-only Node 22 qualification CLI and a versioned AF-v1 matrix tracking 43 journeys: UX-A01–12, WF-A01–10, CR-A01, PF-A01–04, SA-A01–08, DB-A01–08. Boundaries include authenticated Gateway, PostgreSQL, provider, object, device, permission/offline, security, accessibility and recovery where appropriate. Matrix coverage is mandatory in the CLI even if a caller supplies a different matrix path.

Evidence records contain journey ID, exact code SHA, execution timestamp, claimed boundary observations, environment, result, optional failure reason, and (for PASS_REAL) hashed proof files, independent review metadata, and relevant provider/database/device/APK provenance. The CLI verifies `git rev-parse HEAD` against the supplied SHA, rejects duplicates, malformed states, wrong SHA, missing true-boundary descriptions, unsafe proof traversal/outside symlinks, oversized or changed proof files, unhashed APK references and obvious unredacted credentials/contact emails. Reports print only status/IDs/errors, not submitted evidence bodies.

A report of all real passes is still **REVIEW_REQUIRED** and exits nonzero: the CLI cannot independently certify what happened on a physical device/provider, and never issues production permission. Missing/failed/blocked journeys cannot be represented as verified end-to-end tests.

## Reproducible commands for integrator

```sh
node --version
node --test tools/audio-first-qualification/qualify.test.mjs

# On an isolated checkout of exactly one relevant source commit:
node tools/audio-first-qualification/qualify.mjs \
  --matrix tools/audio-first-qualification/journeys.json \
  --evidence /path/to/redacted-evidence.json \
  --sha "$(git rev-parse HEAD)" \
  --proof-root /path/to/read-only-proof-directory
```

Evidence format is a JSON array. A safe placeholder for an unexecuted journey is `{"journeyId":"WF-A01","result":"NOT_RUN","codeSha":"<checkout SHA>","executedAt":"<ISO timestamp>","boundaries":[],"environment":{"mode":"not_run"}}`; omission also defaults to NOT_RUN. For a real handset claim, append independently reviewed redacted observations and a local `proofs` item with `kind:"apk"`, verified SHA256 and exact matching `apkSha256`. Prove provider/database boundaries with real authority, not a mock or a health 200. Exit code 1 = blocked/failed/invalid; 2 = input or runtime error; 3 = all release-listed journeys reported real but **manual review still mandatory**; never treat 3 as release approval.

## Actually executed

- **PASS_SIMULATED:** 15/15 deterministic V8 probes exercising the **exact committed** `qualify.mjs` pure validation functions at blob `ab504d8c4bd5bb7a1aceee9db05911129091666f`. Includes the complete 43-ID matrix, zero-evidence denial, wrong SHA, duplicates, forged PASS_REAL, simulated-vs-real status, missing failure reason, unredacted bearer/email rejection, unknown ID redaction, malformed proof, missing APK proof and no automatic E2E promotion.
- **PASS_SIMULATED / NATIVE NODE:** `node --test /mnt/data/af13/qualify.test.mjs` executed on Node **v22.16.0**: **10/10 tests passed**, including actual temporary-file SHA256 hashing, tamper/traversal and review-gate negatives. Both exact local byte copies were checked with `git hash-object`: `qualify.mjs` = `ab504d8c4bd5bb7a1aceee9db05911129091666f`; `qualify.test.mjs` = `ae91c6dd8f543eed81944b2fcbfa1f97fc85638a`, matching live GitHub file blob identities. This is *native local unit execution*, **not** provider E2E.
- **PASS_SIMULATED / CLI LOCAL FIXTURE:** Initialized a disposable isolated local Git checkout with a generated 43-ID fixture matrix to exercise exact source CLI: empty evidence → `BLOCKED`/exit 1; forged PASS_REAL in simulated environment → `INVALID`/exit 1; wrong `--sha` → fail-closed exit 2. This is not a real Masanawa checkout or authoritative provider proof.
- **NOT_RUN:** Original full repository checkout/build/Flutter/Android, physical two-device audio, PostgreSQL migration/restore/concurrency, real external providers, object bucket access, performance and rollback. Connected GitHub supplied the source; the isolated container could not clone the full repository because public DNS/network was unavailable.
- **CI infrastructure BLOCKED:** PR #596 head `adb0cad1bc150cdf40ba718719aba9223303c46c` Foundation CI run `37997178958` reported failure with job `114046097101` containing **zero executed steps**; requested logs unavailable. Vercel status failed with **build-rate-limit** upgrade URL. Neither is evidence the 10 Node tests failed; neither is a green build. Never treat an empty job as a test run.
- Existing related draft inputs preserved for AF00/AF13 reconciliation: #527, #518, #559, #561, #554, #567, #570. No existing tool was replaced or forcibly merged.
- No cost incurred, provider actions, production database mutations, deployment or migrations.

## Contracts, acceptance and remaining source

- Current AF-v1 contracts: `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md`, `docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md`, `docs/AUDIO-FIRST-SCREEN-SPECS.md`, `docs/BACKEND-STORAGE-OPERATIONS-20261009.md`.
- AF13 dependency: AF00 canonical shell/composition and release targeting. This tool runs independently; its feature tests cannot verify actual auth, escrow, media or storage behavior. AF01/AF05/AF07/AF08/AF09/AF10/AF11/AF14/AF15 own the actual implementation and device/provider/DB probes; AF13 records independent evidence and remaining negative controls.
- Known unimplemented AF13 breadth: no actual wired device runner or provider/DB recorder, accessibility/performance automation, complete threat audit, restoration harness, safe rollback signoff, nor production-grade independent proof attestation. For those journeys the correct result stays NOT_RUN/BLOCKED.
- No new DB schema, migration, route or API endpoints; rollback: revert isolated `tools/audio-first-qualification/` files. Runtime app behavior remains unchanged.

## Next integration action

1. Re-run the already-passing 10 native tests and CLI negative fixtures against the exact integrated repository checkout; include the complete committed 43-ID matrix and verify artifact/signature tooling rather than the locally generated fixture. Fix any true failures at that checkout SHA.
2. Review conflicts and automatically triggered deployment for the safe target. Merge this tested read-only tool promptly to a non-deploying integration branch (or main only after verifying no unsafe production trigger). Do not merge using the V8 tests as if they were native Node proof.
3. Independently execute and redact representative real UX/WF/DB journeys and physical device/restore tests at the exact integrated artifact SHA. Reviewed proof is necessary for production qualification, and release is not automated by this tool.
4. Release registry claim after this committed SHA-specific handoff and PR readback; preserve all existing unmerged branches.


## 2026-10-10 continuation — integrate security guard into the elected qualifier

**Workstream:** AF13 / MASANAWA-01. **Source checkpoint SHA:** `2143def26206cb79624e72053f2e66dbf56beb2e` on `work/af13-evidence-ledger-20261009-masanawa01`; base before current docs-only main advance: `f381f077c485c04261459b77a42c215d3ce3a14b`. **PR:** #596. Exact source paths: `tools/audio-first-qualification/qualify.mjs`, `tools/audio-first-qualification/qualify.test.mjs`, `tests/security/audio_first/evidence_path_guard.mjs`, `tests/security/audio_first/evidence_path_guard.test.mjs`, this handoff. Published and read back exact-path claim `masanawa01-af13-qualifier-guard-integration-20261010` on `factory/claims`; later renewed at commit `cccecba666fdf217c380c8eee67c226b3b968b28`.

**Source now connected:** PR #603 guard adopted into this existing #596 qualifier; `verifyProofs` delegates to the hardened `verifyEvidenceFile` rather than maintaining its own fs-path/hash loop. The guard rejects every symlinked path component, empty files, escaping roots, nonregular artifacts and invalid digests; bounds streaming SHA-256 proof reads to 8 MiB; uses nonblocking/no-follow open, descriptor pre/post identity checks and a follow-up path identity check. Qualifier retains case-insensitive SHA-256 input and existing exact-SHA, journey, review-required and nonzero release gating. No source or data authority beyond existing AF13 evidence reporting was introduced. **Not a perfect defense against adversarial concurrent path-component renames:** proof roots must be operator-controlled, immutable/read-only during qualification; production-grade race-hardening requires a reviewed file-descriptor walk or isolated read-only filesystem.

**Related PR disposition:** #592 and #594 were already merged to separate non-production branches, not current main; their unique validation logic requires coverage comparison before retirement. #596 elected as 43-journey acceptance authority; #603 distinct path validator has been adopted into #596 and remains open until an integrator confirms equivalent coverage and safe target disposition. Do not launch or merge another competing qualification runner. Review latest `docs/NEXT-WAVE-DELIVERY-20261010.md` on main `c7f7280e640d3098be3e26f05149a0d66085441b` (that main advance only changed coordination documentation), and use the one published common nondeploying target when established.

**Actually executed / precise limits:** Node v22.16.0 local `node --test /mnt/data/af13-integrated-check/*.test.mjs` **5/5 PASS_SIMULATED** on independently reconstructed security/integration logic, including real temporary files, traversal, internal directory/leaf symlinks, empty file, tamper, digest casing, bounds and sanitized errors. Separately exercised a local Linux named FIFO; nonblocking read returned `NOT_FILE`. Local mirror is **not byte-for-byte equivalent** to committed GitHub files (GitHub guard blob `81c2b0bab4d0c741830d2db3294dbe3c1c72ecf1`); do **not** advertise these as exact-head module tests. Four committed sources/tests fetched back from GitHub with expected content; eight static integration invariants passed. **NOT_RUN:** `node --test tools/audio-first-qualification/qualify.test.mjs tests/security/audio_first/evidence_path_guard.test.mjs` against full checked-out PR SHA, CLI against 43 committed journeys on checked-out SHA, native GitHub Actions, device/provider/DB/restore or deployment. Container Git clone attempt failed DNS `Could not resolve host: github.com`; GitHub connector provided source/writes but not an execution checkout.

**Next executable action (AF13 with AF00 integration):** run the committed 12 qualifier + 5 file-guard native Node tests at exact integrated SHA, perform full CLI BLOCKED/INVALID negative fixtures, compare against #592/#594 unique safety assertions, and merge the reviewed single elected tool into AF00's non-deploying, trigger-audited common integration baseline. Do not merge to main before analyzing its auto-deploy hooks; do not label the 43 journeys VERIFIED_E2E without independent real evidence. No runtime, money, native, storage, migration, deployment or provider changes in this continuation. Required contract and acceptance: AF-v1, UX-A01–12/WF-A01–10/CR-A01/PF-A01–04/SA-A01–08/DB-A01–08.

**Status:** PARTIAL_IMPLEMENTATION (connected qualifier integration source committed; exact-head executable test and unified integration still outstanding). **Rollback:** revert this bounded qualification integration; no schema or customer data is modified.


## 2026-10-10 AF13 canonical continuation — syntax repair and native verification

- Parent milestone: AF13 + AF15 storage/operations qualification, with AF00 unified safe source baseline. This document is **not** a real user/provider/device/restore acceptance.
- Ownership: `gpt6-af13-qualifier-integration-fix-20261010` claimed in live `factory/claims` at 2026-10-10T01:51:56Z after prior qualifier claim released. Existing #596 branch updated in place; no additional PR, validator or integration branch.
- Original connected integration qualifier blob `d1626629d7d582b53160fd2a13d0185349e2b9cb` was **syntax-invalid** at `assess()` / `verifyProofs()`: `jexport async` and `}ble proof` mangled the returned journey list and exports. Source fix commit `eb628bc85ba3944588bf35d1d43b349e77899a46`, repaired blob `e8de8a1ee18c2553ae95d58ba1e5548c4a5662d4`. No behavior weakening or duplicate verifier.
- **PASS_REAL local executable unit suite**, Node.js v22.16.0 on Linux: reconstructed four source/test files exactly (Git blob SHA check passed for every file) and ran `node --check tools/audio-first-qualification/qualify.mjs`, `node --check tools/audio-first-qualification/qualify.test.mjs`, `node --check tests/security/audio_first/evidence_path_guard.mjs` and `node --test tests/security/audio_first/evidence_path_guard.test.mjs tools/audio-first-qualification/qualify.test.mjs`. Result: **16 passed, 0 failed, 0 skipped** (12 canonical qualification + 4 path/security). Blob fingerprints: `qualify.mjs e8de8a1ee18c2553ae95d58ba1e5548c4a5662d4`; `qualify.test.mjs 2fc894a1847fa7ab2b60ccdbfdfcf2cb1e7fa484`; `evidence_path_guard.mjs 81c2b0bab4d0c741830d2db3294dbe3c1c72ecf1`; `evidence_path_guard.test.mjs f889020ef69cf0cf32060efbcddb2c2cf467c84c`. These tests use temporary mock evidence and thus do **not** establish real customer/provider/device/DB boundaries; in journey language they support PASS_SIMULATED only.
- Existing #603 closed *unmerged* as superseded, preserving history; #596 contains and extends its guarded file implementation. #592/#594 are separate tested structural validators already merged into **different** AF13 integration branches; they are not a reason to create yet another branch. AF13 qualification must elect one canonical runner and preserve unique verification controls.
- **Pending integration blocker:** no AF00-designated single, deployment-trigger-audited common nonproduction source baseline was identified. Main `c7f7280e640d3098be3e26f05149a0d66085441b` has GitHub/Vercel automatic-deploy considerations, and PR preview builds hit a Vercel free-plan rate limit. Existing `integration/af13-qualification-20261009` and `integration/af13-evidence-20261009` are separate preliminary branches, not a published unified integration decision. **Execution owner AF00**: publish exact elected safe branch/head and deploy filters; then bounded reviewer may merge tested #596 (refresh head and re-run affected source tests). Until then, source remains in existing #596, **IMPLEMENTED_UNVERIFIED at domain level**.
- Remaining customer-boundary execution: physical device & signed APK, actual PostgreSQL/SA/DB storage and backup/recovery, real provider/object readback, roles/revocation, deployment/rollback. These remain NOT_RUN/BLOCKED with AF13/AF15/domain lead execution; do not label VERIFIED_E2E or DEPLOYED_VERIFIED.
