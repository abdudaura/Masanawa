# commerce-core — Float allocation request identities

- Owner/window: Codex monetisation continuation, window bd393832a49d
- Status: ACTIVE
- Branch: work/commerce-core-float-commands-20261004
- Base main SHA: 3906419669203844018b6687ad06ab2af48654eb
- Task references: 133–134 (bounded commercial groundwork; neither gate is closed)
- Selected scope: persistent Agent Float allocation commands with atomic ledger transfer
  and replay/conflict protection inside the canonical Commerce repository.
- Last update: 2026-10-04
- Current step: publish/verify ownership, then resume the financial-command idempotency gap.

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

- Implemented: not yet.
- Verified: ownership publication pending; no implementation verification yet.
- Deployed: no.
- Planned evidence: strict Commerce/Postgres typechecks; atomic replay, altered payload,
  cross-tenant/user isolation, insufficient-funds rollback and restart tests.
- Known limits: provider billing/crypto, per-job reserves/refunds, teaching/channel
  implementation and roadmap completion are outside this claim.
