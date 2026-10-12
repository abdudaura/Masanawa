# STATUS — Masana publishing/feed authorization and display recovery

Owner: Codex STATUS implementation window. Date: 2026-10-11 UTC.
PR: https://github.com/weavewellindustrieslimited/masanawa/pull/671
Branch: lane/status-masana-authorization-20261011
Base: integration/rebuild @ e33490013c54a9dc3a86c8fcb526a01634df3992
Implemented source HEAD: 3a2c1bd6526584467af9c1b2b768420a6ed2e5f1 (earlier Flutter execution source 16973d1 is unchanged)
Main inspected before and after implementation: a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d, including merged #668.
Final handoff commit changes documentation only; the PR branch supplies its exact current head.

## Ownership / preservation
Exact-path workstream claim pushed and read back at d316f84 before implementation; editorial validator addition at aa8260d; final editorial SQL addition at 855c82d. Registry factory/claims claim status-masana-authorization-20261011-codex; blob-SHA CAS connector updates preserve every prior record. Prior overlapping feed claims are explicitly released, #631 and #666 are closed, their source is reused. No stale unreleased ownership was seized. No force push, merge, provider call, production migration or deploy performed. User's unseen local changes remain unreconciled and untouched.

## Changed paths
- packages/feed/src/index.ts
- packages/feed/src/index.test.ts
- packages/feed/src/review.ts
- adapters/storage/postgres/src/home_feed/repository.ts
- adapters/storage/postgres/src/home_feed/repository.test.ts
- adapters/storage/postgres/src/home_feed/feed.integration.test.ts
- adapters/storage/postgres/src/home_feed/review_repository.ts
- adapters/storage/postgres/src/home_feed/review_repository.test.ts
- apps/mobile/lib/src/features/home_feed/feed_media_screen.dart
- apps/mobile/lib/src/features/home_feed/feed_screen.dart
- apps/mobile/test/features/home_feed/feed_screen_test.dart
- tests/e2e/J06/status_authorization.test.mjs
- docs/workstreams/STATUS-masana-authorization-20261011.md

No financial, auth authority, shared shell/router, Gateway composition, localization catalogs, migration registration, manifest/lockfile or prohibited call source changed.

## Connected source / finite closure (J06, C21, A05/A06)
| Item | Owner / paths | Source | Executed result |
| --- | --- | --- | --- |
| Masana-only direct publication; reject fan, staff bypass, spoofed/unapproved identity and invalid text/media | STATUS / feed index | IMPLEMENTED_UNVERIFIED, 16973d1e0ef81aae52218720a57bb48119a05b7d | PASS_SIMULATED Node source units |
| Reuse independent staff draft/review authority; repair blocking validator syntax | STATUS / review.ts | IMPLEMENTED_UNVERIFIED | Before repair runtime parser FAIL reproduced; fixed source parser and independent-review unit PASS |
| Feed/detail/comment read and reaction/comment insert recheck approved active platform author in tenant | STATUS / feed repository | IMPLEMENTED_UNVERIFIED | PASS_SIMULATED SQL-contract/mocked-pool cases; real PG NOT_RUN |
| Final immediate approval, scheduling and due publication SQL recheck current author eligibility | STATUS / review repository | IMPLEMENTED_UNVERIFIED | PASS_SIMULATED denial/rollback/no-audit tests; real PG races NOT_RUN |
| Feed disable/account replacement invalidate responses, reset pagination and clear projections; revoked session clears posts; offline refresh retains same-account content; reactions serialize/rollback/retry; pagination error retry; short lists refresh | STATUS / feed_screen.dart | IMPLEMENTED_UNVERIFIED | 8/8 Flutter widget tests PASS_SIMULATED in actual CI runner (UI stubs), source 16973d1 |
| Preserve #668 five tabs; mount actual Masana Status and remove human composer | coordinating window / apps/mobile/lib/src/shell/five_tab_shell.dart | MISSING on inspected main | NOT_RUN; exact transfer request below |
| Authenticate and bind canonical feed/editorial repositories/author+media verifiers, register existing routes/migrations, nested media/profile/report destinations | coordinating window / protected composition | NOT VERIFIED / must inspect current source | NOT_RUN |
| Full workspace, PG18, Flutter and device qualification | coordinator / qualified runner | Pending execution | BLOCKED, exact requirements below |

