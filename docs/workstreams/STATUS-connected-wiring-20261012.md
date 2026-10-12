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
