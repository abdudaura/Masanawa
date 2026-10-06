# OmniSIP SMS/USSD Device capabilities workstream

Owner/window: current ChatGPT continuation window — Task 128
Branch: `work/omnisip-sms-ussd-capabilities-20261006`
Base SHA: `481249d162405f5725ea3e54e395cb547afae273` (Task 125 PR #256 exact handoff head)
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 128.
Architecture reference: `docs/AGENT-PHONE-EMBODIMENT.md`.
OmniSIP source evidence: `Baatiku/OmniSIP` commit `ff4084d7742a2008122549f19aee882f99906048`.
PR: #259
Implementation head before this handoff update: `30529ffce82a4fbf0dc07f476a0804102d06207d`

## Exact owned paths

- `adapters/devices/android/src/omnisip-messaging.ts`
- `tests/contracts/omnisip-messaging-capabilities.test.ts`
- `docs/workstreams/omnisip-sms-ussd-capabilities-20261006.md`

## Excluded/shared paths

- Task 124 runtime and Task 125 queue source;
- Task 126 OmniSIP voice provider branch/files;
- Task 127 call routing;
- canonical Device/Tool/Operation/Provider registries;
- OmniSIP repository source;
- incoming SMS channel/Gateway routing;
- Android manifests/permissions/package files;
- migrations, manifests, lockfile, production environment and PR #136.

## Completed isolated capability boundary

- adds a Task-125-compatible Android executor for exactly `sms.send` and `ussd.execute`;
- consumes only injected runtime-qualified permission/SIM readiness; Android version/root/app metadata grants nothing;
- requires explicit SIM1/SIM2 selection with no silent fallback to another subscription;
- validates E.164 SMS destinations while preserving the bounded SMS body exactly;
- normalizes bounded USSD codes and rejects malformed request payloads before effect;
- permission, requested-SIM and payload denial returns `failed-before-effect` without calling OmniSIP;
- accepted SMS local request IDs remain `unknown` with `omnisip.sms-status-pending` until send/delivery callback truth arrives;
- accepted USSD request IDs remain `unknown` with `omnisip.ussd-response-pending` until callback truth arrives;
- null/thrown SMS dispatch and thrown USSD/status edges remain `unknown` rather than pretending success or authorizing blind retry;
- evidence binds canonical OperationId + capability + OmniSIP request id but omits SMS body/content;
- incoming SMS is explicitly outside this lane and is not auto-promoted to Character Memory.

## Changed-file audit

Compare against Task 125 exact handoff head reports:
- 4 commits ahead;
- 0 commits behind;
- exactly these three owned files:
  1. `adapters/devices/android/src/omnisip-messaging.ts`
  2. `docs/workstreams/omnisip-sms-ussd-capabilities-20261006.md`
  3. `tests/contracts/omnisip-messaging-capabilities.test.ts`

No Task 124/125, Task 126/127, canonical Device/Operation or protected shared file changed.

## Verification

Foundation CI run `37457683606` on implementation head `30529ffce82a4fbf0dc07f476a0804102d06207d` completed as `failure`, but its only job `112249199344` has `steps = null`. Checkout/install/typecheck/tests never executed. This is runner-allocation/non-execution evidence, not an application failure and not a test pass.

No executable local checkout or Android device is available in this connector-only window, so no fabricated local/physical test result is claimed.

## Remaining Task 128 dependencies

- wire concrete Android/OmniSIP MessagingPort and UssdPort bridges into the Masanawa Device runtime;
- publish actual SMS/USSD readiness through Task 105 DeviceCapability health;
- settle SMS sent/delivered/failure callbacks and USSD callbacks into canonical Operation reconciliation/receipts;
- define authorized incoming-SMS channel routing separately rather than treating messages as Memory;
- qualify SEND_SMS/RECEIVE_SMS/CALL_PHONE/read-subscription behavior on the exact Android build/SIM hardware;
- physical-device retry/restart/connectivity testing remains required.

## Current state

**ISOLATED CAPABILITY BOUNDARY COMPLETE / TASK 128 PRODUCTION COMPLETION REQUIRES ANDROID BRIDGE + CALLBACK RECONCILIATION + PHYSICAL DEVICE WORK.**

No further isolated implementation remains in this claimed three-file slice.
