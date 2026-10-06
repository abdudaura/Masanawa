# OmniSIP SMS/USSD Device capabilities — Task 128

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/omnisip-sms-ussd-20261006`
Base: Task 124 PR #253 @ `d9ef72c7712735698c849db0f7fb28c7fae51015`
Production task: 128 — SMS/USSD Device capabilities.

## Coordination

Task 124 is PR #253, Task 125 is PR #256, Task 126 is PR #257, and Task 127 is PR #255. No competing Task 128 SMS/USSD implementation claim existed at selection. This lane uses separate new files and does not modify those owners.

Current `Baatiku/OmniSIP` main exposes authenticated local-control endpoints for SMS and USSD:
- `POST /sms`
- `POST /ussd`
- `GET /ussd/{requestId}`

## Exact owned paths

- `docs/workstreams/omnisip-sms-ussd-20261006.md`
- `adapters/devices/android/src/omnisip-messaging.ts`
- `tests/contracts/omnisip-sms-ussd.test.ts`

## Explicitly excluded/shared paths

- Tasks 124–127 files and claims
- OmniSIP repository source
- Gateway/Worker/Ops/Presence and PR #136
- Device/Security canonical state and migrations
- provider/package exports, manifests, lockfile and production config
- Android permissions/packaging/keystore
- inbound SMS → Character/channel routing
- any financial interpretation of SMS/USSD responses

## Acceptance target

- explicit dynamic SMS/USSD readiness evidence; never infer from Android/app version;
- explicit SIM1/SIM2 selection only;
- SMS destination validated as E.164 and body bounded;
- USSD code bounded and structurally validated;
- canonical OperationId/idempotency stays attached to dispatch;
- SMS explicit acceptance yields a stable provider reference;
- USSD request acceptance yields a stable request ID and requires status polling/reconciliation;
- provider/network exception after dispatch becomes `unknown` and cannot authorize blind redispatch;
- USSD response text is transport evidence only, never billing/accounting truth;
- control token remains behind the injected local-control edge and never enters command/result values.

State: IMPLEMENTING. OmniSIP SMS/USSD command validation, explicit-SIM readiness admission, asynchronous USSD reconciliation, ambiguity handling and focused contract tests are committed. Inbound routing, Android permission wiring, durable reconciliation and shared production composition remain excluded.

Implementation head before handoff: `f9a5bc86f39315394221e50db3be5a13d7fecc03`.

Last update: 2026-10-06.
