# Home / Rooms — News workstream

Status: implementation complete; final APK rerun blocked by external build capacity, 2026-10-06.

## Ownership and lineage

- Lane: Home/Rooms Lane N — News production integration.
- Canonical branch: `work/news-production-integration-v2-20261006`.
- Canonical PR: #212.
- Clean base: Home integration PR #206 at `764d179543fd629245e8ad0f98d7fbfc6b11506c`.
- Rebased News implementation head before this handoff: `a62e338ec4a89e8d4eaf7bd953e6489b4ca3074f`.
- Pre-rebase implementation is preserved at `archive/news-v2-before-home-rebase-20261006`.
- Isolated PR #200 is superseded and closed.

News-owned paths:
- `services/gateway/src/news_room.ts`
- `services/gateway/src/news_room.test.ts`
- `services/gateway/src/news_room_route.test.ts`
- `apps/mobile/lib/src/rooms/news/**`
- `apps/mobile/test/news_room_test.dart`
- this handoff

Coordinated shared hooks:
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `services/gateway/src/home_projection_route.test.ts`
- `apps/mobile/lib/src/home/home_state.dart`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`
- `apps/mobile/test/twin_production_integration_test.dart`

Do not use this lane to modify unrelated PR #136 voice/onboarding/Twin-share code, Commerce/Event migrations, production environment, or another Room lane.

## Implemented product behavior

News is a Room presentation over canonical auth/runtime, not a specialist agent.

Implemented:
- authenticated `GET /v1/rooms/news`;
- versioned Home projection `GET /v1/home`;
- server-owned `room.news` availability and Home → `/news`;
- GDELT DOC 2.0 current-news metadata ingestion;
- HTTPS-only source/image admission, bounded category queries, five-minute cache and fail-closed source behavior;
- original publisher links and deterministic `gdelt:...` evidence refs;
- no publisher article-body scraping/republication;
- protected mobile News route, authenticated transport/state, categories, feed, detail and external source opening;
- strict News service request typing;
- production integration test initializes `TestWidgetsFlutterBinding` before platform-service-backed providers start.

## Verification completed before clean rebase

The same News implementation delta was exercised on the previous Home lineage before the final clean rebase:

- full workspace TypeScript typecheck passed;
- full workspace tests: **156 test files passed / 831 tests passed**, with 16 files / 127 tests skipped;
- public API lifecycle and architecture gates passed;
- News service tests: 4 passed;
- News HTTP route tests: 3 passed;
- Home projection tests passed;
- production Gateway smoke passed: health ok, readiness ready with database schema ready, email OTP capability visible, protected routes existed and returned authorization failures rather than 404;
- `flutter analyze --no-fatal-infos --no-fatal-warnings` completed; existing lint debt was non-fatal;
- lane-scoped Flutter tests reached **16 passes / 1 failure**. The only failure was `twin_production_integration_test.dart` using a platform channel before Flutter test binding initialization. Latest Home now includes the same binding initialization and this rebased branch preserves it.

After rebasing directly onto current Home, a static integration audit confirms:
- no unversioned Gateway Home route remains in the integrated Home handler;
- `/v1/rooms/news` is registered;
- production main composes `createNewsRoomService`;
- Home marks News available;
- mobile Home calls `/v1/home`;
- `/news` is protected and routed;
- Home shell opens `room.news` at `/news`;
- the production integration test expects `/v1/home` and initializes `TestWidgetsFlutterBinding`.

PR #212 is mergeable on the exact current Home base.

## Remaining execution-only gate

A fresh release APK could not be produced after the final fix/rebase because every safe build path is externally capacity-blocked:

- Render exhausted the workspace build-pipeline minutes immediately after the lane qualification run;
- GitHub Foundation CI and Mobile Build fail before checkout with zero executed steps;
- Railway rejects creation of a new isolated temporary service because the account has reached its free-plan resource provision limit;
- the local runtime has no Flutter SDK and shell DNS is disabled.

Do not delete or repurpose production/legacy services merely to force this gate.

When any existing builder capacity returns, run the exact current branch head and require:
1. Home/News lane Flutter tests green;
2. `flutter build apk --release` with production API base defines;
3. capture APK SHA-256;
4. update PR #212 and this handoff from execution-blocked to verified/ready.

## Completion state

Implementation: complete.
Clean integration/rebase: complete and mergeable.
Server verification of News delta: complete on preceding equivalent implementation lineage.
Final post-rebase mobile rerun: infrastructure-blocked.
Release APK from final rebased head: not yet produced.
Production deployment: not owned or performed by Lane N.
