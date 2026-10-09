# U20 — Evidence qualification and safe local test inventory

This is a **read-only, isolated release-evidence toolkit**, not a release certification or feature-completeness claim. It does not replace F11 PR #518's cross-PR collision auditor, Work #497's integration, CI #457, or human release sign-off.

## Quick use

From a checked-out repository, with Node 24 as declared in the root `package.json`:

```sh
node --test tools/product_qualification/u20/*.test.mjs
node tools/product_qualification/u20/qualification-cli.mjs --gates
node tools/product_qualification/u20/qualification-cli.mjs --init "$(git rev-parse HEAD)" --out /tmp/u20-evidence.json
node tools/product_qualification/u20/qualification-cli.mjs --check /tmp/u20-evidence.json --out /tmp/u20-report.json
node tools/product_qualification/u20/migration-inventory.mjs . /tmp/u20-migrations.json
```

The `--check` invocation **intentionally exits 1** until independent release sign-off outside this tool, even if all 58 gate records are candidates. A new output file is required: the CLI refuses to overwrite an existing report. The migration inventory reads checkout-local SQL only: it never applies migrations. It warns about duplicate numeric migration versions **within the same directory**; separate schema registries may legitimately share numbers.

Optional test capture (only explicit safe suite IDs; no arbitrary command strings):

```sh
node tools/product_qualification/u20/suite-runner.mjs contracts . /tmp/u20-contracts-result.json
node tools/product_qualification/u20/suite-runner.mjs security . /tmp/u20-security-result.json
node tools/product_qualification/u20/suite-runner.mjs recovery . /tmp/u20-recovery-result.json
node tools/product_qualification/u20/suite-runner.mjs architecture . /tmp/u20-architecture-result.json
node tools/product_qualification/u20/suite-runner.mjs flutter . /tmp/u20-flutter-result.json
```

The runner strips common provider credentials, sets `NODE_ENV=test`, uses no shell and records exit code, output digest, timestamps and test count only if the test runner prints a recognizable summary. It **does not include stdout/stderr in its JSON** (which may contain secrets), declare that test doubles were absent, or produce automatically accepted evidence. Run only in a **disposable local/test environment**: environment scrubbing is a guard, not a guarantee against hardcoded external endpoints in the underlying scripts.

## Evidence rules

Every R01–R19, C01–C08, J01–J11, K01–K20 entry is **NOT_RUN** by default. A declared PASS is rejected unless each required evidence class has a real-execution record with exact matching 40-character SHA, environment, executor, command/procedure, nonzero passing assertions, zero skipped/failed tests, zero exit code, interval, output checksum and independent evidence reference. Privacy, authorization, database, physical-device, live audio and provider classes require additional references/scenarios. Reused output digests are invalid.

`EVIDENCE_CANDIDATE` means the supplied record is **structurally plausible only**. A self-authored manifest cannot prove the provider, human device, credentials, signatures, financial receipt or staging deployment was genuine. `release` remains **BLOCKED** until separately reviewed CI, disposable PostgreSQL and restore, Firebase notifications, audio, physical Android and provider evidence exist. No production deployment or financial actions are executed by this toolkit.

## Boundaries and handoff

- U20 owns only `tools/product_qualification/u20/**` and its own workstream handoff.
- It never edits canonical migration registry, shared Gateway, five-tab root, Firebase native configuration or financial code.
- The gate matrix is a **minimum cross-cutting checklist**, not a replacement for journey-specific requirements, U01's contract fixtures or actual tests.
- Existing U01 contract fixtures are on unmerged PR #519 and cannot truthfully be called verified from this branch. Work must attach them after choosing final contract revisions.
- F11's #518 PR collision auditor is complementary and remains authoritative for branch overlap/merge ordering.

