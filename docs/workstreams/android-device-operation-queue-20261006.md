# Android DeviceOperation custody/offline queue workstream

Owner/window: current ChatGPT continuation window — Task 125
Branch: `work/android-device-operation-queue-20261006`
Base SHA: `64659f854671b97e59c4e9915e9f23cd3463342f` (Task 124 PR #253 head)
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 125.
Architecture reference: `docs/AGENT-PHONE-EMBODIMENT.md`.

## Exact owned paths

- `adapters/devices/android/src/operation-queue.ts` (new)
- `tests/recovery/android-device-operation-queue.test.ts` (new)
- `docs/workstreams/android-device-operation-queue-20261006.md`

## Excluded/shared paths

- Task 124 runtime file;
- canonical Tool/Operation/Provider repositories and state;
- Device registration/capability/assignment/credential files;
- concrete cryptographic signing/verifier implementation;
- OmniSIP/telephony and automation;
- Gateway/Worker/Ops composition;
- migrations, manifests, lockfile, production environment and PR #136.

## Implementation boundary

- accept only pre-authorized signed DeviceOperation envelopes through an injected verifier;
- exact DeviceId/capability/idempotency/deadline binding;
- durable-store port for adapter-local queued operation + receipt custody;
- claim once for execution; exact replay returns existing terminal receipt;
- uncertain/ambiguous outcomes are never blindly retried;
- offline receipt upload remains pending until acknowledged;
- duplicate delivery with changed payload fails closed;
- no local queue becomes canonical Operation truth.

## Current state

CLAIMED. Implement deterministic local custody/replay/recovery semantics behind an injected persistent store and signature verifier.
