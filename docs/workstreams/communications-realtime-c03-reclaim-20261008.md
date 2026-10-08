# C03 realtime recovery — fresh five-minute claim and Work handoff

Updated UTC: 2026-10-08 11:27; owner/window: GPT-6 C03 recovery.
Status: PARTIAL_IMPLEMENTATION (pre-integration). Lease: last repository-visible claim/commit/PR activity + five minutes.
Base main SHA: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Recovery branch: `work/c03-reclaim-realtime-20261008-gpt6`.
Prior draft PR: #473 at `07f52032fc6c1dac0cf6ae6f6a43fca47b2e91db`, last visible update 11:20:09Z; stale for >5min at new claim (11:26:40Z). Preserve prior source and commits: no force-push or overwrite old PR. New PR explicitly supersedes original *only for review* after importing its code; do not merge both.
Scope: C03 durable, tenant/member-authenticated metadata-only DM realtime journal, safe cursor history pruning/resnapshot, server polling, mobile lifecycle/reconnection, isolated tests.
Exact claimed source paths: `packages/talks/migrations/0019_human_dm_realtime.sql`, `services/gateway/src/human_dm_realtime/**`, `apps/mobile/lib/src/messages/realtime/**`, `apps/mobile/test/messages/realtime/**`, `docs/contracts/HUMAN-DM-C03.md`, this handoff. Copy existing PR #473 source blobs intact before semantic edits.
Explicitly unowned: `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, `apps/mobile/lib/src/human_messages/**`, `apps/mobile/lib/src/messages/cache/**`, root Flutter nav, `mobile_push.ts`, R14/financial/safety auth services, CI, production deployments. Integration owner must merge C01 #468, elect only one C02 among #472/#475/#477, one C05 #474/#476, and C04 #478; do not deploy isolated C03.
Dependency/acceptance: M02/M06/M08/M10, N06/N08, Q06/Q08; J03/J04/J10/J11. Read `docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md`.
Current work: claim and preserve stale C03 source; implement missing safe retention/resync, harden cursor/session handling, tests and exact Work handoff. Pending checks due to #457 CI quota, unavailable Flutter SDK and unavailable approved disposable PostgreSQL test database. No test or deployment pass claimed.
Security: prohibit plaintext message content/push in journal; each authoritative read checks active session, tenant/member, reciprocal block, consent and invalidation; never drop an event without cursor-expiry reset; never use production DB for testing.
Release gates (initial): SOURCE_WRITTEN=partial; LOCAL_TESTED=no; CI_EXECUTED=no; DB_INTEGRATED=no; APP_INTEGRATED=no; DEVICE_VERIFIED=no; PROVIDER_QUALIFIED=no; DEPLOYED=no; MERGED=no.
