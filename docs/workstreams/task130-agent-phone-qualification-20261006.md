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

## Acceptance intent

The qualifier must fail closed unless real physical-device evidence proves:
- outbound cellular call;
- inbound cellular call routing to the assigned Character;
- audible duplex media path;
- connectivity-loss/reconnect behavior;
- ambiguous call outcome reconciliation without blind retry;
- Device replacement/revocation with stale Device rejection.

Every scenario must bind exact Presence, Android Device, OmniSIP and cellular-routing Git heads, identify the physical device build, and carry SHA-256 evidence.

State: CLAIMED / IMPLEMENTATION IN PROGRESS.

Last update: 2026-10-06.
