# Minimal Android Agent Device runtime workstream

Owner/window: current ChatGPT continuation window — Task 124
Branch: `work/android-agent-device-runtime-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 124.
Architecture reference: `docs/AGENT-PHONE-EMBODIMENT.md`.

## Exact owned paths

- `adapters/devices/android/src/runtime.ts` (new)
- `tests/contracts/android-agent-device-runtime.test.ts` (new)
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

## Implementation boundary

- adapter-local Android runtime identity is Device + boot/runtime generation only;
- dynamic capability probe registry; no capability inferred from app version/root/platform metadata;
- readiness/health snapshot suitable for later canonical DeviceCapability publication;
- stale probe generations cannot overwrite current runtime truth;
- degraded/unavailable probes are explicit;
- terminal local disable blocks future readiness;
- no raw platform master secrets or Character identity stored in this runtime contract.

## Current state

CLAIMED. Implement the minimal adapter runtime contract and tests; Android packaging/boot service and physical-device qualification remain follow-on work.
