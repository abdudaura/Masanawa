# C03 — human DM realtime, catch-up and delivery lifecycle

**LATEST CHECKPOINT: C03 isolated source written; shared integration and verification still blocked. DRAFT/UNMERGED, NOT DONE.**

- Owner/window: GPT-6, C03 communications-realtime, 2026-10-08. First claim made around 11:04 UTC; lease expires five minutes after the last repository-visible work under `docs/MULTI-WINDOW-WORK.md` and must be rechecked on resume.
- Canonical base: `main` SHA `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
- Isolated branch: `work/c03-human-dm-realtime-20261008-gpt6`.
- Scope: C03 only; M02/M06/M08/M10, N06/N08, Q06/Q08; J03/J04/J10/J11. Reuse canonical C01 authenticated human contacts, C02 durable human DMs, C05 protected local cache, R14 FCM delivery, and existing Postgres/events security authority. Never treat AI character history or Talk push as human DMs.
- Repository review at claim: `main` above; C02 draft [#472](https://github.com/Baatiku/masanawa/pull/472) actively changes `services/gateway/src/human_messages/**`, `apps/mobile/lib/src/human_messages/**`, and `packages/talks/migrations/0017_human_dm_core.sql`. C01 draft [#468](https://github.com/Baatiku/masanawa/pull/468) owns `0016_human_messaging_contacts.sql` and contact API/Gateway composition. C04 branch `work/c04-private-voice-notes-20261008` recently updated `0018_human_dm_media.sql`; C05 branch `work/c05-protected-human-chat-cache-20261008` recently updated local `apps/mobile/lib/src/messages/cache/**`. R14 [#436](https://github.com/Baatiku/masanawa/pull/436) owns `services/gateway/src/mobile_push.ts` and tests; CI/release [#457](https://github.com/Baatiku/masanawa/issues/457) is reserved for Work. No C03 named branch or open C03 PR found at the claim check. A stale unrelated realtime branch from 2026-10-06 is not evidence of a current C03 claim.

## Exact reserved edit boundaries

- New `services/gateway/src/human_dm_realtime/**`: only C03 authorization, durable read-cursor/gap catch-up/event projection and transport, in isolation from C02 implementation.
- New `apps/mobile/lib/src/messages/realtime/**` and `apps/mobile/test/messages/realtime/**`: C03 authenticated session-bound stream/catch-up and offline reconnect client contract, **not** C05 cache internals or C02 screen/controller.
- New `services/gateway/src/human_dm_realtime/*.test.ts`: focused route/service/error/auth/reconnect tests.
- Proposed unique schema path `packages/talks/migrations/0019_human_dm_realtime.sql` **only after** confirming C04 `0018` and C02 `0017` exact migration ordering and schema coordinator acceptance; this claim does not assert that migration exists or is installed.
- This claim/checkpoint document.

**Explicitly NOT owned:** `services/gateway/src/app.ts`, `main.ts`, `human_messages/**`, `human_contacts/**`, `mobile_push.ts`, `apps/mobile/lib/src/human_messages/**`, `apps/mobile/lib/src/messages/cache/**`, Flutter root/router, global session/auth refresh, financial ledgers, CI workflow/secrets, production migrations/deployment. New interfaces must be integrated by current Gateway/R17+C08/C02/C05/R14 owners via reviewable contracts. Do not silently edit overlapping shared files.

## Implementation and acceptance boundary (pending work)

1. Inspect complete C02 `docs/contracts/HUMAN-DM-C02.md`, C01 contact privacy and event/outbox infrastructure. Choose authorized, tenant/member-checked, bounded monotonic cursor + non-leaking event envelope; no raw message bodies in push or public event bus. Read/subscribe must revalidate active account, conversation membership, reciprocal blocks and revocation, including long poll/reconnect. Unauthorized and deleted targets fail closed.
2. Implement authoritative durable deltas, unread/read receipt synchronization, explicit acknowledgments, cursor expiry/reset/full resync semantics, backpressure/rate limits, safe multi-device ordering and logout/account-switch cancellation. The sender's C02 201 is only persistence, never recipient delivery.
3. Mobile must consume current user-scoped stream or authenticated poll fallback with disconnect/retry jitter, delta catch-up, dedupe and bounded memory; hand real event projection to C05 cache contract and C02 UI without an alternative source of truth.
4. Coordinate with R14 push owner for privacy-default masked FCM previews, per-user mute/notification settings, typed `/messages/:conversationId` links, correct-account gating, no duplicate public Talk Activity. Push is a wake-up hint, never the authoritative message store.
5. Write executable TS/Postgres/Flutter contract and failure/restart tests: A/B active sessions, non-member denial, block mid-reconnect, simultaneous sends, cursor gap/expiry, app background/kill, offline recovery, session switch, push-disabled and multiple devices; then actually run them on Work/CI/device before any DONE claim.

**Original claim-only checkpoint (superseded by the implementation status below):** `SOURCE_WRITTEN=no` (only coordination doc); `LOCAL_TESTED=no`; `DB_INTEGRATED=no`; `CI_EXECUTED=no`; `APP_INTEGRATED=no`; `DEPLOYED=no`; `DEVICE_VERIFIED=no`; `MERGED=no`. External CI issue #457 is a known blocker; it does not block writing the owned code and tests. Work handoff will require exact commands, real database and two-account/device evidence.

**Five-minute rule:** this does not reserve another window's paths or create permanent ownership. New windows must re-evaluate the most recent commit/PR activity and proceed non-destructively if this claim becomes stale.


## C03 source implementation checkpoint — 2026-10-08

**Ownership retained only while repository-visible work stays within five minutes; the branch is not a permanent lock.** All edits stayed within the exact C03 new paths; C01/C02/C04/C05/R14/R17 shared files were not changed.

### Source committed

- packages/talks/migrations/0019_human_dm_realtime.sql: member-recipient-indexed, metadata-only journal; same-transaction PostgreSQL insert/edit/delete/read and contact/preference/block/profile/account invalidation triggers. A tenant-scoped transaction advisory lock serializes event ID allocation with commits so a slow transaction cannot be skipped. Read-receipt events carry the actual server read high-water.
- services/gateway/src/human_dm_realtime/postgres_repository.ts: per-tenant/member indexed delta scan, current C02 conversation membership/active-user/reciprocal block/decline/profile restriction enforcement, bounded keyset cursors, no message-body field. Access invalidations reach former authorized members to prompt cache recheck.
- services/gateway/src/human_dm_realtime/service.ts, routes.ts, composition.ts: canonical session authorizer and shared Postgres Pool composition seam; validated nonnegative 64-bit cursor/limit/wait, bounded long polling, reauthorization during wait, disconnect cancellation and no-store API.
- apps/mobile/lib/src/messages/realtime/human_dm_realtime_transport.dart, human_dm_realtime_sync.dart: typed Dio session transport, exact read receipts, bounded foreground catch-up, protected cursor-store/projection interfaces for C05, durable ACK only after successful projection, signout/profile-switch guard/cancel, connection status and bounded reconnect backoff. No alternative human message store.
- services/gateway/src/human_dm_realtime/realtime.test.ts and postgres_integration.test.ts; apps/mobile/test/messages/realtime/human_dm_realtime_test.dart and human_dm_realtime_transport_test.dart: focused auth, validation, ordering, member privacy, consent revoke, read-highwater, cancelled polls, account switch, persistent cursor and error regressions. Real DB tests guard against any nonloopback or non *_test database. **All test SOURCE ONLY, none run.**
- docs/contracts/HUMAN-DM-C03.md: exact wire, typed events and cross-owner gateway/mobile/push/retention integration contract.

### Required remaining integration (C03 is still PARTIAL_IMPLEMENTATION)

1. Gateway owner must semantically merge R18 #435, C01 #468, C02 #472 and C03 shared composition in app.ts/main.ts. This C03 branch intentionally does not overwrite shared files or ship an unreachable fake Chats surface. Apply C01 0016 then C02 0017 then C04 0018 (where adopted) then C03 0019 on fresh disposable Postgres; require migration owner to verify 0019 name is still unused.
2. C05 owner implements durable per-tenant/user cursor store and C02/Gateway-backed projection adapter for HumanDmRealtimeSync, including read receipt updates and authoritative invalidation/eviction, and coordinates lifecycle with R17/C08 owner. No generic agent or in-memory-only cache may be substituted. Until wired, the Flutter coordinator is **not a live app feature**.
3. R14 owner must integrate masked private-message **push hints** only after C02 committed send; reconcile multi-device dedupe/mute/lock screen/typed /messages deep links and avoid any raw human DM payload. Neither FCM credentials nor push wiring are present in this C03 PR.
4. Mandatory operations gap: journal retention/pruning **not built**. Do not truncate event rows without persisted per-member prune watermark and cursor-expiry/reset-to-C02-snapshot semantics. Current indexed journal grows indefinitely until an approved operations owner implements/qualifies retention. Account deletion and revoked-profile cache evictions require end-to-end proof.
5. Note that C02/C01 migrations and their Gateway composition are on **draft branches**, not main: an isolated C03 branch cannot pass actual database/runtime tests until those source dependencies are semantically reconciled on a temporary executable integration branch. Keep C03 unmerged until that and #457 CI recovery.

### Explicit unexecuted Work checks

From a real checkout with all approved dependency branches reconciled and reproducible lockfile:

    pnpm --filter @masanawa/gateway-service typecheck
    pnpm exec vitest run services/gateway/src/human_dm_realtime/realtime.test.ts
    MASANAWA_C03_ENABLE_DB_TESTS=yes MASANAWA_C03_TEST_DATABASE_URL='postgresql://tester:LOCAL_ONLY@127.0.0.1:5432/masanawa_c03_test' pnpm exec vitest run services/gateway/src/human_dm_realtime/postgres_integration.test.ts
    cd apps/mobile && flutter analyze
    cd apps/mobile && flutter test test/messages/realtime/human_dm_realtime_test.dart test/messages/realtime/human_dm_realtime_transport_test.dart

The DB URL above is illustrative; supply a real disposable loopback *_test database and never production credentials. The suite must explicitly report real PG18 migration application, trigger/serializable/concurrent long transaction ordering, two real authenticated A/B clients, revocation while long-poll waits, multi-device read receipt correctness, lifecycle stop/reconnect, 1000-thread/100k-message performance, push on/off, clear cache on account deletion, Android network/dropout and signed release build. Execute full Gateway and Flutter regressions after focused checks. No command above was executed here; no fictitious PASS.

### Status (evidence-specific)

SOURCE_WRITTEN=YES (GitHub draft branch). LOCAL_TESTED=NO. CI_EXECUTED=NO (shared #457). DB_INTEGRATED=NO. APP_INTEGRATED=NO. DEVICE_VERIFIED=NO. DEPLOYED=NO. MERGED=NO. PROVIDER_QUALIFIED=NO. **Status: PARTIAL_IMPLEMENTATION, with C03 isolated source and tests authored.** No real message delivery, read receipt, push, or low-data performance success asserted. Do not mark C03 DONE or sign J03/J04/J10/J11.
