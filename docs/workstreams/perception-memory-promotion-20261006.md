# Perception-to-memory promotion governance — Task 117

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/perception-memory-promotion-20261006`
Base SHA: `4b02adb6fe7a843892794273c5fa2c8a702705f4` (Task 112 perception stack / PR #237)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **117** Implement perception-to-memory promotion governance.
- Canonical Memory storage/scope remains owned by `packages/memory`.

## Owned paths
- `packages/perception/src/memory-promotion.ts` (new)
- `tests/contracts/perception-memory-promotion.test.ts` (new)
- `docs/workstreams/perception-memory-promotion-20261006.md`

## Excluded/shared paths
- No edits to Memory models/repository, Gateway, storage, migrations, package manifests/lockfile or production config.
- No automatic perception -> memory write.

## Dependencies
- Task 109 PerceptionEvent privacy/permission evidence.
- Memory owner later converts an allowed decision into canonical Memory command/state.

## Current state
CLAIMED. Implement fail-closed promotion review requiring durable+review-required source policy, explicit memory-promotion purpose, authorized review evidence, same-or-narrower destination scope, and deterministic denial reasons.