This completes the owned authorization/recovery increment. Full Status journey remains PARTIAL_IMPLEMENTATION until protected shell/API bindings and actual qualification are completed. No release claim.

## Executed evidence
Environment: isolated source snapshot fetched through authenticated GitHub connector; Node v24.19.0, pnpm 11.25.0 available. It is not a full repository checkout.
- `node --experimental-transform-types tests/e2e/J06/status_authorization.test.mjs`: **11/11 PASS_SIMULATED**, source unit tests plus mocked PostgreSQL query contracts, no real database or device E2E. Source hook only resolves emitted .js specifiers to existing .ts files; it never rewrites the implementation.
- Node `stripTypeScriptTypes(readFileSync(path), {mode:'transform'})` on all 7 changed TypeScript source/test files: **PASS syntax transform**, not TypeScript typecheck.
- `node --experimental-transform-types /tmp/status-review-before.ts` using preserved original review.ts from the base snapshot: **FAIL reproduced**, ERR_INVALID_TYPESCRIPT_SYNTAX at the unmatched parenthesis in validateDraft; corrected source successfully loads in the 11-test suite.
- `git diff --check`: **PASS**.
- GitHub exact-source readback for all 10 backend/feed source/test paths at 9b01f5e99289ab493370fafe510d1ba6f118a821, unchanged at 16973d1; media repair readback at 16973d1: matched the executed local snapshot byte for byte. This is source integrity evidence, not runtime E2E.
- `git clone https://github.com/weavewellindustrieslimited/masanawa.git /workspace/masanawa`: **BLOCKED**, configured proxy port 8080 unreachable. No proxy bypass attempted.
- `pnpm --filter @masanawa/feed typecheck` in the isolated snapshot: printed **No projects found**, NOT_RUN despite exit code 0. Full manifests/dependencies are absent; no compilation pass claimed.
- `command -v flutter`, `command -v dart`, `command -v psql`: absent. Local Flutter/PG qualification **BLOCKED**. Actual GitHub Flutter execution is recorded below.
- Exact-source CI Foundation run 38173645321, job 114571321074: **FAIL**, real steps ran. Install failed ERR_PNPM_PACKAGE_MANAGER_NO_IMPORTER because pnpm-lock.yaml lacks importers[packages/feed]; Typecheck skipped, Test/Build failed at dependency setup, actual Vitest/PG tests did not execute. Eighteen separate provider-tooling tests passed, not Status or provider E2E. Runner checked PR merge ref 79b1f6cd19df6a0ba9c87671d67a0bf349088cfe (source 9b01f5e into integration base 5ebc77a1). Coordinator exclusively owns pnpm-lock.yaml: regenerate against current workspace with pnpm 12.8.2, preserve all importers/pinned versions, rerun the checks; this lane has not edited the lockfile. Mobile Build 38173645324 was superseded; final source execution results are recorded below. Combined Vercel failed build-rate-limit; no Status test failure established by that status.

