# Home/Rooms Lane N — News

Owner/window: ChatGPT Lane N implementation window
Branch: `work/home-rooms-news-20261006`
Base: `docs/home-rooms-launch-20261006` @ `f3aea97a1cf74736c567950ca3091eef91806406`
Task references: `docs/HOME-ROOMS-LAUNCH.md`, `docs/HOME-ROOMS-MULTI-WINDOW.md` Lane N
Last update: 2026-10-06

## Ownership

Exact owned paths for this lane:
- `packages/news/**` (new isolated projection/contracts package only; no acquisition/runtime authority)
- `apps/mobile/lib/src/rooms/news/**` (new isolated News Room models/components)
- `apps/mobile/test/news_room_test.dart`
- `docs/workstreams/home-rooms-news.md`

Explicitly not owned:
- Gateway composition/router/main
- mobile app router/chat/transport
- Commerce/Event migrations
- production environment/configuration
- Story Radio, Home shell, Teaching, billing, admin control-plane paths

## Scope

Implement admin-configurable News Room projection contracts for categories/pinning/visibility,
source-aware news items, article/detail projection, evidence/source references, optional audio
presentation references, and isolated Flutter components. This lane does not fetch news, execute
research, publish admin mutations, or grant runtime authority; those remain shared integration/
authorized tooling concerns.

## Dependencies

- #136 must compose transport/router/deep-link integration.
- Admin publishing lane/PR #129 may later provide authorized category/pinning/visibility commands.
- Evidence-capable admitted source tooling must supply current facts; unsourced generated breaking
  news is rejected by contract.

## Status

Claim: ACTIVE
Implementation: in progress
Verification: pending
Deployment: not owned
