# ROOMS membership / roles / invites handoff

Owner/window: Codex ROOMS, claim rooms-membership-invites-20261011-cloud.
Claim UTC: 2026-10-11T20:20:51.819Z
Branch: lane/rooms-membership-invites-20261011
PR: https://github.com/weavewellindustrieslimited/masanawa/pull/669 (draft; coordinating window integrates).
Base: 172b5bf9a8a1b94a475b5a053d42795e396182b3 — #655, stacked on preserved #625.
Tested source HEAD: 0e92f4962aeb22f83548b883126133eba9a9e5f8 (final handoff-only commit follows; read branch ref for delivery HEAD).
Fresh main inspected: a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d; #668 retirement respected.
Integration SHA: NONE. Production: NOT_VERIFIED. Parent milestone: PARTIAL_IMPLEMENTATION.

## Exact changed paths

- adapters/storage/postgres/src/rooms/membership.ts
- adapters/storage/postgres/src/rooms/membership.test.mjs
- adapters/storage/postgres/src/rooms/membership_schema.sql
- services/gateway/src/modules/rooms/membership_routes.ts
- services/gateway/src/modules/rooms/membership_routes.test.mjs
- apps/mobile/lib/src/features/rooms/room_membership_client.dart
- apps/mobile/lib/src/features/rooms/room_membership_screen.dart
- docs/workstreams/AF10-membership-invites-20261011.md
- apps/mobile/test/features/rooms/room_membership_client_test.dart
- apps/mobile/test/features/rooms/room_membership_screen_test.dart

All ten are new additive files. No shared router/shell, localization catalog, Gateway app/main, migration registry, manifests, lockfiles, financial authority or forbidden Calls paths edited. Existing #625/#655 source is ancestry, not rewritten. Do not blindly merge this old ancestry onto main: reconcile the canonical Rooms prerequisites with current main first, or port these ten exact files after prerequisites.

## Implemented source

- Canonical rooms.memberships gains member/moderator role. Verified platform room staff assigns roles only to active memberships. No consumer owner role, human contacts/chat/call API or alternate Rooms authority.
- Server-side member management: moderator membership and paid entitlement rechecked; moderators cannot grant roles or ban peers. Self-moderation denied. Bans demote to member. Unban becomes left, permitting explicit later rejoining without automatic enrollment.
- Invites: 256-bit random secret, only SHA-256 persisted; 24-hour expiry, at most 20 live unused invites per room, revocation, single redemption and safe same-account lost-response retry. Revoked/expired/used codes, bans, paused/unpublished rooms and missing paid entitlement deny. A consumed code cannot restore left/banned membership.
- All mutations lock the same Room before membership/invite rows and write canonical events.audit_events in the same transaction. Audit failure rolls back. Read/write predicates bind verified tenant and account.
- Seven feature routes reuse verified actor and typed RoomError, require authenticated fans, require staff for role assignment, never trust body actor/roles, return no-store and redact unexpected error details. No root mounting.
- Flutter HTTP client and screen implement invitation acceptance, confirmed removal/unban, roster, issue/copy/revoke, typed errors, retry/single flight and epoch/account fencing. Roster/tokens are memory-only and cleared on account/room/client changes; no automatic external invitations. The coordinator must supply a Dio instance bound to immutable account credentials, not a mutable cross-account bearer interceptor. currentAccountId must read canonical live identity; rebuild on logout/switch.
- Ten Flutter client/widget cases authored: account mismatch and delayed-response fence, false receipt, ban denial, malformed projections, join recovery, single flight, stale roster, confirmation and token clearing. NOT_RUN.

## Executed checks

Node v24.19.0, npm 11.9.0.
At tested source 0e92f4962aeb22f83548b883126133eba9a9e5f8:

```sh
node --experimental-transform-types --test --test-isolation=none \
  adapters/storage/postgres/src/rooms/membership.test.mjs \
  services/gateway/src/modules/rooms/membership_routes.test.mjs
```

PASS: 20 tests, 0 failures, 0 skips. Tests import actual canonical Rooms TS and actual repository/route source via Node's TS transform. Query-port and route-port doubles exercise authorization/rollback/dispatch; they are NOT real PostgreSQL transactions, concurrency proof, Fastify injection or E2E proof. GitHub blobs read back and matched the tested source; updated quota/fence test read back at the final source SHA.