## Bounded repository-visible transfer request to coordinating window
Requested shared path: **apps/mobile/lib/src/shell/five_tab_shell.dart** (owner retains authority; this lane has NOT edited it).
1. Retain #668 Chats · Status · Wallet · Calls · Rooms, Chats launch default, Wallet and calls behavior.
2. Replace Status's current TalkHomeScreen with existing `MasanaFeedScreen` and `DioFeedApi(existingAuthenticatedDio)`; supply a canonical current-account key, enable state and existing approved-media/profile/report bindings.
3. Remove Status `FloatingActionButton` “New status” pointing at `/talk/create`. Humans cannot publish consumer Status. Staff publish only through existing independent A05/A06 editorial workflow; approved Masana service identities use the canonical service.
4. Clear/pop nested post/comment/media screens on logout/account replacement. Passing a frozen prior-account key into a pushed route is not account replacement.
5. If adopting this feature from integration into main, keep #668 shell/source intact and transplant these 13 scoped paths only; do not merge the unrelated historical integration tree over main. This PR targets the coordinator's existing non-deploying integration/rebuild, never auto-merge main.

Protected Gateway/worker/migration binding remains with coordinating window. Before enabling, verify principal comes solely from canonical server session; approvedMasana and scheduled verifier resolve tenant + approved revision + active platform-owned canonical identity; media resolver validates current rights/ownership; register existing routes once and retain their kill switches. No new publisher, queue, media registry, auth store or financial ledger is introduced here.

## Integration / qualification next action
1. Coordinator reviews PR #671 and claims the bounded shell composition; inspect current integration head and actual shared-source ownership. Cherry-pick/merge only after applicable source checks; this window has not merged it.
2. In a full dependency-installed checkout at source HEAD, run:
   - `node --experimental-transform-types tests/e2e/J06/status_authorization.test.mjs`
   - `pnpm exec vitest run packages/feed/src/index.test.ts packages/feed/src/review.test.ts adapters/storage/postgres/src/home_feed/repository.test.ts adapters/storage/postgres/src/home_feed/review_repository.test.ts services/gateway/src/modules/home_feed/routes.test.ts tests/e2e/J06/feed-journey.test.ts`
   - `pnpm --filter @masanawa/feed typecheck` and affected Postgres/Gateway/worker workspace checks.
   - `cd apps/mobile && flutter analyze && flutter test test/features/home_feed/feed_screen_test.dart`
3. On disposable PG18, qualify existing feed 0001–0004 and Masana identity schemas fresh/upgrade; verify real active/platform revocation, cross-tenant denial, duplicate publishing/reactions, independent review, scheduled release, publication races and rollback. No production SQL now.
4. At composed unified SHA run the signed-in Status journey and disabled/offline/account-switch recovery on representative Android. Required capabilities: supported repository-pinned Flutter/Dart, full dependencies, Android SDK/runner and test device; signed release build/signing remains a separate coordinator release requirement and was not inspected/verified here.
5. Record integrated SHA and actual tests, then separately qualify production/media/provider/security/release. No production verification, signing, Mac/iOS, credential or device claim is established by this source increment.

Next implementable action is coordinator-owned Status shell/API composition, not another feed subsystem. Remaining lane source is explicitly transferred to that continuing window through this PR and handoff.

## Additional Status compilation blocker claimed before edit
Exact added path: apps/mobile/lib/src/features/home_feed/feed_media_screen.dart. Actual Flutter analyzer at PR merge SHA 79b1f6c reports expected ')' at line 136 in Slider callback. Fixed the missing Slider closing parenthesis at 16973d1, retaining existing C23 signed-media/audio behavior and tests. Prior media owner is released and no unreleased overlapping registry owner found. The separate MyTwinRouteScreen error at shared app_router.dart:236 remains with coordinator; do not restore retired Twin onboarding.

## Final executed CI and continuation checkpoint — 2026-10-12 UTC
Final implemented source SHA: **16973d1e0ef81aae52218720a57bb48119a05b7d**.
PR merge test SHA: **f139acf** (16973d1 into integration snapshot 5ebc77a1f36ca2dc462f4f2ef6e0dff682d98230).
Final handoff commit changes documentation only.

