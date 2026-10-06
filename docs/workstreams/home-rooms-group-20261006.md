# Home + Rooms — Lane G Group Rooms

Status: ACTIVE
Owner/window: ChatGPT Group Rooms implementation window
Branch: `work/home-rooms-group-20261006`
Base: `docs/home-rooms-launch-20261006` @ `f3aea97a1cf74736c567950ca3091eef91806406`
Lane: G — Group Rooms
Last update: 2026-10-06

## Owned paths

- `apps/mobile/lib/src/rooms/group_rooms/**`
- `apps/mobile/test/rooms/group_rooms/**`
- `docs/workstreams/home-rooms-group-20261006.md`

## Explicitly excluded

- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- one-to-one Relationship semantics or persistence
- shared Commerce/Event migrations
- production environment/deployment/APK files
- paths claimed by Home, Internet Cafe, Story Radio, News, Work/Research, Billing, Teaching, or Admin windows

## Deliverables

- GroupRoom identity projection
- explicit membership and participant roles
- human/Character/Twin participation bindings as presentation references only
- message attribution projection
- privacy/memory-boundary metadata
- bounded basic group conversation projection/components
- loading/error/empty states
- focused model/widget tests

Rooms remain presentations over canonical runtime/Skills; this lane creates no GroupRoom agent/runtime, no alternate memory authority, and no financial authority.

## Shared integration dependencies

PR #136 remains owner of shared router, production transport/Gateway composition, universal chat entry, deep links and APK qualification. Group membership persistence/authorization and canonical group-scoped memory execution must be composed by their canonical owners. This lane will expose typed seams only.

## Current step

Ownership claim published before implementation. Inspecting current mobile conventions, then implementing only the owned paths.

## Verification / handoff

Pending.
