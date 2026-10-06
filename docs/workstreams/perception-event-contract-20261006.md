# Canonical permission-scoped PerceptionEvent — Task 109

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/perception-event-contract-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **109** Implement normalized permission-scoped PerceptionEvent.
- `docs/SOURCE-OWNERSHIP.md` — `packages/perception` owns canonical PerceptionEvent; device nodes remain adapters.

## Owned paths
- `packages/perception/src/perception-event.ts` (new)
- `packages/perception/src/index.ts` (new)
- `tests/contracts/perception-event.test.ts` (new)
- `docs/workstreams/perception-event-contract-20261006.md`

## Excluded/shared paths
- No edits to `packages/contracts`, root package/lockfile/workspace config, Gateway, devices, channels, memory, migrations, production environment or PR #136-owned paths.
- No package-manifest activation in this slice, because adding a new workspace importer would require shared `pnpm-lock.yaml` ownership.

## Dependencies
- Existing canonical IDs remain represented as validated opaque canonical strings at this boundary; shared Contracts changes are not required.
- Tasks 110-112 will supply text/file/device/sensor-specific admission adapters that normalize into this event.
- Security/authority and persistence owners will compose authorization/persistence; PerceptionEvent itself grants no authority.

## Current state
CLAIMED. Implement normalized source, subject, scope, permission evidence, timestamps, dedupe identity, bounded payload metadata, privacy classification and fail-closed validation, plus root contract tests.