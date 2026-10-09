# AF13 — evidence ledger & guarded qualification (MASANAWA-01)

**Source state:** PARTIAL_IMPLEMENTATION — tests of deterministic core run, native Node and cross-boundary execution not run. **Never deployed.** This is one completed code slice of AF13, not AF13 overall acceptance.

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
- **NOT_RUN:** Node native `node --test` file (10 authored tests), Node filesystem/hash CLI execution, exact-head Git local checkout, Flutter/Android tests, physical two-device audio, PostgreSQL migration/restore/concurrency, external providers, object bucket access, performance and rollback. The connected GitHub integration supplied source but not a local git checkout; repository could not be cloned from the isolated container due to unavailable public DNS/network.
- Existing related draft inputs preserved for AF00/AF13 reconciliation: #527, #518, #559, #561, #554, #567, #570. No existing tool was replaced or forcibly merged.
- No cost incurred, provider actions, production database mutations, deployment or migrations.

## Contracts, acceptance and remaining source

- Current AF-v1 contracts: `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md`, `docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md`, `docs/AUDIO-FIRST-SCREEN-SPECS.md`, `docs/BACKEND-STORAGE-OPERATIONS-20261009.md`.
- AF13 dependency: AF00 canonical shell/composition and release targeting. This tool runs independently; its feature tests cannot verify actual auth, escrow, media or storage behavior. AF01/AF05/AF07/AF08/AF09/AF10/AF11/AF14/AF15 own the actual implementation and device/provider/DB probes; AF13 records independent evidence and remaining negative controls.
- Known unimplemented AF13 breadth: no actual wired device runner or provider/DB recorder, accessibility/performance automation, complete threat audit, restoration harness, safe rollback signoff, nor production-grade independent proof attestation. For those journeys the correct result stays NOT_RUN/BLOCKED.
- No new DB schema, migration, route or API endpoints; rollback: revert isolated `tools/audio-first-qualification/` files. Runtime app behavior remains unchanged.

## Next integration action

1. Run the committed native Node suite and CLI with negative proof-path/modified-proof fixtures on a real isolated checkout; fix any failure, update SHA evidence. Probe `git HEAD` mismatch and simulated/real status confusion.
2. Review conflicts and automatically triggered deployment for the safe target. Merge this tested read-only tool promptly to a non-deploying integration branch (or main only after verifying no unsafe production trigger). Do not merge using the V8 tests as if they were native Node proof.
3. Independently execute and redact representative real UX/WF/DB journeys and physical device/restore tests at the exact integrated artifact SHA. Reviewed proof is necessary for production qualification, and release is not automated by this tool.
4. Release registry claim after this committed SHA-specific handoff and PR readback; preserve all existing unmerged branches.
