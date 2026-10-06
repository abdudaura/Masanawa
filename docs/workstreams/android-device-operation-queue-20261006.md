# Android DeviceOperation custody/offline queue workstream

Owner/window: current ChatGPT continuation window — Task 125
Branch: `work/android-device-operation-queue-20261006`
Base SHA: `d9ef72c7712735698c849db0f7fb28c7fae51015` (Task 124 PR #253 exact head)
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 125.
Architecture reference: `docs/AGENT-PHONE-EMBODIMENT.md`.
PR: #256
Implementation head before this handoff update: `7bb711ac7f75ea9fb821d8670777ec1e1bea5581`

## Exact owned paths

- `adapters/devices/android/src/operation-queue.ts`
- `tests/recovery/android-device-operation-queue.test.ts`
- `docs/workstreams/android-device-operation-queue-20261006.md`

## Excluded/shared paths

- Task 124 runtime file;
- canonical Tool/Operation/Provider repositories and state;
- Device registration/capability/assignment/credential files;
- concrete cryptographic signing/verifier implementation;
- OmniSIP/telephony and automation;
- Gateway/Worker/Ops composition;
- migrations, manifests, lockfile, production environment and PR #136.

## Completed isolated core

- validates signed DeviceOperation envelopes with exact Tenant, Operation, AuthorityContext, Device, capability, idempotency, payload hash, issuance and deadline binding;
- accepts custody only after an injected signature verifier approves the canonical signing payload;
- exposes a persistent-store port for adapter-local operation/receipt custody without becoming canonical Operation truth;
- claims queued work once for execution and returns existing terminal/unknown records on replay;
- rejects exact-Operation replay when the signed payload changes;
- preserves local idempotency-key ownership as a persistence invariant;
- converts a pre-existing `executing` record after restart into terminal local `unknown` evidence instead of redispatching;
- converts thrown/ambiguous executor outcomes into `unknown` and never blindly retries consequential work;
- represents failure-before-effect as terminal `failed`, replay-safe;
- expires queued work before dispatch when its signed deadline passes;
- keeps receipts pending while offline and across queue recreation until explicit acknowledgement;
- recovery tests reuse one durable test store across queue recreation to prove replay/restart behavior.

## Stack reconciliation / changed-file audit

Task 124 received a UUIDv7 fixture correction after Task 125 originally branched. #256 was rebuilt with force-with-lease on the corrected Task 124 exact head so no foreign Task 124 file remains in its final diff.

Compare against `work/android-agent-device-runtime-20261006` now reports:
- 3 commits ahead;
- 0 commits behind;
- exactly these three owned files:
  1. `adapters/devices/android/src/operation-queue.ts`
  2. `docs/workstreams/android-device-operation-queue-20261006.md`
  3. `tests/recovery/android-device-operation-queue.test.ts`

## Verification

Foundation CI run `37457195159` on head `7bb711ac7f75ea9fb821d8670777ec1e1bea5581` completed as `failure`, but its only job `112247582063` has `steps = null`. Checkout/install/typecheck/tests never executed. This is runner-allocation/non-execution evidence, not an application failure and not a test pass.

The preceding pre-rebase CI run `37456779188` likewise had `steps = null`; it is superseded by the exact-head run above.

No executable local checkout is available in this connector-only window, so no fabricated local/Android test result is claimed.

## Remaining Task 125 dependencies

- implement the concrete Android persistent store with atomic Operation/idempotency ownership and receipt persistence;
- bind the injected verifier to the Task 107 device-keystore/credential proof path without exposing private key material;
- implement authenticated receipt upload/acknowledgement to canonical Operation reconciliation;
- map concrete Android capability executors into the queue without bypassing Task 105/106 capability/assignment checks;
- physical-device restart/connectivity-loss qualification must prove the same operation cannot execute twice;
- canonical Gateway/Worker/Tool Operation composition remains with its existing owners.

## Current state

**ISOLATED DETERMINISTIC CORE COMPLETE / TASK 125 PRODUCTION COMPLETION REQUIRES ANDROID PERSISTENCE + CONTROL-PLANE + PHYSICAL DEVICE WORK.**

No further isolated implementation remains in this claimed three-file core slice.
