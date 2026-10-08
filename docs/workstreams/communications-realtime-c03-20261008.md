# C03 — human DM realtime, catch-up and delivery lifecycle

**CLAIM ONLY — no functionality completed, verified, deployed or merged.**

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

**At claim:** `SOURCE_WRITTEN=no` (only coordination doc); `LOCAL_TESTED=no`; `DB_INTEGRATED=no`; `CI_EXECUTED=no`; `APP_INTEGRATED=no`; `DEPLOYED=no`; `DEVICE_VERIFIED=no`; `MERGED=no`. External CI issue #457 is a known blocker; it does not block writing the owned code and tests. Work handoff will require exact commands, real database and two-account/device evidence.

**Five-minute rule:** this does not reserve another window's paths or create permanent ownership. New windows must re-evaluate the most recent commit/PR activity and proceed non-destructively if this claim becomes stale.
