# R15 — Authenticated private human-profile reporting: final per-window handoff

Updated UTC: 2026-10-08, GPT-6 human-profile-reporting window.
**Feature-slice status: IMPLEMENTED_UNVERIFIED (source present, executable gates not run). Whole R15: PARTIAL_IMPLEMENTATION / not DONE.** This is not proof of deployed service, operational moderation review or end-to-end acceptance.
**Five-minute claim:** original repository-visible claim commit `cb1a13fece7a0a2f7d34cbfb1d20d0b148d2bbb4`, followed by substantive source commits. Recheck live PR/branch activity before reclaiming; do not destroy code by lease expiry.

- **Base main**: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3` (rechecked after implementation).
- **Feature branch**: `work/r15-human-profile-safety-20261008-gpt6`.
- **Code/test HEAD before this handoff checkpoint**: `f93ecc024dd02b5b307324d9c903029608a29566`; final branch HEAD also recorded on PR #496 after handoff commit (do not mistake code HEAD for last documentation commit).
- **Draft PR**: https://github.com/Baatiku/masanawa/pull/496 — do not merge. Source-review and real tests required.
- **Requirements/journeys:** R15, T05, Q05, J03/J10/J11 safety/privacy checks. Existing real human public profiles remain separate from AI persona profiles and C02 human DMs. No five-tab shell/router changes.

## Exact owned code by layer

1. `apps/mobile/lib/src/screens/profile/person_profile_screen.dart`: concrete public *human* profile entry `Report profile`, requiring active canonical session. No spurious sixth tab.
2. `apps/mobile/lib/src/screens/profile/human_profile_report_sheet.dart`: reporter-scoped Riverpod form, canonical server reasons, optional 2000-char detail, genuine submit, loading/error, no false 200 success, account switch/relogin checks, locked retry payload and recover pending on reopen/restart.
3. `apps/mobile/lib/src/screens/profile/human_profile_report_transport.dart`: typed authenticated Dio request to pre-registered `POST /safety/reports`, normalized profile handle, expected signed-in user ID, exactly-one reporter-bound request ID, fail-closed on absent 202/accepted/reportId, no silent 401 replay across accounts.
4. `apps/mobile/lib/src/screens/profile/human_profile_report_journal.dart`: Android secure-storage reporter+profile-scoped pending report, cryptographically random 160-bit request id, persisted **before** dispatch, fail closed if stored record corrupt/unavailable; on ambiguous outcome, retain ID and exact reason/details for retry.
5. `services/gateway/src/talk_safety_routes.ts`: optional validated `expectedReporterUserId` in existing authenticated public report contract, backwards-compatible for existing clients. Existing Gateway app/main registration on `main` reused; no disconnected new route.
6. `services/gateway/src/talk_safety/service.ts`: canonical customer authorizer provides server-derived tenant/reporter; rejects stale expected reporter 409, normalizes human profile handle / qualified public-profile user ID to actual tenant-scoped immutable user id, rejects absent/self profile, then persists via the canonical report repository.
7. **Database/migrations**: reuse existing `packages/talks/migrations/0009_talk_safety.sql` (`talks.safety_reports` plus unique `tenant_id,reporter_user_id,client_request_id`) and `createPostgresTalkSafetyRepository.appendReport` with `ON CONFLICT ... RETURNING` idempotent report identity. No new migration or schema authority, no production DB modification.
8. Test source: `apps/mobile/test/human_profile_report_test.dart`, `apps/mobile/test/human_profile_report_transport_test.dart`, `services/gateway/src/talk_safety/human_profile_report.test.ts`, `services/gateway/src/human_profile_report_routes.test.ts`, `adapters/storage/postgres/src/human_profile_report_sql.integration.test.ts`.

**Deliberately not implemented as a false full feature**: human block/mute toggles are NOT exposed, because their existing server preference writes are not yet proven to enforce private human DMs/media/notifications and public discovery on every read. The owner must coordinate C01/C02/C03/R15 before claiming those fully complete. This feature only sends a **private report for moderation**. Human AI persona profile report PRs #489/#491 are distinct and retained.

## Executed vs unexecuted verification — exact status

**EXECUTED:** GitHub connector readback of current `main`, the created branch, PR #496, changed repository file paths, and successful push commits (source exists on GitHub). **Not an executable compiler/test result.** No simulated PASS. No database queries, migrations, provider, production or device actions executed.

**NOT EXECUTED (all require ChatGPT Work executable checkout or suitable local runner):**

```sh
git fetch origin main work/r15-human-profile-safety-20261008-gpt6
git checkout work/r15-human-profile-safety-20261008-gpt6
corepack pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm --filter @masanawa/postgres typecheck
pnpm exec vitest run services/gateway/src/talk_safety/human_profile_report.test.ts services/gateway/src/human_profile_report_routes.test.ts
# Use only a fresh, authorized, disposable Postgres database whose DB name includes test/disposable/ci.
MASANAWA_RUN_DISPOSABLE_SQL_TESTS=yes MASANAWA_TEST_DATABASE_URL='<safe-disposable-DSN>' pnpm exec vitest run adapters/storage/postgres/src/human_profile_report_sql.integration.test.ts
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/human_profile_report_test.dart test/human_profile_report_transport_test.dart test/talk_social_profiles_test.dart
flutter build apk --debug
```

**Blockers:** GitHub Actions incident #457 exhausts hosted Actions quota and fails before executing steps, no established CI pass. This connector-only workspace has no runnable repository checkout, no pnpm/Flutter/Dart or disposable database/test users/Android device, no service credentials. After observing blocker, did not repeatedly retry unavailable tests; source was still written. Do **not** weaken CI to green. R16 and #457/ChatGPT Work own runner and Android qualification.

**Proof required after sources compile**: two real customer sessions A/B, source profile B resolved within correct tenant, A POST /safety/reports 202 with persisted reportId, duplicate same ID after timeout and app kill returns same ID and one row, different reporter retains independent scope; expired bearer and user switch fail closed, non-owner/restricted/profile-not-found/no-login/malformed data denied, encrypted journal cannot surface after switching A→B, no public feed/notifications leak, Talk profile action works on low-memory real Android with accessibility and poor network. Inspect server/operator queue handoff for a stable `user_id` target, ensure dashboard can locate correct profile and moderation operation is actually staffed/retained.

## Dependency, ownership and conflict matrix

- C01 #468 and R18 #435 overlap shared Gateway `app.ts`/`main.ts` and their migrations. This lane did **not** touch those; existing `registerTalkSafetyRoutes` is already composed on main, so no new composer ownership requested.
- **New same-day shared human profile collision (IMPORTANT):** R15 block/mute PR #494 **independently edits** `apps/mobile/lib/src/screens/profile/person_profile_screen.dart` and originally used the same safety sheet/test paths as this branch; R17/C08 shell PR #493 also edits the exact shared human profile screen to implement authenticated New Message. After discovering these fresh PRs, this branch **renamed its new report paths** to `human_profile_report_sheet.dart`, `human_profile_report_transport.dart`, `human_profile_report_test.dart`, and `human_profile_report_transport_test.dart`, deleting its prior conflicting new sheet/test files. The only remaining shared Dart path is `person_profile_screen.dart`; final Work MUST combine #493's human DM action, #494's block/mute, and #496's report entry semantically. Do not overwrite any branch/merge blindly; no ownership of #494's preference UI was claimed. PR #497 is the active owner-designated Work integration coordinator; this handoff should be visible there. Check live #493/#494/#497 heads/leases before any shared edit.
- R15 AI persona reports #489/#491 overlap each other in `persona_profile_screen.dart`, `talk_safety.dart`, transport; this lane does **not** edit any of these. Preserve both for Work semantic reconciliation, do not mistake a human report for persona report.
- R15 #443 edits `talk_safety/repository.ts`; this lane does NOT edit that path. Existing PostgreSQL report behavior is reused. C02 #472/#475 and C05 #474/#476 are conflicting duplicated source and NOT merged here.
- **New shared path risk**: `services/gateway/src/talk_safety_routes.ts` and `service.ts` now edited additively; Work must compare all R15 active PRs and run compound service/route tests before merging. The optional field keeps existing report clients working.
- **Known contract qualification**: report `target.kind='profile'` now stores stable human `user_id` as `target_id`, while existing public-profile enforcement lookups often use handle. Do NOT assume moderation dashboard resolves this without source + real operator verification; coordinate stable ID lookup and handle changes. Return receipt indicates accepted only, never enforcement/completed action.
- **Data and security**: reporter derived from authenticated session; no JS model authority, financial writes or external providers, no new secrets; user and tenant isolation, on-disk encrypted journal with personal report detail and explicit review of retention/deletion policy by R12; account switch cannot reuse a different reporter ID. Mobile backup policy R16 and account deletion cleanup require broader verification.
- **Rollback**: stop exposing human profile report entry or revert feature branch; maintain canonical report schema, do not delete moderation records. Gateway forward-compatible optional body field. No live provider calls/irreversible mutations done in this window.

## Next exact Work integrator steps

1. Freeze live `main`, PR #496, shell PR #493, human-preferences PR #494, Work integrator PR #497 and all R15 branches and changed paths; confirm no new five-minute active lease and preserve AI persona #489/#491.
2. Checkout this branch, run the exact source/Flutter/Gateway/typecheck tests above; fix any executable compiler/format/widget errors in new code, commit tested SHA (do not invent PASS), compare optional report schema with existing client contracts.
3. Run the opt-in PostgreSQL disposable migration test, then real full Gateway service → customer auth → transactional Postgres → authoritative repeated read/insert through two independent logged-in identities, including wrong tenant/user/session and duplicate after kill/restart.
4. Validate identity target normalization and moderation operator lookup against the actual admin/report consumer; if user-ID vs handle mismatch exists, implement a forward-compatible mapping and migration/read model under coordinated R15 ownership before merge. Review data retention and account deletion.
5. Test real app with user A/B, slow/offline/relogin and low-memory Android, valid screen reader/small viewport text; run root app/safety regression suite and verify report UI in existing public-human route, not AI persona route.
6. Recheck CI #457 recovery and merger dependency matrix, then only upgrade source status when exact executed evidence exists. Leave PR #496 **draft/unmerged** while any gate remains unverified.

## Release gates (at code HEAD `f93ecc024dd02b5b307324d9c903029608a29566`)

| Gate | Evidence status |
| --- | --- |
| SOURCE_WRITTEN | YES, pushed implementation/tests on feature branch; compiler not run |
| LOCAL_TESTED | NO |
| CI_EXECUTED | NO (#457 quota) |
| DB_INTEGRATED | UNVERIFIED (schema/repository reuse only) |
| APP_INTEGRATED | SOURCE wired to human profile, UNVERIFIED on device |
| DEVICE_VERIFIED | NO |
| PROVIDER_QUALIFIED | N/A: no financial/media provider in this feature |
| DEPLOYED | NO |
| MERGED | NO — draft #496, do not auto merge |

**Formal disposition:** Implemented source for this narrowly bounded private human-profile report only, UNVERIFIED; whole R15 still PARTIAL_IMPLEMENTATION; never mark DONE until actual full end-to-end evidence and final Work integration.
