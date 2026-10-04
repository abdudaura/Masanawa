# commerce-core — Float allocation request identities

- Owner/window: Codex monetisation continuation, window bd393832a49d
- Status: ACTIVE
- Branch: work/commerce-core-float-commands-20261004
- Base main SHA: 3906419669203844018b6687ad06ab2af48654eb
- Task references: 133–134 (bounded commercial groundwork; neither gate is closed)
- Selected scope: persistent Agent Float allocation commands with atomic ledger transfer
  and replay/conflict protection inside the canonical Commerce repository, plus bounded
  user-scoped receipt history with keyset pagination and optional Character filtering.
- Last update: 2026-10-04
- Current step: bounded, scoped Float allocation receipt history and restart recovery.

## Exact owned paths

- `docs/workstreams/commerce-core.md`
- `packages/commerce/src/model.ts`
- `packages/commerce/src/repository.ts`
- `packages/commerce/src/float-allocation.test.ts`
- `packages/commerce/migrations/0004_float_allocation_commands.sql`
- `adapters/storage/postgres/src/commerce/repository.ts`
- `adapters/storage/postgres/src/commerce/float-allocation.integration.test.ts`

No wildcard ownership is implied. No ownership of Gateway, mobile, global migrations
registry, package exports, runtime/deployment configuration or canonical guiding docs.

## Shared-contract dependencies and coordination

The Commerce repository port/model additions are owned here and must be reviewed before
dependent integration. Gateway `creator_economy.ts`, request/action schemas and mobile/
channel retry state must later supply a stable RequestId per user-confirmed allocation.
Do not change those paths from this window. Existing allocation flow remains unchanged
until coordinated integration adopts the command port; this slice alone does not make
the current UI idempotent.

Global migration composition already discovers package-owned Commerce migration files;
do not edit applied migrations or shared registry/source configuration. Integration owns
deployment and separate-session PostgreSQL acceptance. No provider calls or deployment.

PR #89 runtime/Gateway/mobile/storage integration ownership and PR #44 credential work
were inspected and do not overlap the exact owned paths above. No published claims
were present in main/open PRs at selection time. Recheck before writes and commits.

## Status and handoff

- Implemented: immutable tenant/user/RequestId command receipts, atomic customer-credit
  to Agent Float transfer, exact replay, changed-payload conflict rejection and scoped reads.
  Database receipt insertion now validates exact ledger custody (accounts, amount, reason,
  timestamp and absence of quote/fulfillment links); ledger aliases are also rejected.
- Verified: claim published and read back before edits; 39 Commerce/architecture tests;
  18 SQL persistence acceptance cases on PGlite PostgreSQL 18.3; Commerce, Postgres and
  Gateway strict typechecks; Gateway dependency build; whitespace checks.
- PGlite serializes its connections. Separate-session PostgreSQL concurrency qualification
  remains required using the checked-in integration suite and MASANAWA_TEST_DATABASE_URL.
- Deployed: no. Migration 0004 is new and unapplied. Tasks 133–134 remain open.
- Rechecked: main remains at the base SHA; PRs 89, 91, 92 and 44 do not overlap owned paths.
  PR 92 owns channel ingress; no channel paths are edited here.
- Initial implementation commit: fea199c3f11f73e4faca9f09513739ce43e662ff.
- Custody hardening implementation: e3d08e0a01b2c7b6b1c737e2683baa6132cad505.
- Latest checks: all 18 SQL cases passed on a fresh PGlite database, including nine
  mismatched-custody variants and duplicate-ledger alias rejection; strict Postgres
  typecheck and whitespace checks passed. Earlier 39 test/build evidence remains valid.

### Next integration step

Integration owner: check current creator authority and one-clone constraints, then call
allocateAgentFloat with one stable canonical RequestId for each confirmed intent.
Persist that ID across network retries, restarts and channel retries. Replay identical
terms with the same ID; changed terms require new confirmation and a new ID.
Failed atomic commands leave no receipt and can be retried after funding.
The existing Gateway allocation flow still uses the old transfer port and must be
adopted by its owning window before any UI idempotency claim. Do not bypass authorization.

This window retains only the exact paths above until merge or explicit transfer.
Provider billing/crypto, reserves/refunds, teaching/channel implementation and roadmap
completion remain outside this claim.