- Mobile Build **38173867952**, consumer job **114572049917**: actual Flutter full test command executed. **8/8 feed_screen_test.dart cases PASS_SIMULATED** (Flutter widget runtime with stub FeedApi), including human-composer absence, account replacement, feature disable/late result, stale pagination lock, offline/401, reaction rollback/retry and pagination failure recovery. **4/4 existing feed_media_screen_test.dart cases PASS_SIMULATED**, including server-grant gating, scoped media ID, account-switch rejection and disabled/denied media state. These are actual executed widget tests, not real API/DB/device E2E.
- The repaired feed_media_screen.dart has **no analyzer syntax error** on this run. Consumer analyze still **FAIL** with the one source error `apps/mobile/lib/src/router/app_router.dart:236:34 MyTwinRouteScreen isn't a class` and unrelated lint debt. Full consumer tests **FAIL** on unrelated account privacy/video/wallet/directory/localization/profile/retired-Talk cases and app route compilation; relevant Status tests passed. Production APK/Web release steps **FAIL**; no binary qualified.
- Same run Admin job **114572050078**: analyzer **PASS**, full widget suite **FAIL**, debug APK **PASS**. This is Admin-only evidence, not consumer Status/device release proof.
- Foundation **38173868160**, job **114571991857**: actual dependency install **FAIL** `ERR_PNPM_PACKAGE_MANAGER_NO_IMPORTER`, missing `pnpm-lock.yaml importers["packages/feed"]`; typecheck **SKIPPED**, package test/build fail before source execution. Real PG18/Vitest source qualification remains blocked. Coordinator owns this exact lockfile path and must regenerate/check the current pinned workspace without weakening frozen installation.
- Continuation reran `node --experimental-transform-types tests/e2e/J06/status_authorization.test.mjs`: **11/11 PASS_SIMULATED**; `git diff --check` **PASS**.
- Main remains a8e1c84 after refreshed read. No merge, main mutation, production operation, provider call or paid resource performed.

### Exact remaining source transfer / execution owner
The **coordinating window** owns the remaining implementable source: `apps/mobile/lib/src/shell/five_tab_shell.dart` must mount actual Masana Status and remove the human composer; `apps/mobile/lib/src/router/app_router.dart` must remove/retire the stale MyTwinRouteScreen reference rather than restoring Twin onboarding; protected Gateway/worker/migration composition must connect existing canonical auth/feed/editorial/media modules. The exact narrow changes are described above. Status owner has not edited these protected paths.
The coordinator also owns `pnpm-lock.yaml` repair, exact integrated-SHA TS/Vitest/PG18 and consumer build reruns. Device/signing/provider/production checks remain separate and unverified.
Full Status journey remains **PARTIAL_IMPLEMENTATION**; owned source authorization/recovery/media syntax increment is implemented and its scoped executable units/widgets pass. Next action: coordinator composes these existing modules and qualifies the unified SHA. Preserve source and continue PR #671; do not open another publisher/feed subsystem.

## Continuation claim before PostgreSQL integration test changes — 2026-10-12
Exact added path: adapters/storage/postgres/src/home_feed/feed.integration.test.ts. Environment network now permits a full checkout and pinned tools installed outside the repository. Feed package strict typecheck has passed. Continue the existing disposable-only PG18 suite: replace outdated staff direct-publish fixtures with authenticated Masana identity and canonical active/platform identity tables; preserve historical-comment upgrade tests; add real revocation/ownership and final editorial publication denial/recovery tests. No migration, manifest, lockfile or shared composition edits. This replaces prior unavailable-runner assumptions with observed capability; no production DB access.

## Completed available-runner continuation — 2026-10-12 UTC
**Source checkpoint 3a2c1bd6526584467af9c1b2b768420a6ed2e5f1** adds only the existing PostgreSQL integration test changes; runtime source and Flutter source remain as tested above. Environment network recovery now allowed a full clone at /workspace/status-checkout. Prior clone/runner blocks above are historical observations, not current capability claims.

