# Shared CI recovery — ChatGPT Work

Owner: ChatGPT Work shared integration session. Updated 2026-10-08T07:02:00Z.
Branch: `work/shared-ci-recovery-work-20261008`. Base main: `f4cd25420ae24be78cddd7c3d17bdc34e0f8a060`.
Task: issue #457, shared executable CI and outstanding PR verification, including preservation of R16 PR #455.
Owned paths: this file. Workflow edits require fresh coordination and demonstrated need; feature source paths, migrations, secrets, deployments and other windows' changes remain unclaimed.
Lease: five minutes from substantive repository-visible work, not a permanent reservation.

## Confirmed infrastructure cause

Foundation job 113177066835 / run 37736482648 reports runner_id=0, zero steps. Authenticated GitHub UI annotation: job not started because recent account payments failed or spending limit needs increasing.
Authenticated Billing overview resolves the cause: Actions minutes **2,000 used / 2,000 included**, reset in **24 days**. Actions budget is **$0**, **Stop usage Yes**, **100% utilization**. Billable usage $0; gross usage and included discounts both $12.21. Account is GitHub Free. This is exhausted included Actions minutes with paid overage stopped, not an observed application test failure.

No spending limit, payment method, repository visibility, security protection or runner access has been changed. Enabling paid overage requires owner financial authorization; runner registration requires a separate secure infrastructure decision. Do not weaken tests to hide the incident.

## Recovery in progress

Direct terminal git clone fails for missing HTTPS credentials. Authenticated browser archive download returned a path but no file became available. Connector source recovery and local dependency/test execution are being attempted. Node 24.19.0 is present; default pnpm 11.25.0 differs from repository-required 12.8.2; Flutter not on PATH. These are independent environment gaps, not proof of code failure.

## Verification truth

No PR merged in this session. No new executable Foundation/Mobile Actions run, Flutter build, provider operation or device acceptance yet. R01–R19 remain qualified only by their existing evidence; no DONE status changes.

Next: recover exact immutable source and dependency toolchain; run main baseline, then each PR delta with isolated snapshots, preserve active lanes and publish exact results. Issue #457 remains OPEN until Foundation and Mobile jobs actually execute and affected PRs are verified.

## Executable recovery update — 2026-10-08T07:11:00Z

Installed repository-pinned pnpm 12.8.2 (actual version verified) with Node 24.19.0. Official Flutter stable source checkout succeeded at 5fc346839b5d0eef006ed8404392afb4dfae428d; Dart engine SDK downloaded, Flutter tool dependency bootstrap is running. Connector snapshot recovery has passed 800 files at immutable main tree 7971269d71c13227f3667bc1a8233395d4b81ada. Browser archive did not materialize; no success inferred. Reviewed exact PR #455 changed files and diff; no duplicate R16 implementation. Current queue has 25 feature PRs plus this coordination PR, all draft/unmerged. Ubuntu packaged PostgreSQL is 16.15, not required PostgreSQL 18; no canonical DB test pass inferred from that version.

## Baseline diagnosis and bounded repair claim — 2026-10-08T07:25:38.966Z

Pinned pnpm frozen install passed. Flutter 3.47.6 / Dart 3.13.5 bootstrapped with CI analytics disabled; pub get completed, SDK-generated config changes are not implementation. Main typecheck fails on a test importing TalkId from the wrong module. Main Vitest: 219 files passed, 15 failed, 20 skipped; 1186 tests passed, 22 failed, 143 skipped. PostgreSQL18 integration remains unexecuted. Logs retained in Work workspace.

Claim additionally owns these bounded baseline test repairs:
- `packages/agents/src/talk-replay.test.ts`
- `services/gateway/src/talk_safety/replay_bridge.test.ts`
- `services/gateway/src/talk_profiles/postgres_repository.test.ts`
- `services/gateway/src/talk_ranking/ranking.test.ts`
- `services/gateway/src/talk_safety/enforcement_integration.test.ts`
- `services/gateway/src/customer_channel_twin_routing.test.ts`
- `packages/identity/src/account-deletion.test.ts`
- `services/gateway/src/main.test.ts`

These repair stale imports, canonical SQL mocks, timestamp fixtures and finalization fixtures; production security guards remain intact. Independent read-only diagnostics also identified genuine worker stop races (coordinate with #448) and request validation/profile persistence failures (not yet claimed). No feature production source or other PR branch is owned or overwritten. PR #455 remains preserved/unverified. Hosted CI still blocked by quota; no merges or DONE claims.

## Verified bounded repairs — 2026-10-08T07:27:19.859Z

Eight claimed test repairs implemented. Targeted checks: replay 2 files/14 tests; social safety/ranking/channels 4 files/23 tests; deletion/startup 2 files/10 tests, all passed. Agents package typecheck passed. Full workspace typecheck in progress. No production security rule was relaxed. Flutter baseline analyze executed: 481 issues; tests/build qualification remains open. No hosted CI execution or merge.

## Next bounded repair claim — 2026-10-08T07:28:47.505Z

Main build passed (Node24/pnpm12.8.2). Full typecheck continues to expose stale test typing; eighteen of twenty individual workspace checks passed, postgres and Gateway failed. Flutter source blob checks confirm two gift recovery Dart files contain actual broken regex/trailing duplicate bodies; locale controller getter shadows @override. Claim adds exact paths:
- `apps/mobile/lib/src/talks/talk_gift_http_transport.dart`
- `apps/mobile/lib/src/talks/talk_gift_pending_store.dart`
- `apps/mobile/lib/src/localization/locale_preference.dart`
- `adapters/storage/postgres/src/identity/account-deletion-access.integration.test.ts`
- `services/gateway/src/strict_request_body.ts`
- `services/gateway/src/talk_gift_routes.ts`
- `services/gateway/src/talk_profile_routes.ts`
- `services/gateway/src/talk_profile_routes.test.ts`

Gift/profile schemas currently silently discard forged extra fields with Fastify default AJV. Bounded pre-validation will reject before service mutation; no global app settings changed, no overlapping PR446 test edits. Profile saved-read failure is a mock returning hardcoded stale values, not demonstrated database overwrite. PR435 composition/avatar changes preserved. No merge or provider/device acceptance.

## Executable repair results — 2026-10-08T07:31:14.395Z

Gift transport/store syntax restored; 13 Flutter recovery tests passed, existing durable fingerprint preserved. Locale annotation scope repaired; 12 preference/language tests passed. Gift/profile strict pre-validation now rejects unknown authority fields before schema stripping; 21 route tests passed. Saved profile-read fixture now reflects actual saved fields. PostgreSQL adapter typecheck passed after widening UUID test fixture storage to canonical string. Main production build passed. First full repaired Vitest rerun:226 files passed,8 failed,20 skipped;1199 passed,10 failed,143 skipped. Provider-tool unit run:17 passed,1 failed (runner import invokes main with missing production inputs, investigation underway; no provider request made). Latest queue includes new Firebase PR461; preserved.

Next additional bounded test fixture claim: `apps/mobile/test/agent_directory_readiness_test.dart` and `apps/mobile/test/agent_recovery_test.dart`. Malformed availability stays unknown; transient refresh preserves persona roster while invalidating presence rather than equating rebuilt object identities. No production fallback changes authorized by these repairs. PR455 independent verification begins; no merge.
