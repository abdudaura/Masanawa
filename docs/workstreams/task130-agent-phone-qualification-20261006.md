# Task 130 Agent Phone real-device qualification

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/task130-agent-phone-qualification-20261006`
Base SHA: `8648c5f524108d825fa52e3a7f735675dd8b78f7`
Production task: 130 — pass real-device, connectivity-loss, call ambiguity and device-replacement acceptance suite.

## Scope

This lane implements an isolated evidence qualifier for Task 130. It does not perform physical handset tests or edit Presence, Device, Android, OmniSIP, telephony routing, Gateway/mobile, manifests, migrations or production configuration.

## Exact owned paths

- `docs/workstreams/task130-agent-phone-qualification-20261006.md`
- `scripts/task130-agent-phone-qualification.mjs`
- `scripts/task130-agent-phone-qualification.test.mjs`

## Excluded/shared paths

- Task 119/120 Presence implementation;
- Task 124/125 Android runtime/DeviceOperation queue;
- Task 126 OmniSIP telephony provider;
- Task 127 cellular routing;
- Task 128 SMS/USSD and Task 129 automation;
- PR #136 Gateway/mobile/APK/production ownership;
- OmniSIP repository source, Android manifests, credentials and physical-device state.

## Active upstream evidence owners

- PresenceSession bridge: PR #248;
- LiveKit transport: PR #254;
- Android Agent Device runtime: PR #253;
- signed DeviceOperation queue: PR #256;
- OmniSIP telephony Device Provider: PR #257;
- cellular Character routing: PR #255;
- SMS/USSD: PR #259;
- approved Android automation planning: PR #260.

## Completed implementation

The qualifier requires physical-device evidence for six Task 130 scenario families:
- outbound cellular calling;
- inbound cellular routing to the assigned Character;
- audible duplex media;
- connectivity-loss/reconnect;
- ambiguous call reconciliation without blind retry;
- Device replacement/revocation with stale Device rejection.

For every scenario it:
- binds exact Presence, Android Device, OmniSIP and cellular-routing Git heads;
- requires a physical-device environment rather than simulated/unit evidence;
- records candidate build, device model and device build identity;
- requires functional pass;
- independently requires real-device pass;
- independently requires no-blind-retry safety;
- requires SHA-256 evidence;
- rejects duplicate/unknown scenarios and source-head substitutions;
- fails while blocking device issues remain.

The result is only `READY`, `INCOMPLETE` or `FAILED`; missing handset evidence cannot silently pass. A CLI exits non-zero unless qualification is `READY`.

Focused tests cover:
- complete READY physical-device evidence;
- missing scenario classification;
- Presence/Device/OmniSIP/routing head substitution;
- independent real-device and blind-retry safety failures;
- functional failure plus blocking device issues;
- duplicate, malformed and non-physical evidence rejection.

## Verification

- comparison against `main` at implementation head: ahead 3 / behind 0;
- changed-file audit is exactly the three owned paths above;
- PR #304 opened on implementation head `93ef64ee86e862a7aecf0885d10f27db387dc8d2`;
- Foundation CI run `37491340463`, job `112364561425`, concluded `failure` with `steps = null`; checkout/install/typecheck/tests never executed, so no application failure or success is inferred.

## Handoff

- implementation head before this documentation update: `93ef64ee86e862a7aecf0885d10f27db387dc8d2`;
- PR: #304 — Add Task 130 Agent Phone physical-device qualification gate;
- isolated implementation status: COMPLETE;
- Production Task 130 status: NOT COMPLETE.

## Remaining dependencies

Task 130 becomes READY only after the active Tasks 119–129 owners are reconciled and a real Android handset supplies exact-head evidence. Required external evidence includes real inbound/outbound call execution, audible duplex media, connectivity-loss recovery, ambiguous-call reconciliation and Device replacement/revocation on the release build.

State: ISOLATED COMPLETE / WAITING ON TASKS 119–129 + PHYSICAL-DEVICE EVIDENCE.

Last update: 2026-10-06.
