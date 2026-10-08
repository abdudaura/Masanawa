# R16 — disposable PostgreSQL bootstrap freshness (stacked continuation)

Window/owner: GPT-6, independent R16 reclaim, 2026-10-08 UTC.
Status: CLAIMED — implementation in progress, not tested/merged/deployed.
Branch: `work/r16-disposable-bootstrap-freshness-20261008-gpt6`.
Latest reviewed main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Inherited PR #479: `work/r16-schema-portability-20261008` head `65c53ecd9060af701d30ffbe8914a6e6567863e4`; original base main `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`. #479 last visible update 2026-10-08T11:15:49Z (over five-minute stale-claim boundary at takeover). Preserve its complete source; **stack changes on it** rather than replicate files in a second migration implementation. PR will target parent branch, not main; integrator must merge parent first or reconcile cherry-pick against fresh main.
Requirements: R16, Q08/Q09/Q10, J10/J11; database portability/disposable-restore qualification.
Exact owned paths for this continuation: `adapters/storage/postgres/src/schema_admin/operations.ts`, `adapters/storage/postgres/src/schema_admin/operations.test.ts`, `adapters/storage/postgres/src/schema_admin/operations.integration.test.ts`, `docs/workstreams/r16-disposable-bootstrap-freshness-20261008.md`. Original #479 owner has been inactive; recheck before each edit. All other Gateway, package registries, financial ledgers, migrations, mobile and Actions paths excluded.
Target feature: fail closed on *any* pre-existing non-system schema and on public user-created callable/type objects in a named disposable database, even if the known Masanawa schemas/tables are absent. Continue with real PG18 negative-then-positive coverage, no seed/data drop, durable handoff, draft PR. No Flutter consumer UI/auth route applies to privileged local operator CLI; DB access uses operator-only env credentials.
Shared dependencies: upstream draft PR #479; actual PG18 sandbox; CI issue #457 Work owner. No live DB access/credentials, no workflow retry loop.
Status and exact executed/unexecuted checks will be appended after source changes. Five-minute lease applies, and this document's first push is repository-visible claim.
