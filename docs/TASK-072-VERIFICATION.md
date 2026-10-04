# Task 072 verification evidence

Date: 2026-10-04. Current task remains 072 until its canonical CI gate passes.

Published verification fixes: `4b00d0919666f574174fede81dffdea4819f2c58`.

## Source and environment

The published implementation baseline is PR #89, branch
`task073-inference-hardening`, head
`dc4b6e904eb7f4ce44a9aa7f8eb9d8c074467666`. Existing local source blobs were
compared against its recursive GitHub tree before verification. This follow-up
changes test fixtures and authored-source scanners only; it changes no production
admission or authority checks. Main remains
`193ca46b2ed06ff1ced96dab7cb07ea1425345b0`.

Node 24.19.0, pnpm 12.8.2, PostgreSQL 18.6, pgvector 0.8.6. PostgreSQL runs as
its normal non-root user in a disposable isolated QEMU guest. The guest database
uses fsync and synchronous_commit enabled. Its data is temporary; this is not
power-loss or durable-volume qualification. No production or Alpha database was
used. Clock differences between the host and guest exposed fixture assumptions:
authority issuance, publication and expiry test timestamps now use PostgreSQL's
admission clock. Production security was not relaxed.

## Executed checks

- `pnpm install --frozen-lockfile`: passed, including the lockfile policy check.
- `pnpm typecheck`: passed across the full workspace.
- `pnpm build`: passed across the full workspace, including Gateway and Ops/web.
- Both runtime PostgreSQL acceptance suites: **19 passed, zero skipped** using
  `pnpm exec vitest run tests/integration/character-session-acceptance.test.ts tests/integration/agent-run-acceptance.test.ts --maxWorkers=1 --hookTimeout=60000 --testTimeout=30000`.
- Standard `pnpm alpha:verify` after fixes: **passed**, including relevant builds,
  typechecks, **344 unit/architecture tests** and **19 real PostgreSQL acceptance
  tests**, with default command limits and zero database skips.
- Full suite after all fixes and guest timezone installation: **515 passed in
  95 files, zero skips** using
  `pnpm exec vitest run --maxWorkers=1 --hookTimeout=60000 --testTimeout=30000`.
  Serial execution and extended limits are explicit accommodations for emulation;
  this is successful local full-suite evidence, not a hosted CI result.
- Authored-source scanner regression checks after the full build: **9 passed**.
- Outbox crash/recovery fixture after the clock fix: **1 passed**, 40 other tests
  excluded by the explicit test-name filter; no full-file pass is claimed from it.

The initial full database suite under default parallelism did not pass: 491
passed and 24 failed, primarily migration hook timeouts and subsequent schema
collisions in CPU emulation. Those failures are not a successful CI result.
The initial default runtime command also failed before fixture/scanner fixes.
The first broader serial run passed 511 tests and failed four: two generated-source
scanner checks, one outbox timestamp fixture, and a routine test needing timezone
data absent from the minimal guest. The scanners and outbox fixture were corrected;
the guest now includes timezone data. The final broader serial run passes all
515 tests. The initial failures remain documented and are not recast as passes.

## Hosted gate

Foundation CI on the published fixes: run 37182128896, job 111376638905:
failure, `runner_id=0`, zero steps. Mobile Build run 37182128903 likewise
failed with zero steps and no runner. The earlier Foundation CI retry
37178168912, attempt 2, job 111372948229 also recorded failure,
`runner_id=0`, zero steps. No application test executed in that job. A passing
implementation-head and merged-main Foundation CI gate remains required by the
canonical ledger. No exception or successful hosted gate is claimed. Flutter,
APK and live Gemini/provider qualification have not run in this closure attempt.
