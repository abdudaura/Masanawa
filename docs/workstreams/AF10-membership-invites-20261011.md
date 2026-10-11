# ROOMS membership and invites

Owner: Codex ROOMS / rooms-membership-invites-20261011-cloud.
Claim UTC: 2026-10-11T20:20:51.819Z
Branch: lane/rooms-membership-invites-20261011
Base: 172b5bf9a8a1b94a475b5a053d42795e396182b3 (#655, preserving #625).
Fresh main inspected: a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d; PR #668 retirement respected.

Exact owned paths:
- adapters/storage/postgres/src/rooms/membership.ts
- adapters/storage/postgres/src/rooms/membership.test.mjs
- adapters/storage/postgres/src/rooms/membership_schema.sql
- services/gateway/src/modules/rooms/membership_routes.ts
- services/gateway/src/modules/rooms/membership_routes.test.mjs
- apps/mobile/lib/src/features/rooms/room_membership_client.dart
- apps/mobile/lib/src/features/rooms/room_membership_screen.dart
- docs/workstreams/AF10-membership-invites-20261011.md

Milestone: persisted moderator roles, member moderation, hashed revocable single-use invites, authenticated feature routes and account-fenced Flutter controls. Extend canonical rooms.memberships; no second Rooms subsystem. Staff role assignment, no human-to-human consumer chat/call APIs.

State: IN_PROGRESS / PARTIAL_IMPLEMENTATION; tests NOT_RUN; production NOT_VERIFIED.
Next: implement against existing RoomError, lookupRoom, requirePublishedEligible and requireMember; test authorization, bans, token expiry/replay and rollback.

AF00 narrow handoff: mount registerRoomMembershipRoutes with canonical verified actor/pool/default-off flag; allocate membership_schema.sql after Rooms 0001–0004; connect owned membership screen to Rooms detail with authenticated account-scoped Dio. No protected composition, registry, manifest, lockfile or call paths owned here.
