# OmniSIP Android telephony Device Provider — Task 126

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/omnisip-device-provider-20261006`
Base: Task 124 PR #253 @ `d9ef72c7712735698c849db0f7fb28c7fae51015`
Production task: 126 — integrate OmniSIP as Android telephony Device Provider.

## Coordination and source audit

No competing Task 126 implementation claim existed at selection. Task 124 is owned by PR #253; Task 125 is now owned by PR #256. This lane is stacked on Task 124 and does not modify either owner's files.

The current `Baatiku/OmniSIP` main head was inspected before implementation. Its canonical production architecture keeps call ownership in `GatewayCoordinator`, accepts outbound cellular calls from the SIP/IP side, and deliberately omits a raw GSM-dial endpoint from the authenticated local control API. This bridge must therefore never bypass OmniSIP call ownership by dialing Android Telecom directly.

## Exact owned paths

- `docs/workstreams/omnisip-device-provider-20261006.md`
- `adapters/devices/android/src/omnisip-telephony.ts`
- `tests/contracts/omnisip-device-provider.test.ts`

## Explicitly excluded/shared paths

- Task 124 `runtime.ts` and its tests/docs
- Task 125 DeviceOperation queue/custody files
- Tasks 104–107 canonical Device/Security state
- OmniSIP repository source code
- inbound call → Character routing (Task 127)
- SMS/USSD (Task 128)
- app/browser/notification automation (Task 129)
- Gateway/Worker/Presence/Ops and PR #136
- provider registry/package exports, manifests, lockfile and production configuration
- migrations and durable Operation/receipt stores

## Acceptance target

- project OmniSIP's qualified runtime status into canonical Provider readiness/capabilities without inventing hardware support;
- voice placement requires SIP registration, qualified audio capture+injection, healthy new-call admission, available voice-capable requested SIM and capacity;
- explicit SIM routing only;
- outbound voice enters OmniSIP through its IP/SIP-controlled call edge, never a raw Telecom dial bypass;
- canonical OperationId/idempotency remain attached to every dispatch attempt;
- explicit rejection is safe terminal evidence;
- dispatch exceptions/ambiguous edge outcomes become `unknown` and are never blindly retried;
- exact replay is a storage/composition responsibility; adapter exposes stable dispatch identity/evidence without owning another Operation state machine.

State: IMPLEMENTING. OmniSIP provider readiness projection, explicit-SIM outbound SIP-edge dispatch, ambiguity handling and focused contract tests are committed. Inbound Character routing, SMS/USSD, durable Operation reconciliation and physical-device qualification remain excluded.

Implementation head before handoff: `8edea2851e3d389fd233cf30be7ef4628b82d6d1`.

Last update: 2026-10-06.
