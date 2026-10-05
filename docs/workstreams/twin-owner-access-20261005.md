# Twin paid owner access workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-owner-access-20261005`
Base SHA: `65a801fbd96e53c803ab7d79a00b7ac6588c7e74`
Tasks: TWIN-050..058 plus reuse of TWIN-039 trial policy

## Scope

Implement Lane F without touching shared app/router/Gateway composition:
- owner availability / bounded duration and pricing contracts;
- request -> accept/decline/expire -> schedule -> active -> complete state machine;
- payment-hold/reservation port contract using canonical Commerce semantics;
- trial-aware owner-access quote contract using the platform paid-feature trial policy;
- completion/refund/reconciliation decisions;
- isolated Gateway route/service modules;
- mobile request/status models and Request Owner sheet;
- focused unit tests.

## Owned paths

- new `packages/commerce/src/owner-access*.ts`
- new `services/gateway/src/owner_access*.ts`
- new `apps/mobile/lib/src/owner_access/**`
- new `apps/mobile/lib/src/screens/chat/components/request_owner*.dart`
- this claim file

## Explicitly not owned

- existing Commerce model/repository/settlement files
- Commerce migrations / active billing/crypto paths
- `services/gateway/src/app.ts`, `main.ts`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- shared transport/provider files

## Trial rule

Owner access reuses the canonical paid-feature trial policy. Initial default is 7 days
from first qualifying use. Admin may change enablement, duration and optional usage cap.
No charge may settle while an admitted trial covers the qualifying owner-access session.

Status: isolated feature implementation complete; persistence/shared integration pending.

Implemented:
- bounded owner-access policy and per-owner offering contracts;
- text/voice/video modality support;
- owner-selected duration options and price-per-minute within platform bounds;
- trial-aware quote shape; canonical default remains 7 days;
- owner-access default trial cap clarified as one completed human session;
- deterministic lifecycle: requested -> accepted -> scheduled -> active -> completed -> settled;
- terminal decline/expiry/cancel/no-show/refund/dispute paths;
- canonical payment reservation port;
- paid requests reserve exact quoted amount;
- trial requests reserve zero;
- decline/expiry refunds exact reservation;
- settlement only after verified attendance/completion;
- opaque quote-id request flow so client cannot resubmit price/fees as financial truth;
- request expiry/refund support;
- notification port for requester/owner lifecycle events;
- attendance evidence contract requiring both participants plus verified duration;
- Gateway quote/request/action/read service and isolated route registrar;
- requester Request Owner sheet;
- owner accept/decline/schedule sheet;
- owner-request status card;
- mobile DTO/state/transport seams and parsing tests;
- owner-side offering settings UI (enable/disable, modalities, session lengths, price/minute);
- isolated owner offering read/update Gateway service and routes;
- platform-bound validation for owner-set pricing and durations;
- focused Commerce/Gateway tests.

Not yet integrated:
- append-only persistence/migrations and repository adapter;
- canonical quote store/policy adapter;
- canonical Commerce reservation/ledger adapter;
- worker timer scheduling for automatic expiry/no-show scans;
- actual session evidence adapter for text/voice/video;
- push/in-app notification adapter;
- Gateway app/main composition;
- authenticated mobile transport/provider;
- ai_chat and Activity wiring;
- persistence adapter for owner offering revisions;
- authenticated mobile transport wiring for owner offering settings.

CI:
GitHub Actions remains affected by the repository zero-step runner failure; no runner-based
compile/test success is claimed.

Security invariant:
the client submits only an opaque quoteId when creating the paid request. Price, owner
earning, platform fee, trial eligibility and reservation amount must be reloaded from
server-side canonical quote/policy truth.
