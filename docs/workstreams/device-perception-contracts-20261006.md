# Device microphone/camera/screen perception contracts — Task 111

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/device-perception-contracts-20261006`
Base SHA: `2e8a2efcbc8ba925dade2824a6e5826be6097e43` (Task 110 exact head / PR #232)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **111** Implement device microphone/camera/screen perception contracts.
- Depends on Task 109 canonical PerceptionEvent and Task 110 admission stack.

## Owned paths
- `packages/perception/src/device-capture-admission.ts` (new)
- `tests/contracts/device-perception-admission.test.ts` (new)
- `docs/workstreams/device-perception-contracts-20261006.md`

## Excluded/shared paths
- No edits to `packages/devices`, Android/mobile runtime, device credentials, Gateway, media storage/decoders, migrations, package manifests/lockfile, or PR #136-owned paths.
- No device registration/capability/runtime implementation in this lane.

## Dependencies
- Device owner supplies a registered canonical Device ID and current device-permission AuthorityContext.
- Media owner supplies canonical content references after capture/storage admission.
- Task 109 remains the only canonical PerceptionEvent normalizer.

## Current state
CLAIMED. Implement bounded microphone, camera and screen-capture descriptors that require device source + device-permission evidence, validate media-specific metadata, forbid inline raw capture bytes, preserve privacy scope and normalize to canonical PerceptionEvent.