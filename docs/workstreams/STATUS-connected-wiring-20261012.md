# STATUS connected wiring — owner-directed continuation

Branch: lane/status-connected-wiring-20261012. Base integration/rebuild 5c08e151d5ee51c932af5326df85a334a5c0f7b7. Main inspected a6eb2a429fa6a2bb3161e95f80ed1dd64e25f1d3; preserve merged #668 and #670. Owner asked to finish remaining wiring rather than waiting after #671. Exact paths claimed before implementation:

- apps/mobile/lib/src/app/masanawa_consumer_shell.dart
- apps/mobile/lib/src/router/app_router.dart
- apps/mobile/test/rebuild/masanawa_consumer_shell_test.dart
- apps/mobile/lib/src/screens/calls/calls_screen.dart
- apps/mobile/lib/src/features/home_feed/feed_screen.dart
- apps/mobile/test/features/home_feed/feed_screen_test.dart
- services/gateway/src/modules/home_feed/runtime.ts
- services/gateway/src/modules/home_feed/runtime.test.ts
- docs/workstreams/STATUS-connected-wiring-20261012.md

Narrow shared shell/router continuation of the previously published Status transfer; old AF00 shell-composition lease is released. Preserve CallsScreen by recovering the unchanged #668 main widget only; do not implement/change call authority. Keep Rooms' current access gate and Wallet billing/crypto. Retire stale Twin route and align Chats · Status · Wallet · Calls · Rooms, Chats default. Connect Status to existing per-account Dio, server-authorized post/media and existing editor workflow. No new auth, publisher, queue or ledger.

A narrow transfer question is pending for original explicitly forbidden Gateway app.ts/main.ts and required shared gateway manifest/PG exports/lockfile; DO NOT edit those until owner reply. Prepare canonical authenticated runtime and tests meanwhile. No deployment/production migration authorization assumed.

## Exact source expansion before edits
- adapters/storage/postgres/src/home_feed/eligibility.ts
- adapters/storage/postgres/src/home_feed/eligibility.test.ts
Read existing approved active platform identity and cleared character_media for canonical service validation. No new table or authorization authority; binds only, deny unknown/foreign/unapproved records. These feature-owned selectors make the pending root patch concrete against the existing pool; app/main remain untouched.

## Owner-approved narrow composition transfer — before root edits
Owner answered the scope question: **Yes—complete the Status wiring and required build fixes**. Exact additional paths:
- services/gateway/src/app.ts
- services/gateway/src/main.ts
- services/gateway/package.json
- adapters/storage/postgres/src/index.ts
- pnpm-lock.yaml
- apps/mobile/pubspec.lock
The mobile lockfile also has six proven missing declared-dependency entries (intl/localizations/webview), required for frozen resolution; include that bounded build fix under the owner's approved required-build scope. Bind canonical session + existing pool + existing feed/editorial services, export existing PG classes, add feed dependency and preserve all existing financial/call/auth behavior. No deployment or production migrations authorized; prohibited call-history/live-voice files remain untouched.

## Connected qualification expansion — claimed before edits
- packages/feed/src/index.ts
- packages/feed/src/review.ts
- packages/feed/src/index.test.ts
- packages/feed/src/review.test.ts
- services/gateway/src/modules/home_feed/composition.test.ts
Pass the declared post kind to canonical media eligibility, deny audio where the current canonical media catalogue contains only image objects, and test root registration plus author/tenant/recovery behavior. No new media registry.

## Reproduced required build fixes — claimed before edits
- package.json
- services/gateway/src/modules/account/fan_setup_routes.test.ts
- services/gateway/src/modules/admin_operations/routes.test.ts
- services/gateway/src/modules/masana/following_routes.test.ts
- services/gateway/src/modules/masana_chat/inbox_routes.ts
- services/gateway/src/modules/notifications/delivery_preferences_routes.test.ts
- services/gateway/src/modules/home_feed/saved_routes.ts
Frozen install passes. Full root/gateway typecheck reveals undeclared fastify/missions dependencies and five stale fixture/type mismatches. Correct canonical fixtures and exact optional typing without relaxing tsconfig. Saved cursor-array regression reproduced; reject malformed query keys. Incoming Calls owns separate logic; approved Status root changes remain additive and must preserve its later integration.

## Next reproduced strict compiler blockers — before edits
- adapters/storage/postgres/package.json
- adapters/storage/postgres/src/account/fan_setup.test.ts
- adapters/storage/postgres/src/masana_chat/message_actions.test.ts
The PG adapter also imports missions without declaring it; strict test indices/optional values need correction. Retain assertions; no compiler flag relaxation.
