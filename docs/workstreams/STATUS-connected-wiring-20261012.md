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

## Final worker compiler blockers — claimed before edits
- services/worker/src/jobs/masana/follow_preference_policy.test.ts
- services/worker/src/jobs/youtube_websub/outbox_runner.ts
Missing Pool type import and exact optional timestamp typing. Preserve runtime claims/settlement behavior.

## Executed delivery checkpoint — 2026-10-12

PR: https://github.com/weavewellindustrieslimited/masanawa/pull/674. Dedicated branch `lane/status-connected-wiring-20261012`; integration base `5c08e151d5ee51c932af5326df85a334a5c0f7b7`; substantive source head `683d7526ffb514fe2fba78bf6438b35217aaa1c7`. All 33 changed source/dependency files were compared by Git blob hash with the tested checkout and match. Exact changed paths are available in the PR; prohibited call-history/live_voice_token/agent_shell/migration0007 files unchanged. Main inspected at a6eb2a4; no main merge or deploy.

Source implemented: actual Gateway startup binds existing platform bearer-session authorizer, existing database pool, canonical FeedService/EditorialReviewService and current active/platform/approved author eligibility. Trusted tenant/user never comes from body/role headers. Only server-listed editor user IDs enter independently reviewed editorial workflow; fans cannot publish. Canonical media validation now receives post kind, so existing image catalogue references cannot be relabelled as audio. Account-fenced five-tab shell opens Chats and renders Status feed; existing Wallet billing/crypto and Rooms gate preserved. Existing main CallsScreen recovered unchanged. Nested media preserves post/media pair; account changes clear nested routes and stale projections. Required declared dependencies/lockfiles/strict fixtures corrected without relaxing compiler or assertions.

Executed commands and results (Node24.19, pnpm12.8.2, TypeScript7.0.2, Vitest5.0.3; Flutter3.47.7/Dart3.13.5):
- `pnpm install --frozen-lockfile`: PASS; supply-chain policies preserved.
- `pnpm typecheck`: PASS full workspace, unchanged strict settings.
- `pnpm build`: PASS full workspace, including Next apps and Gateway/worker. SDK-generated Next config edits restored; generated artifacts moved outside source scan, not committed.
- `pnpm --filter @masanawa/gateway-service... build`: PASS; production-condition imports of feed/editorial/PG/Gateway exports PASS. Did not invoke gateway start (it would migrate).
- Focused Vitest: 78 PASS across feed/runtime/media/saved/eligibility and corrected Gateway fixtures; actual Gateway root/startup composition: 2 PASS including canonical session, tenant/role denial, revoked auth, storage failure/recovery and same-store binding.
- Disposable PG18.6 `feed.integration.test.ts`: 9 PASS (tenant fencing, idempotency/conflicts, current author visibility, independent review/CAS, comments/outbox).
- Production-built migration runner/registered roots on unique disposable PG18 database: 74 fresh migrations applied, second application 0, schema readiness true. Owned DB dropped after check. No production migrations.
- Flutter frozen pub resolution PASS. `flutter test --no-pub test/rebuild/masanawa_consumer_shell_test.dart test/features/home_feed/feed_screen_test.dart test/features/home_feed/feed_media_screen_test.dart`: 15 PASS. Scoped Dart analyzer: no issues.
- Full `vitest run`, clean source scan: 1539 PASS / 29 FAIL / 166 SKIP, 335 files. Same execution on unchanged integration base: 1515 PASS / 34 FAIL / 166 SKIP plus existing missing-dependency suite failures. Every one of current 29 failing cases reproduced on base; no new failing case. Earlier 30th failure was source scanner walking generated Next standalone vendor artifacts; moved artifacts outside source, reran without changing checks. Whole-app tests are NOT passing. Remaining failures are architecture/product-contract catalog drift, retired Twin/clone tests, existing financial fixtures/authority failures, Talk gift/profile/replay fixtures and lifecycle contracts. Preserve financial checks; do not infer release qualification.
- `flutter build apk --debug --no-pub`: BLOCKED, no Android SDK installed. No device/emulator, signed Android binary, iOS/macOS runner or signing proof established.
- Fresh read-only production probe: `/readyz`200, `/v1/feed`404. Status is NOT production verified. No deployment, paid resources, production migration or secret exposure.

Integration instructions: qualified scoped source milestone may merge to `integration/rebuild`; Foundation/Mobile workflows explicitly make that target advisory while retaining failed results, main remains strict. Target still equals base; no source conflict. Root app/main/router changes are additive Status transfer; when incoming Calls is integrated, preserve both modules and session route fences. No main/production release from this checkpoint.

Remaining source/capability and next action: text feed/editorial wiring is implemented and executable. Image signed-download binding is still absent from default startup: needs the existing canonical character-media object store's qualified signer, cleared rights + real content-type metadata, approved HTTPS origin and bounded grant; do not assume replay bucket, infer MIME from a media ID or introduce a second registry. Runtime supports canonical injected media signer; mobile post/media display contract is tested, but default image downloads are not qualified. Audio requires approved canonical audio assets and integration with the existing audio-focus owner; current canonical character_media catalogue stores images only, so audio publishing fails closed. Audio focus is not invented/claimed. Production release requires canonical user/editor credentials, approved deployment/migration/backup/rollback execution, Android SDK/device and signing credentials, and Mac/Xcode runner plus iOS provisioning for iOS qualification. Continue with that narrow existing-media binding or explicit repository-visible transfer while whole-app owners fix the reproduced baseline failures.

Status: IMPLEMENTED + VERIFIED_SCOPED text Status and shell milestone; whole-app/release PARTIAL; production NOT_VERIFIED.
