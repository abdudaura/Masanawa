# F11 / R16 — independent CI zero-step evidence verifier (2026-10-09)

**State:** `PARTIAL_IMPLEMENTATION` of F11/R16; **unit-tested isolated verification tool, not a recovered CI system**. [Draft PR #567](https://github.com/Baatiku/masanawa/pull/567) is OPEN/UNMERGED; no deploy, merge, release or production change.

## Immutable provenance and scoped ownership

- Main baseline: `5e758673ae91082520b21b3153da53791ae2cbf3` (latest observed `main` at claim).
- New draft branch: `work/f11-zero-step-ci-evidence-20261009-gpt6`; feature+test checkpoint HEAD: `02b58528e27662af469b61020cfc7bf1f69e3409`. Handoff document commit advances HEAD after that code checkpoint; rely on PR metadata for final handoff commit.
- Five-minute CAS coordinator `factory/claims`, registry initially committed `c83a8aa3f64bedfb973bce97b50cee2d00480c70`, heartbeat/PR linkage `38b1f68eb9f25e330546783598b09111d99e1147`.
- Exclusive paths: `tools/ci-evidence/check-run.mjs`, `tools/ci-evidence/check-run.test.mjs`, this document. Other F11 draft tools and shared CI are **not** touched or claimed.
- Explicitly preserved: #460 / issue #457 as Work's shared-CI remediation owner; Work #497, Firebase #461, five-tab R17/C08, C01–C08 and every U01–U30 draft source. No financial, migration, native or Gateway file modified.

## Real source added

1. Dependency-free Node ES module that reads only Actions run and paginated jobs (repository-scoped, no arbitrary URL), with immutable run ID match, total_count consistency, 20-page bound, 15-second request timeout and rejected HTTP redirects.
2. `classifyRun` reports `NOT_EXECUTED` for zero completed/timed steps; `INCOMPLETE` for malformed/in-progress/incomplete evidence; `EXECUTED_FAILED` for actually started steps with a failed run/job/step; `EXECUTED_UNQUALIFIED` for a successful setup-only or missing-required-tests job; and `STEPS_EXECUTED_GREEN_NOT_E2E` only for successful, timed, explicitly named validation steps. Never labels success as an application E2E pass.
3. Refuses to run the CLI without explicit named validation steps; returns nonzero for every unqualified state. Sanitized JSON output; no token or GitHub API response body printed on errors.

Example (run from repository root, with a read-capable `GH_TOKEN`/ `GITHUB_TOKEN` supplied **outside source** if private API requires it):

```sh
node tools/ci-evidence/check-run.mjs --owner Baatiku --repo masanawa --run 37735087817 --require-step Typecheck --require-step Test --require-step Build
node tools/ci-evidence/check-run.mjs --owner Baatiku --repo masanawa --run 37735701359 --require-step Analyze --require-step Test --require-step 'Phone (production APK)'
```

These sample historical runs are expected to **exit 2**, because they did not start job steps; do not use them as tests of app code.

## Executed, local, SHA-bound evidence

- Local environment: Linux container, `node v22.16.0`, no production service operation.
- `node --check /mnt/data/ci-evidence/check-run.mjs`: PASS.
- `node --check /mnt/data/ci-evidence/check-run.test.mjs`: PASS.
- `node --test /mnt/data/ci-evidence/check-run.test.mjs`: **18 pass, 0 fail**. Cases cover pre-step failure, setup-only false green, timed required tests, real step failures, cancellations, malformed/incomplete run, skipped jobs, exact required names, missing timing, paginated API consistency and token-safe HTTP errors.
- GitHub committed source blob `dd931897bfe2a2a8fdb1718e4bcd30f47ddac8ea` and test blob `1792f522ba848380ab3576fd0c3674c398a5caa3` were read back from GitHub and independently matched by `git hash-object` of the **locally executed** files.
- Live read-only GitHub REST inspection (2026-10-09): [Foundation CI run 37735087817](https://github.com/Baatiku/masanawa/actions/runs/37735087817) at `97936c102ee117c6d631468298eb6849d35bf7bd` and [Mobile Build run 37735701359](https://github.com/Baatiku/masanawa/actions/runs/37735701359) at `9836854f534306e1dea18925be5be21d31b768e3` both report `completed/failure`, 1 failed job with **0 steps**, matching the narrow incident symptom. **The live API observation was made with the connected GitHub read tool, not this local CLI**.

## Unverified / blocked, not passed

- Full Node 24/pnpm/Vitest/TypeScript monorepo, real private authenticated CLI execution in local shell, Flutter analyzer/tests/APK signing/device, disposable PostgreSQL migration/restore, FCM/Firebase, LiveKit/media/voice, Flutterwave/NOWPayments provider checks: **NOT RUN**. These aren't claims of success or code failure.
- Shared GitHub Actions quota/billing, runner settings, annotations and actual failure cause: **not repaired or diagnosed**; reserved to #457/Work. An observed `failure` with no steps does not prove a code defect or the exact infrastructure cause.
- No source link into shared CI workflows: intentionally deferred to Work owner; a stand-alone read-only verifier is not a release gate until invoked in approved CI or local integration and its outputs are retained.

## Next integrator actions, in dependency order

1. Work #457: inspect live Actions annotations/runner quota/billing/settings under authorization; independently establish precise pre-step root cause without no-op workflow changes.
2. On a real checked-out repository at this PR's HEAD, rerun `node --check` and `node --test tools/ci-evidence/check-run.test.mjs` with supported Node 24; review this verifier against actual Actions job-step payloads, including optional/skipped-job policy.
3. Only after runner recovery, invoke the two workflow-specific sample commands with **new** runs at a named source SHA and retain sanitized JSON. Require actual Test/Typecheck/Build for Foundation and Analyze/Test/Phone for Mobile; inspect full logs if they fail. A green verifier classification still does not establish Flutter/server E2E.
4. Reconcile with existing F11 auditors (#518, #554, #559, #561, #563, #566) and other release gates before integrating. Verify no duplicate path ownership and avoid changes to auth, payments, database migrations, firmware, Firebase or five-tab router.
5. Execute actual F11 release gates: disposable PG schema/restore, mobile APK certificate/build/install and device tests, backend auth/security, provider/LiveKit/FCM qualification and guarded rollback. Leave all unfinished R/C/U/F state explicitly unverified until backed by evidence.

No CI/billing setting changed. No merged/deleted branch. No device, provider or customer funds touched.
