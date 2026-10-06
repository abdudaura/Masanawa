# Device microphone/camera/screen perception contracts — Task 111

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/device-perception-contracts-20261006`
Base SHA: `2e8a2efcbc8ba925dade2824a6e5826be6097e43` (Task 110 exact head / PR #232)
Implementation commit: `e3b2da1ae99a4b17a2e4762f7d569e26b4c3f53b`
PR: #234

## Completed implementation
- Microphone, camera and screen-capture admission contracts normalize into Task 109 PerceptionEvent.
- All device captures require canonical Device ID plus `device-permission` evidence.
- Capture payloads use content references only; raw media is never embedded.
- Microphone duration/sample-rate/channel bounds are enforced.
- Camera dimensions/facing and screen dimensions/video duration/frame-rate coherence are enforced.
- Deterministic device/capture dedupe identity is preserved.
- Root contract tests cover valid captures, permission failures and malformed metadata.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/device-perception-contracts-20261006.md`
2. `packages/perception/src/device-capture-admission.ts`
3. `tests/contracts/device-perception-admission.test.ts`

No Device/Gateway/mobile/media/migration/package-manifest/lockfile paths changed.

## Verification
Foundation CI run `37454108371`, job `112237374358` ended `failure` with `steps = null`; checkout/install/tests never executed. Not a pass and not application-failure evidence.

## Remaining dependencies
- PR #232 / Task 110 and PR #228 / Task 109 integrate first.
- Device owners provide registered IDs/current permissions; media owners provide stored content refs.
- Workspace owner activates `packages/perception` when shared lockfile ownership clears.
- Physical device capture qualification remains with Device/APK owners.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
