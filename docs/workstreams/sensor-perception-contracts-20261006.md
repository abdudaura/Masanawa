# Notification/device-state/location perception contracts — Task 112

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/sensor-perception-contracts-20261006`
Base SHA: `a5771c1db7e297fa43c9be75231b3d544818bcf0` (Task 111 exact head / PR #234)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **112** Implement notification/device-state/location sensor contracts.
- Depends on Task 109 canonical PerceptionEvent.

## Owned paths
- `packages/perception/src/sensor-admission.ts` (new)
- `tests/contracts/sensor-perception-admission.test.ts` (new)
- `docs/workstreams/sensor-perception-contracts-20261006.md`

## Excluded/shared paths
- No Android/device runtime, OS notification access, location provider, Gateway, storage, migrations, package manifests/lockfile, or PR #136-owned paths.
- No background polling or proactivity engine.

## Dependencies
- Device/platform owners provide registered Device ID and current permission AuthorityContext.
- Proactivity policy later decides whether an admitted sensor event may trigger action; this contract itself never triggers work.

## Current state
CLAIMED. Implement bounded notification, device-state and coarse/precise location descriptors with explicit permission-purpose checks, privacy-safe defaults, deterministic dedupe and canonical PerceptionEvent normalization.