BLOCKED:
- git clone https://github.com/weavewellindustrieslimited/masanawa.git /workspace/masanawa: exit 128, configured proxy:8080 unreachable. GitHub connector used to fetch/push immutable source; local directory is a scoped source snapshot, not a complete git checkout.
- flutter test test/features/rooms/room_membership_client_test.dart test/features/rooms/room_membership_screen_test.dart: exit 127, flutter not found.
- tsc --noEmit: exit 127, tsc not found. No full compilation claimed.
- psql --version: exit 127, psql not found. No SQL applied anywhere.

## Finite closure / narrow AF00 transfer request

| Item | Owner | State / next action |
| --- | --- | --- |
| Membership/moderation/invite repository and feature routes | ROOMS | SOURCE_CHECKED by 20 unit tests; full TS/PG integration remains unverified |
| Flutter controls and 10 regressions | ROOMS | IMPLEMENTED_UNVERIFIED; run Flutter analyze and the two test files |
| Canonical Rooms prerequisites | Coordinator | Reconcile #625/#655 current heads with current main; retain paid admission and teacher identity checks |
| SQL registration | AF00 | MISSING: allocate append-only membership_schema.sql after Rooms 0001–0004; requires identity and events; do not edit old migration checksums |
| Package exports | AF00 | MISSING: expose createPgRoomMembershipRepository through existing Postgres public exports; retain existing package boundaries |
| Gateway composition | AF00 | MISSING: call registerRoomMembershipRoutes once using createPgRoomMembershipRepository(canonicalPool), canonical verified actor capability authorization, default-OFF flag |
| Consumer composition | AF00 | MISSING: add Room-detail action opening RoomMembershipScreen; pass immutable account-bound Dio client/live identity getter, Room ID/title; management hint must reflect verified role, never grant authority; refresh detail membership after return |
| Staff assignment control | Coordinator | API implemented; connect existing Admin room controls to POST /v1/admin/rooms/:id/members/:userId/role with verified staff and role member/moderator; no protected Admin-shell edits here |
| Disposable database qualification | QUALITY / capable runner | NOT_RUN: apply registered schemas fresh/upgrade; concurrent same-token redemption must yield exactly one account, same-account retry succeeds, ban-vs-join ordering and rollback/audit verified; test tenant crossover, revoked and expired invites, paid expiry and active user authorization |
| Unified source integration | Coordinator | NONE: integrate only after prerequisite reconciliation/ownership and actual relevant compiler/DB/Flutter checks |
| Device / production | RELEASE | NOT_VERIFIED: qualified signed binary and real account/server/DB journey after integration; no deploy, provider spend or production migrations authorized |

SQL adds a default member role preserving existing memberships and a new invite table. Roll forward; runtime stays disabled if schema not installed. Do not cache or log invite POST bodies/issue responses (canonical request logging needs redaction), include tokens in URLs, persist them in analytics, or weaken paid admission.

Next action: coordinating window accepts the narrow composition transfers above on its existing integration workstream; capable QUALITY runner executes full compilation, Flutter tests and disposable PG concurrency/fresh/upgrade checks. ROOMS source and test work is durable in #669; the parent Rooms lane is not complete or production verified.


## Owner-directed merge blocker continuation

Owner asks current agent to resolve blockers and merge, 2026-10-11. Narrow shared source transfer published/read back in factory/claims before changes. Exact additional paths: pnpm-lock.yaml; adapters/storage/postgres/package.json; services/gateway/package.json; services/worker/package.json; apps/admin_mobile/lib/src/screens/platform_pages.dart. Existing shared router, app/main, Calls, migrations and localization remain excluded. Stale Admin path transferred only; other historical paths/branches preserved. Reuse existing completed Admin fix from lane/r0-flutter-compiler-20261010-gpt6 at 6efb9cca3219af81200d562a98cc269a1d05cf26, not a second implementation. Dependency changes limited to existing Rooms imports and a generated frozen lockfile; checks remain strict. Full checkout /workspace/masanawa-repair now accessible with sandbox network grant, no proxy bypass. Next: install pinned tools, reproduce/fix dependency setup, apply prior Admin repair, run actual typecheck/Flutter cases and resolve introduced diagnostics before source merge.
