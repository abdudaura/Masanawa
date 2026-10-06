# Home + Rooms — Lane G Group Rooms

Status: IMPLEMENTATION COMPLETE — shared integration only
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

## Completed implementation

- Added a fail-closed `GroupRoomProjection` with opaque room identity, title and description.
- Added explicit participant membership with unique participant IDs, server-owned opaque binding references and bounded roles: owner, moderator and member.
- Added participant kinds for human, canonical Character presentation and personal Twin presentation without creating a GroupRoom agent/runtime.
- Added message projection with explicit author attribution; a projected message is rejected unless its author is an explicit room member.
- Added HTTPS-only optional participant avatar references.
- Added a strict privacy contract that requires `memoryScope = group-room`, membership-required access and `privateRelationshipMemoryEligible = false`. This prevents the client contract from treating group content as private one-to-one Relationship memory.
- Added a bounded Group Room screen showing room identity, members, member roles, group-memory notice and recent attributed messages.
- Added typed callbacks for opening a participant and handing the room to the universal conversation renderer. No second composer/chat renderer was created.
- Added loading, unavailable, isolated error/retry, empty-conversation and stale-inline-warning presentation states.
- Added focused model tests covering mixed human/Character/Twin membership, non-member message injection, private-Relationship-memory rejection, wrong memory scope, duplicate membership and insecure avatar URLs.
- Added focused widget tests covering room identity, membership, attribution, privacy text, participant callback, universal-conversation handoff and retry state.

## Boundary / architecture result

Rooms remain presentations over canonical Skills/runtime. This lane adds no alternate identity authority, Relationship authority, memory store, Workflow engine, provider path, Commerce path or financial authority. Character/Twin `bindingRef` values are intentionally opaque presentation bindings and are not interpreted by Flutter as authorization.

## Verification

Changed-file audit against `docs/home-rooms-launch-20261006` is exactly five owned files:
- `apps/mobile/lib/src/rooms/group_rooms/group_room_models.dart`
- `apps/mobile/lib/src/rooms/group_rooms/group_room_screen.dart`
- `apps/mobile/test/rooms/group_rooms/group_room_models_test.dart`
- `apps/mobile/test/rooms/group_rooms/group_room_screen_test.dart`
- `docs/workstreams/home-rooms-group-20261006.md`

At implementation head `da4276044d55e5aa05c3f441182b8f8bff0255a8`, GitHub started:
- Foundation CI run `37445868092`
- Mobile Build run `37445868210`

Both runs terminated before checkout/execution: their only jobs expose `steps = null` and no logs. This matches the repository's known hosted-runner allocation failure and is not an application test result. This environment has no repository checkout/Flutter SDK, so no local Flutter pass is fabricated.

## Remaining shared-owner integration dependencies

Only work outside this lane remains:
1. PR #136/router owner wires Home/Room navigation and the `onOpenConversation` callback into the universal conversation renderer.
2. Canonical server owners expose the authenticated Group Room projection and enforce membership authorization/persistence.
3. Canonical Memory/runtime owners execute group-scoped memory rules; group messages must never silently enter private Relationship memory.
4. Shared transport maps canonical Character/Twin presentation references into the opaque `bindingRef` field.
5. Production/APK owner performs end-to-end device qualification after composition.

No further isolated Lane G implementation is required before those shared dependencies are available.

## PR / handoff

PR: #204 — `Implement Home/Rooms Lane G Group Rooms`
Implementation head before this handoff update: `da4276044d55e5aa05c3f441182b8f8bff0255a8`.
