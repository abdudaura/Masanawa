# U20 — Release qualification and evidence runner: SHA-specific handoff

**Status: PARTIAL_IMPLEMENTATION · DRAFT · UNMERGED · NOT DEPLOYED · RELEASE BLOCKED.**

**Claim:** 2026-10-09 approximately 01:17 Africa/Lagos. Claimed in repository before source edits at commit `5e8eac403508cd793b7371c6335f2324cc56a95f`. Ownership lease is refreshed by actual pushed commits, not a permanent lock.

**Main baseline inspected:** `5e758673ae91082520b21b3153da53791ae2cbf3`. **Isolated branch:** `work/u20-release-qualification-20261009-gpt6`. **Latest substantive source + test + README checkpoint:** `3233ead66343837ff00f8733f886f60c807d0c55`. The PR head after the handoff commit is recorded in the PR body. No changes to `main`.

## Ownership and collision check

Only `tools/product_qualification/u20/**` plus this dedicated handoff are modified. F11 PR [#518](https://github.com/Baatiku/masanawa/pull/518) owns **cross-PR** file/migration collision auditing; this window deliberately did not edit its `scripts/audit-draft-pr-collisions.mjs` or replicate GitHub API enumeration. Work [#497](https://github.com/Baatiku/masanawa/pull/497) owns shared integration; [#461](https://github.com/Baatiku/masanawa/pull/461) owns Firebase. Multiple R/C feature PRs remain draft; C02 #472 vs #475, C05 #474 vs #476, C06 #487 vs #490 cannot be treated as independent additive migrations. U01's v1 contract source is on draft [#519](https://github.com/Baatiku/masanawa/pull/519); this branch has not imported or silently copied it.

At selection time GitHub returned 78 open PRs, draft PRs covering U01–U07 and U21–U30, and a U08 branch. No U20 branch/PR or prior U20 handoff existed. The reason to select U20 was to provide a needed **isolated gate/evidence execution tool** during active multi-window development, not to duplicate another owner.

## Source authored, not release-complete

- `qualification.mjs`: explicit 58-gate inventory (19 R + 8 C + 11 J + 20 K) and fail-closed manifest validator. Rejects missing execution, mismatched target commit, mocked/skipped/failed assertions, duplicated output checksums, missing device/provider/DB references, missing auth/privacy negative scenarios, and contradictory/unknown statuses. A PASS record yields **EVIDENCE_CANDIDATE**, never a release grant.
- `qualification-cli.mjs`: creates exact-SHA all-`NOT_RUN` template, validates JSON, prints gate IDs, outputs machine-readable reports without overwriting existing files. Intentionally exits nonzero on release-blocked reports.
- `suite-runner.mjs`: a fixed allowlist for contract, security, recovery, architecture and Flutter tests. Shell disabled, sensitive provider environment variable names stripped, test-mode environment set, bounded subprocess, command and raw-output digest captured. **Not proof of no test doubles**, and must be used in a disposable environment.
- `migration-inventory.mjs`: read-only checkout SQL inventory with SHA-256 and same-directory numeric-version ambiguity warnings. **No migration was applied**. It does not compare unmerged PR branches; that remains F11.
- `qualification.test.mjs`, `migration-inventory.test.mjs`: negative security, integrity, status, consent/authorization, branch-independent version, symlink and no-execution tests.
- `README.md`: reproducible commands, expected fail-closed exit statuses and honest release boundary.

## Executed verification (scoped only)

**Offline scratch working copy, 2026-10-09, Node `v22.16.0`:**

```sh
node --test /mnt/data/u20/qualification.test.mjs /mnt/data/u20/migration-inventory.test.mjs
# 18 tests; 18 pass; 0 fail; 0 skipped; 0 cancelled
node /mnt/data/u20/qualification-cli.mjs --init <40-char-test-SHA> --out /mnt/data/u20/example-not-run.json
node /mnt/data/u20/qualification-cli.mjs --check /mnt/data/u20/example-not-run.json --out /mnt/data/u20/report.json
# exit 1 (expected: 58/58 NOT_RUN and release blocked)
```

The scratch sources implement the same modules authored on the GitHub branch; these executions are **local unit evidence**, not CI on the pushed exact commit, a real repository test suite, a database restore, or an Android/provider result. The root repository requires Node >=24; Node 22 testing is preliminary compatibility evidence only. Follow `tools/product_qualification/u20/README.md` from a fresh checkout using Node 24 to obtain commit-specific verification.

**Not run / not asserted:** full pnpm typecheck/build/Vitest/Gateway/Flutter analyzer or widget suite against a fresh `main`/branch checkout; CI runner quota #457; canonical U01 PR #519 fixtures against selected interface revision; PostgreSQL migrations/restoration; physical two-account Android J/K journeys; LiveKit/Gemini audio; Flutterwave/NOWPayments sandbox; FCM/APNs/Firebase device enrollment, production deploy and release. These remain explicit release blockers, not inferred PASS.

## Security and regression boundaries

Does not edit shared Gateway composition, migration sequencer, five-tab Flutter routes, finance/ledger/provider code, authenticated identity, Firebase, Actions/workflows, or production. No API secrets stored. Release remains `BLOCKED` even if all JSON evidence appears structurally plausible: manual proof review is necessary to prevent a fabricated receipt or test log from being accepted. No commercial payments, deployments, migrations or user messages were sent.

## Next integration work / precise acceptance steps

1. Work/F11 owner inventories all open PR heads and collision/duplicate migration paths using the already-owned #518 tooling; choose one canonical C02/C05/C06 authority before applying schema.
2. CI owner on a clean checkout with Node 24 runs `node --test tools/product_qualification/u20/*.test.mjs`, then root package's real contract/security/recovery/architecture tests and Flutter tests; record exact commit, outputs and failures. Do not mark skips as pass.
3. After canonical U01 contract #519 is selected, attach contract-fixture compatibility and actual J01–J11, K01–K20, R01–R19, C01–C08 executed records. Submit DB restore/device/voice/provider/Firebase proof references for independent human verification.
4. Only the final authorized Work integrator may compose scripts into shared CI or change migration/Firebase/financial/router authorities. This U20 PR **must remain draft/unmerged** until those dependencies and external gates are reviewed.

**Source completeness:** PARTIAL_IMPLEMENTATION (only isolated qualification/recovery helper built; canonical U01 compatibility and global qualification integration pending). **Verification:** FOCUSED_PASS in scratch copy only, exact PR-head verification NOT_RUN. **Integration:** ISOLATED. **Release:** BLOCKED.
