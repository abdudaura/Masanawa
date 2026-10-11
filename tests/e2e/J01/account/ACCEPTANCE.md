# J01 / C05 — private Account screen (source-first)

Authority: #615 blueprint branch; the account identity API and PostgreSQL CAS profile are owned by L-SHELL C04 (#649). This change **reuses** their verified /v1/me projection, not another account table, auth resolver, profile publisher or worker.

## Canonical journey
1. Authenticated fan launches Home → avatar → C05 (AF00 router composition). App-supplied authenticated Dio calls GET /v1/me. Server derives tenant and user exclusively from its canonical session; identity adapter performs a tenant/user-fenced read from the existing identity schema.
2. Display private name and links: Following (C46), Joined Rooms (C30), Saved (C25), Subscriptions (C36), Wallet (C50), Settings (C06). Each destination must be wired by the root owner; unconnected items remain visibly disabled and never open Chats.
3. If fan setup incomplete, open C04 through callback. Profile is not public. No contacts permission, publishing action or background worker is needed for this read-only entry.
4. Revoke/logout/tenant switch while request pending: stale future cannot paint previous account data. Retry after network loss retains only an in-memory same-account projection. No persistent cross-account cache.
5. Denied 401/403 → clear private projection and sign in; missing 404 → setup/recovery; 409 → stale retry; 503 → disabled; network failure → offline retry. Test Hausa, English, long names, 200% font scale and low-end Android.

## Coverage and handoff
- Source: `apps/mobile/lib/src/features/account/fan_account_{repository,screen}.dart`
- Widget/model regressions: `apps/mobile/test/features/account/fan_account_screen_test.dart`
- Reused backend: `services/gateway/src/modules/account/fan_setup_routes.ts` (PR #649)
- Reused PostgreSQL: `adapters/storage/postgres/src/account/fan_setup.ts` (PR #649)
- Worker: **not applicable**, no new event or asynchronous action.
- AF00-only composition: pass app session-owned Dio, opaque current-account fence and navigation callbacks; add `account_*` ARB strings in official catalogs, review shared settings route. Register /v1/me exactly once from C04.
- Mandatory real checks on unified SHA: `flutter analyze`, `flutter test test/features/account/fan_account_screen_test.dart`, Node/TypeScript/Vitest for C04 routes, PG18 migration fresh+upgrade+checksum, Android debug/release device J01 smoke. All tests remain **NOT_RUN** unless external run evidence is explicitly attached. No main deployment.

No production data modification, new migration, provider spend, new auth or worker, or live toggle is contained in this PR.
