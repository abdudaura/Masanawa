# STATUS lane — Masana authorization and display

Owner: Codex STATUS implementation window, 2026-10-11 UTC.
Branch: lane/status-masana-authorization-20261011
Base: integration/rebuild e33490013c54a9dc3a86c8fcb526a01634df3992.
Fresh main inspected: a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d (merged #668).

## Exact paths claimed before implementation
- packages/feed/src/index.ts
- packages/feed/src/index.test.ts
- adapters/storage/postgres/src/home_feed/repository.ts
- adapters/storage/postgres/src/home_feed/repository.test.ts
- apps/mobile/lib/src/features/home_feed/feed_screen.dart
- apps/mobile/test/features/home_feed/feed_screen_test.dart
- tests/e2e/J06/status_authorization.test.mjs
- docs/workstreams/STATUS-masana-authorization-20261011.md

Prior feed claims l-feed-j06-core, l-feed-c22-post-detail and l-feed-a05-a06-editorial are explicitly released in factory/claims; #631 and #666 are closed and their useful source is preserved in this baseline. No active exact-path owner found. This is a bounded continuation of that canonical feed, not a new subsystem. All protected composition, routing/shell, catalogs, migrations, manifests, lockfiles, calls and financial source remain with the coordinator.

## Milestone / finite closure
- IN_PROGRESS: feed/list/detail/reactions/comments recheck approved active platform Masana in canonical SQL; reject staff direct-publish bypass, retain independent editorial review and Masana service identity.
- IN_PROGRESS: Status display denies late requests on disable/account replacement, recovers pagination and failed actions without stale data or blocked retry.
- MISSING / coordinator: five_tab_shell.dart Status currently mounts TalkHomeScreen and offers /talk/create. Replace with authenticated canonical MasanaFeedScreen, remove human composer; use current-account API/key and existing media/profile/report contracts. Exact shared path transfer requested through this record, no authority assumed.
- NOT_RUN: executable source/authorization tests; Flutter/PG/source compilation pending capability check.
- NOT INTEGRATED / NOT PRODUCTION VERIFIED.

Contracts: existing @masanawa/feed, PgHomeFeedRepository, editorial review (#666), FeedApi and MasanaFeedScreen; no new schema, publisher, queue, auth or storage authority. Next action: implement owned authorization + display recovery and execute available meaningful tests. PR and exact head/test evidence appended at delivery.