### Executed at matching source blobs
- Repository-pinned **TypeScript 7.0.2**, **Vitest 5.0.3**, **Fastify 5.12.5**, **pg 8.23.0**, **@types/pg 8.23.1**, **@types/node 24.13.6** installed in /tmp/status-tools. Checkout node_modules is an untracked symlink to those tools. No manifest, tracked lockfile or check policy changed; this is scoped execution, not a successful frozen workspace install.
- `/tmp/status-tools/node_modules/.bin/tsc -p packages/feed/tsconfig.json`: **PASS**, unchanged repository strict package configuration.
- `/tmp/status-tools/node_modules/.bin/tsc -p /tmp/status-tsconfig.json`: **PASS**, 12 source/test entry files, extending the unchanged repository tsconfig.base.json with only temporary typeRoots. Includes feed/editorial source and original tests, feed/review PostgreSQL source and tests, real integration test, existing gateway routes/tests and J06 journey. No strictness flags weakened.
- Original six-file Vitest suite: **41/41 PASS_SIMULATED** (unit and Fastify-injection/mock-repository cases).
- Disposable local Docker database image `pgvector/pgvector:0.8.6-pg18`, server **PostgreSQL 18.6**, local port 55438. The unadapted integration suite first **FAIL: 4 failed, 1 passed**, missing canonical identity tables. Adapted fixtures now use canonical active/platform identity columns and approved Masana publisher IDs; retained historical staff post/comment bytes and original upgrade/idempotency checks.
- `MASANAWA_TEST_DATABASE_URL=<disposable-test-url> /tmp/status-tools/node_modules/.bin/vitest run packages/feed/src/index.test.ts packages/feed/src/review.test.ts adapters/storage/postgres/src/home_feed/repository.test.ts adapters/storage/postgres/src/home_feed/review_repository.test.ts adapters/storage/postgres/src/home_feed/feed.integration.test.ts services/gateway/src/modules/home_feed/routes.test.ts tests/e2e/J06/feed-journey.test.ts`: **7 files / 50 tests PASS**, comprising **41 PASS_SIMULATED** units/injection cases and **9 PASS_REAL** disposable PostgreSQL integration tests.
- Real PG tests cover stable publication/idempotency conflicts, canonical follow filtering, tenant/fan reactions/comments/outbox, historic-comment preservation across 0002 upgrade applied twice, one-level reply constraints, denied staff/foreign publication, deactivation/nonplatform ownership/approval revocation read+write denial and recovery, immediate editorial denied-CAS rollback with retained draft, and scheduled denial/recovery releasing once with one audit.
- Actual fixture applies existing events 0001, feed 0001, feed 0002 twice and editorial 0004 to an isolated test DB. It uses minimal canonical identity tables. This is **not** a rehearsal of complete production identity/media migrations, feed 0003, backup/restore, real authenticated Flutter→Gateway→DB or provider/device E2E.
- Executed integration-test file Git blob **7e3dba96b5fc75a715c9213faf8c3fae437eddaa** matches pushed file at source checkpoint. `git diff --check` **PASS**.
- Own disposable test container is removed after verification; no production database, migration or external provider used.

### Closure / coordinator next action
Owned runtime source is implemented; strict scoped TypeScript, 50 Vitest cases including real PG authorization/recovery, 11 Node units, 8 Status Flutter widgets and 4 existing media widgets have executed successfully. The **whole Status journey remains PARTIAL_IMPLEMENTATION** because coordinator-owned shell/auth/media/Gateway composition remains disconnected or unverified on main, and whole-workspace CI still fails. No merge or release performed here.
Continue PR #671 on the existing integration target. Coordinator implements the exact five_tab_shell.dart / app_router.dart transfer, fixes the shared pnpm-lock.yaml importer and reruns full frozen install/typecheck/tests/build plus unified authenticated Status/device/restore checks. Missing local Flutter is no longer a universal execution blocker: CI has an actual qualified runner. Full identity migration, integration/source wiring, consumer binary and production proof remain explicitly pending. No further independent Status subsystem is needed.
