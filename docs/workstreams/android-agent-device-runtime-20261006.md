# Minimal Android Agent Device runtime workstream

Owner/window: current ChatGPT continuation window — Task 124
Branch: `work/android-agent-device-runtime-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 124.
Architecture reference: `docs/AGENT-PHONE-EMBODIMENT.md`.
PR: #253
Implementation commit: `de1b7555747fbbcca05006a077079fefb1d60891`

## Exact owned paths

- `adapters/devices/android/src/runtime.ts`
- `tests/contracts/android-agent-device-runtime.test.ts`
- `docs/workstreams/android-agent-device-runtime-20261006.md`

## Excluded/shared paths

- Tasks 104–107 Device registration/capability/assignment/credential canonical files;
- Task 125 DeviceOperation custody/offline queue/receipt replay;
- OmniSIP/telephony (Tasks 126–128);
- app/browser/notification automation (Task 129);
- Gateway/Worker/Ops/Presence and PR #136;
- migrations, package manifests, lockfile and production environment;
- consumer Flutter app;
- Character/Memory/World/Workflow/Commerce truth.

## Completed isolated runtime foundation

- adapter-local Device + boot/runtime generation state only;
- dynamic capability probe cycles with exact generation fencing;
- explicit `ready | degraded | unavailable` capability evidence aligned to Task 105 semantics;
- runtime health projection for later canonical capability/health publication;
- SDK/app/ABI/root metadata never grants or infers capabilities;
- duplicate keys, future observations and malformed ready/degraded evidence fail closed;
- stale probe callbacks cannot overwrite current runtime truth;
- terminal local disable clears capability readiness and blocks future probes;
- ordinary stop is idempotent and does not create a new Device/Character identity;
- runtime snapshot carries no Character, Relationship, Memory or Workflow truth.

## Changed-file audit

Compare against current `main` reports this branch 3 commits ahead, 0 behind, with exactly:
1. `adapters/devices/android/src/runtime.ts`
2. `docs/workstreams/android-agent-device-runtime-20261006.md`
3. `tests/contracts/android-agent-device-runtime.test.ts`

No shared or foreign-owner files changed.

## Verification

Foundation CI run `37456248820` completed as `failure`, but its only job `112244477005` has `steps = null`. Checkout/install/typecheck/tests never executed. This is runner-allocation/non-execution evidence, not an application failure and not a test pass.

No executable local checkout is available in this connector-only window, so no fabricated local or Android build result is claimed.

## Remaining Task 124 dependencies

- create the actual Android packaging/background Device Node service and boot lifecycle;
- integrate Android keystore/private operational credential signer from Task 107;
- wire concrete capability probes to platform APIs/Android services;
- publish adapter snapshots through the canonical Task 105 DeviceCapability/health owner;
- add watchdog/connectivity service behavior and persistent local configuration;
- build/install on a physical Android device and verify background/restart behavior.

## Current state

**ISOLATED RUNTIME FOUNDATION COMPLETE / TASK 124 PRODUCTION COMPLETION REQUIRES ANDROID PACKAGING + PHYSICAL DEVICE WORK.**

No further implementation remains in this claimed three-file contract slice.
