# Home/Rooms Lane A — Admin publishing

Status: CLAIMED — 2026-10-06
Branch: `work/home-rooms-admin-publishing-20261006`
Base: `work/mobile-admin-app-20261005` (admin control-plane PR #129)

## Ownership

This window owns only new isolated publishing paths:
- `apps/admin_mobile/lib/src/home_rooms_publishing/**`
- `apps/admin_mobile/test/home_rooms_publishing/**`
- `docs/workstreams/home-rooms-admin-publishing-20261006.md`

## Deliverables

- Story Radio series/season/episode publishing projections and typed authorized-command intents.
- News category/pinning/visibility publishing projections and command intents.
- Home Room visibility/order projections and command intents.
- Platform-assistant Home presentation projection and command intents.
- Responsive admin publishing UI with loading/error/empty states.
- Focused parsing/authority/widget tests.

## Authority boundary

This module never writes databases directly and never fabricates publication truth. It emits typed mutation intents that must be executed by the canonical authorized Ops/Gateway command owner. Existing Story Radio/News/Home domain owners remain source of truth.

## Explicit exclusions

No edits to:
- PR #136 Gateway/customer mobile/router/chat/transport/APK paths;
- PR #129 existing shared admin shell/API/Ops files;
- active Story Radio/News/Home files;
- production environment;
- Commerce/Event migrations.