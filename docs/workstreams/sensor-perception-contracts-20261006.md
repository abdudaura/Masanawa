# Notification/device-state/location perception contracts — Task 112

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/sensor-perception-contracts-20261006`
Base SHA: `a5771c1db7e297fa43c9be75231b3d544818bcf0` (Task 111 exact head / PR #234)
Implementation head: `480107dfb63f2ee178b466d21d17759bc7e6870a`
PR: #237

## Completed implementation
- Added notification, device-state and location sensor admission into canonical Task 109 PerceptionEvent.
- All sensor events require registered Device identity and `device-permission` evidence.
- Notification, device-state and location each require an explicit matching permission purpose.
- Notification text is bounded and normalized without granting trigger authority.
- Device state validates battery, charging and network state at runtime.
- Coarse location is privacy-reduced by coordinate rounding before projection.
- Precise location is bounded to private/Relationship scope and never silently promoted to memory.
- Deterministic device/upstream-event dedupe identity is preserved.
- Root contract tests cover valid inputs, permission-purpose failures, coarse-location privacy and device-state validation.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/sensor-perception-contracts-20261006.md`
2. `packages/perception/src/sensor-admission.ts`
3. `tests/contracts/sensor-perception-admission.test.ts`

No Android/device runtime, Gateway, storage, migrations, package manifests/lockfile or production paths changed.

## Verification
Foundation CI run `37454318581`, job `112238071224` ended `failure` with `steps = null`; checkout/install/typecheck/tests never executed. Not a pass and not application-failure evidence.

## Remaining dependencies
- PR #234/#232/#228 perception stack integrates first.
- Device/platform owners supply OS permissions, capture/access and registered Device IDs.
- Task 113+ proactivity owners may consume admitted sensor events only through separate permission/frequency/privacy policy; this module never triggers work.
- Workspace owner activates `packages/perception` when lockfile ownership clears.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
