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

Status: implementation started 2026-10-05.
