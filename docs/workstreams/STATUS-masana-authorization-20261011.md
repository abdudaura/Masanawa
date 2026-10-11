# STATUS — Masana publishing/feed authorization and display recovery

Owner: Codex STATUS implementation window. Date: 2026-10-11 UTC.
PR: https://github.com/weavewellindustrieslimited/masanawa/pull/671
Branch: lane/status-masana-authorization-20261011
Base: integration/rebuild @ e33490013c54a9dc3a86c8fcb526a01634df3992
Implemented and executed source HEAD: 9b01f5e99289ab493370fafe510d1ba6f118a821
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
- adapters/storage/postgres/src/home_feed/review_repository.ts
- adapters/storage/postgres/src/home_feed/review_repository.test.ts
- apps/mobile/lib/src/features/home_feed/feed_screen.dart
- apps/mobile/test/features/home_feed/feed_screen_test.dart
- tests/e2e/J06/status_authorization.test.mjs
- docs/workstreams/STATUS-masana-authorization-20261011.md

No financial, auth authority, shared shell/router, Gateway composition, localization catalogs, migration registration, manifest/lockfile or prohibited call source changed.

## Connected source / finite closure (J06, C21, A05/A06)
| Item | Owner / paths | Source | Executed result |
| --- | --- | --- | --- |
| Masana-only direct publication; reject fan, staff bypass, spoofed/unapproved identity and invalid text/media | STATUS / feed index | IMPLEMENTED_UNVERIFIED, 9b01f5e99289ab493370fafe510d1ba6f118a821 | PASS_SIMULATED Node source units |
| Reuse independent staff draft/review authority; repair blocking validator syntax | STATUS / review.ts | IMPLEMENTED_UNVERIFIED | Before repair runtime parser FAIL reproduced; fixed source parser and independent-review unit PASS |
| Feed/detail/comment read and reaction/comment insert recheck approved active platform author in tenant | STATUS / feed repository | IMPLEMENTED_UNVERIFIED | PASS_SIMULATED SQL-contract/mocked-pool cases; real PG NOT_RUN |
| Final immediate approval, scheduling and due publication SQL recheck current author eligibility | STATUS / review repository | IMPLEMENTED_UNVERIFIED | PASS_SIMULATED denial/rollback/no-audit tests; real PG races NOT_RUN |
| Feed disable/account replacement invalidate responses, reset pagination and clear projections; revoked session clears posts; offline refresh retains same-account content; reactions serialize/rollback/retry; pagination error retry; short lists refresh | STATUS / feed_screen.dart | IMPLEMENTED_UNVERIFIED | 8 total Flutter widget cases authored, NOT_RUN |
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
- GitHub exact-source readback for all 10 source/test paths at 9b01f5e99289ab493370fafe510d1ba6f118a821: matched the executed local snapshot byte for byte. This is source integrity evidence, not runtime E2E.
- `git clone https://github.com/weavewellindustrieslimited/masanawa.git /workspace/masanawa`: **BLOCKED**, configured proxy port 8080 unreachable. No proxy bypass attempted.
- `pnpm --filter @masanawa/feed typecheck` in the isolated snapshot: printed **No projects found**, NOT_RUN despite exit code 0. Full manifests/dependencies are absent; no compilation pass claimed.
- `command -v flutter`, `command -v dart`, `command -v psql`: absent. Flutter analyzer/widgets/APK and actual PG18 qualification **NOT_RUN/BLOCKED**.
- Exact-source CI Foundation run 38173645321, job 114571321074: **FAIL**, real steps ran. Install failed ERR_PNPM_PACKAGE_MANAGER_NO_IMPORTER because pnpm-lock.yaml lacks importers[packages/feed]; Typecheck skipped, Test/Build failed at dependency setup, actual Vitest/PG tests did not execute. Eighteen separate provider-tooling tests passed, not Status or provider E2E. Runner checked PR merge ref 79b1f6cd19df6a0ba9c87671d67a0bf349088cfe (source 9b01f5e into integration base 5ebc77a1). Coordinator exclusively owns pnpm-lock.yaml: regenerate against current workspace with pnpm 12.8.2, preserve all importers/pinned versions, rerun the checks; this lane has not edited the lockfile. Mobile Build 38173645324 has a real Flutter runner and was still in progress; local Flutter unavailable does not mean CI unavailable. Inspect actual widget/analyzer/build steps before integration. Combined Vercel failed build-rate-limit; no Status test failure established by that status.

## Bounded repository-visible transfer request to coordinating window
Requested shared path: **apps/mobile/lib/src/shell/five_tab_shell.dart** (owner retains authority; this lane has NOT edited it).
1. Retain #668 Chats · Status · Wallet · Calls · Rooms, Chats launch default, Wallet and calls behavior.
2. Replace Status's current TalkHomeScreen with existing `MasanaFeedScreen` and `DioFeedApi(existingAuthenticatedDio)`; supply a canonical current-account key, enable state and existing approved-media/profile/report bindings.
3. Remove Status `FloatingActionButton` “New status” pointing at `/talk/create`. Humans cannot publish consumer Status. Staff publish only through existing independent A05/A06 editorial workflow; approved Masana service identities use the canonical service.
4. Clear/pop nested post/comment/media screens on logout/account replacement. Passing a frozen prior-account key into a pushed route is not account replacement.
5. If adopting this feature from integration into main, keep #668 shell/source intact and transplant these 11 scoped paths only; do not merge the unrelated historical integration tree over main. This PR targets the coordinator's existing non-deploying integration/rebuild, never auto-merge main.

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
Exact added path: apps/mobile/lib/src/features/home_feed/feed_media_screen.dart. Actual Flutter analyzer at PR merge SHA 79b1f6c reports expected ')' at line 136 in Slider callback. Fix the missing Slider closing parenthesis, retaining existing C23 signed-media/audio behavior and tests. Prior media owner is released and no unreleased overlapping registry owner found. The separate MyTwinRouteScreen error at shared app_router.dart:236 remains with coordinator; do not restore retired Twin onboarding.
