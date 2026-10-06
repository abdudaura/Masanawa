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

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed implementation

- audited OmniSIP's current Android SMS/USSD ports and authenticated local control API before defining the bridge;
- requires explicit dynamic SMS/USSD readiness evidence and explicit SIM1/SIM2 selection;
- SMS validates E.164 destination and bounded message content;
- USSD validates bounded star/hash code syntax;
- canonical Tenant/Device/Operation/idempotency identity remains attached to every dispatch;
- SMS accepted results preserve a stable provider reference;
- USSD accepted results preserve the request ID and require separate asynchronous status reconciliation;
- pending/success/failed USSD responses are exposed strictly as transport evidence, never accounting/balance/payment authority;
- dispatch exceptions become `outcome: unknown`, so callers cannot blindly redispatch;
- local-control authentication remains behind the injected edge and never appears in command/result values;
- focused tests cover acceptance, readiness/SIM gates, validation, async USSD reconciliation and ambiguous outcomes.

## Changed-file audit

PR #258 changes exactly the three owned paths above relative to PR #253. No Tasks 124-127 files, OmniSIP source, Gateway/mobile, Device/Security canonical state, migration, manifest, lockfile or production config changed.

## Verification

Foundation CI run `37457652953`, job `112249093806`, on implementation head `62f13c49aa33cc443844b258110a1cd30cc84990` failed before checkout with `runner_id=0` and `steps=[]`. No repository code executed.

## Remaining dependencies

1. Task 125 owner (#256): durable offline custody/replay before real SMS/USSD side effects.
2. Android integration owner: bind the injected edge to OmniSIP local control using keystore-protected control authentication and real permission/capability probes.
3. inbound SMS routing remains a later channel/Character integration concern.
4. canonical Operation/reconciliation owner must resolve `unknown` before retry.
5. physical SIM/network/permission qualification and executable CI remain required.

Implementation head before handoff: `f9a5bc86f39315394221e50db3be5a13d7fecc03`.

Last update: 2026-10-06.
