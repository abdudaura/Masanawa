# Home / Rooms — News workstream

Status: active integration handoff, 2026-10-06.

## Ownership

- Window/lane: Home/Rooms Lane N — News production integration
- Canonical branch: `work/news-production-integration-v2-20261006`
- Canonical PR: #212
- Current feature HEAD: `f3396fe21ef058ef75f53797906591358af2c703`
- Base integration PR: #206 `work/home-production-integration-20261006`
- Latest inspected Home HEAD: `c97ad9d0fc1e19b5c52dd06d4bdde10161224054`
- Supersedes isolated News PR #200. Do not continue #200 as a competing integration path.

Owned News paths:
- `services/gateway/src/news_room.ts`
- `services/gateway/src/news_room.test.ts`
- `services/gateway/src/news_room_route.test.ts`
- `apps/mobile/lib/src/rooms/news/**`
- `apps/mobile/test/news_room_test.dart`
- this handoff

Coordinated integration paths already reconciled with Home:
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `services/gateway/src/home_projection_route.test.ts`
- `apps/mobile/lib/src/home/home_state.dart`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`
- `apps/mobile/test/home/home_continuation_test.dart`
- `apps/mobile/test/twin_home_shell_test.dart`
- `apps/mobile/test/twin_production_integration_test.dart`

Do not use this lane to modify unrelated PR #136 voice, onboarding, Twin share, production environment, Commerce/Event migrations, or another Room lane.

## Locked implementation

News is a Room presentation over canonical runtime/auth, not a specialist agent.

Implemented:
- authenticated `GET /v1/rooms/news`;
- server-owned Home `room.news` availability and Home → `/news` navigation;
- versioned Home projection `GET /v1/home`;
- GDELT DOC 2.0 current-news metadata ingestion;
- bounded per-category queries, five-minute cache, HTTPS-only source/image admission and fail-closed unavailable behavior;
- original publisher links and deterministic `gdelt:...` evidence refs;
- no publisher article-body scraping or republication;
- protected mobile News route, authenticated state/transport, categories, feed, article detail and source opening;
- latest Home continuation/state/shell changes forward-ported from PR #206 while preserving News behavior;
- explicit request typing in `news_room.ts`;
- Flutter test binding initialization in `twin_production_integration_test.dart`.

## Verification evidence

Strong server-side gate on the exact News/Home integration lineage:
- full workspace TypeScript typecheck passed after request typing fix;
- full workspace tests: **156 test files passed, 831 tests passed, 16 files / 127 tests skipped**;
- public API lifecycle and architecture gates passed with `/v1/home` and `/v1/rooms/news`;
- News service tests: 4 passed;
- News HTTP route tests: 3 passed;
- Home projection tests passed;
- production Gateway smoke during qualification: `/healthz` ok, `/readyz` ready with database schema ready, auth capabilities returned email OTP, protected production routes returned 401 rather than 404.

Mobile qualification reached `flutter analyze --no-fatal-infos --no-fatal-warnings` and continued to tests. Analyze reported existing info/warning lint debt but no fatal analyzer stop.

Lane-scoped Flutter run before the final harness fix:
- 16 tests passed;
- one test failed: `twin_production_integration_test.dart` because `ServicesBinding` was not initialized before a provider started connectivity monitoring;
- commit `f3396fe21ef058ef75f53797906591358af2c703` fixes that exact harness defect with `TestWidgetsFlutterBinding.ensureInitialized()`.

A prior broad mobile-suite run also exposed unrelated failures in PR #136-owned voice/onboarding/share tests. Those are not Lane N ownership and were intentionally not modified here.

## Current infrastructure blocker

The remaining action is execution-only: rerun the lane-scoped Flutter tests and release APK build at feature HEAD `f3396fe21ef058ef75f53797906591358af2c703`.

At handoff, all available build paths are capacity-blocked rather than code-failing:
- Render workspace exhausted its build pipeline minutes after the lane run;
- GitHub Foundation CI and Mobile Build for the current commit fail before checkout with zero steps;
- Railway rejects a new isolated temporary build service because the free-plan resource provision limit is reached;
- local container has no Flutter SDK and outbound shell DNS is disabled.

Do not delete or repurpose production/legacy services merely to force verification. When any existing build capacity becomes available, rerun the exact head, then require:
1. lane-scoped Home/News Flutter tests green;
2. `flutter build apk --release` green with production API base defines;
3. capture APK SHA-256;
4. update PR #212 and this handoff from active to verified/ready.

## Completion state

Implementation: complete.
Server verification: complete.
Mobile lane verification: one harness defect fixed after 16/17 pass; final rerun blocked by external capacity.
Release APK: not yet produced from the final fixed head.
Production deployment: not owned or performed by this lane.
