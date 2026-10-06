# Home + Rooms — Lane G Group Rooms

Status: IMPLEMENTATION COMPLETE — shared integration only
Owner/window: ChatGPT Group Rooms implementation window
Branch: `work/home-rooms-group-reconciled-20261006`
Base: `docs/home-rooms-launch-20261006` @ `f76a45cd9ca4858860ac8468f863623c9fa563ed`
Lane: G — Group Rooms
Last update: 2026-10-06

## Owned paths

- `apps/mobile/lib/src/rooms/group_rooms/**`
- `apps/mobile/test/rooms/group_rooms/**`
- `docs/workstreams/home-rooms-group-20261006.md`
- `packages/identity/src/group-room.ts`
- `packages/identity/src/group-room.test.ts`

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

## Backend continuation completed

Ownership was expanded after confirming no competing Group Room backend claim. The continuation is limited to additive Identity files; existing Relationship files and package exports remain untouched.

Completed backend contract:
- server-owned Group Room identity with Tenant scope, bounded room metadata and revision;
- explicit 2..128-member membership with exactly one owner;
- human participants bind exactly one canonical User;
- Character participants bind exactly one canonical Character;
- Twin participants bind canonical owner User + Character together;
- revision-bound membership replacement rejects stale writers and invalid owner states;
- group privacy is hard-coded to `memoryScope=group-room`, membership-required, and `privateRelationshipMemoryEligible=false`;
- member-only message admission with explicit author attribution;
- tenant + room scoped request replay identity, exact replay idempotency and changed-payload rejection;
- duplicate message identity rejection;
- bounded message history reads;
- in-memory reference repository and focused regression coverage for privacy, bindings, ownership, tenant isolation, replay and membership revision races.

The new Identity contract is intentionally not appended to `packages/identity/src/index.ts` because that shared export file is currently changed by another active PR. The integration owner must export it when reconciling branches rather than this lane overwriting that work.

## Remaining shared-owner integration dependencies

Only work outside this lane remains:
1. PR #136/router owner wires Home/Room navigation and the `onOpenConversation` callback into the universal conversation renderer.
2. Shared Identity integration appends the new Group Room contract to the public package export and provides PostgreSQL persistence/migration; the export seam is intentionally left untouched because another active PR owns it.
3. Canonical server composition authenticates Group Room reads/writes and maps them into the projection; this remains #136/shared Gateway work.
4. Canonical Memory/runtime owners execute group-scoped memory rules; group messages must never silently enter private Relationship memory.
5. Shared transport maps canonical Character/Twin presentation references into the opaque `bindingRef` field.
6. Production/APK owner performs end-to-end device qualification after composition.

No additional isolated Lane G work remains without touching currently shared/claimed exports, PostgreSQL migration registration, Gateway composition or APK ownership.

## PR / handoff

PR: #214 — `Reconcile Home/Rooms Lane G Group Rooms`; supersedes conflicted #204
Implementation head before this handoff update: `da4276044d55e5aa05c3f441182b8f8bff0255a8`.


## Backend verification update

Backend continuation heads:
- initial server contract/tests: `c6c4c42371cdf6b94b13580b4a54de1bb5c3da31`
- revision-bound membership: `43905d1a1da9d241c3e14f6f2d84eedf97ec8fc7`
- canonical binding validation: `fa41db1be1360406d926f5260e538492d704e76d`

Foundation CI run `37447009024` and Mobile Build run `37447009017` again terminated before checkout with `steps = null` and no logs. No application pass/failure is inferred from those runs.

Current diff against the Home/Rooms docs base is exactly seven claimed files: the original five mobile/handoff files plus `packages/identity/src/group-room.ts` and `packages/identity/src/group-room.test.ts`.
