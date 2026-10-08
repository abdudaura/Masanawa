# R15 — private Expert/Twin persona reporting handoff, 2026-10-08

## Claimed owner, branch, SHA, truth status
Owner: GPT-6, R15 bounded private persona report action.
Main base SHA: 1d6a67ea3c182455b55a7d1d07eacdb4311682e3.
Branch: work/r15-persona-reporting-20261008-gpt6.
Original feature/test snapshot: ca28c3bc42e58b53e0f893375a1ec59600de353d. Subsequent secure UUID reconciliation: ecd18deae2e96c45c9a9c9ce61b5e7eef1c2d17d. Test fixture syntax correction: cc623e88413a443d754d60cda5652c713fce18aa.
Final handoff HEAD: inspect latest draft PR #491 commit after this document is saved.
Draft PR: https://github.com/Baatiku/masanawa/pull/491 (OPEN, DRAFT, UNMERGED).
Claim from 2026-10-08 12:43 Africa/Lagos, renewed by concrete commit/push.
Traceability: R15, P07, N05, Q05, T05, A08, J06/J11.
**IMPLEMENTED_UNVERIFIED for bounded reporting action only; R15 and J06/J11 NOT COMPLETE.** Verified E2E: NO; production: NO; feature DONE: NO.

## Changed exact files by layer
- apps/mobile/lib/src/screens/profile/persona_profile_screen.dart — Expert/Twin server-loaded publicId, real report entry.
- apps/mobile/lib/src/screens/profile/persona_report_sheet.dart — reason/details, deliberate send, recovery, real receipt, denied/failed/cross-account states.
- apps/mobile/lib/src/screens/profile/persona_report_journal.dart — encrypted user+persona-scoped pending request written BEFORE remote POST; stable idempotency key recovered after app kill; corrupt/locked storage fails closed.
- apps/mobile/lib/src/talks/talk_safety.dart — typed reportTarget optional idempotency request key.
- apps/mobile/lib/src/talks/talk_safety_http_transport.dart — bearer injected/rotated by canonical ApiClient, exact persona target, HTTP 202 + accepted:true + reportId required.
- apps/mobile/test/persona_report_sheet_test.dart — retry/restore/account-signed-out negative widget cases.
- apps/mobile/test/persona_report_journal_test.dart — owner/tamper/recovery tests.
- apps/mobile/test/talk_safety_http_transport_test.dart — authentication/header, request/receipt/invalid case tests.
- apps/mobile/test/talk_screen_test.dart — backwards-compatible fake signature after typed interface change.
- services/gateway/src/talk_safety/persona_report.test.ts — Fastify injected authenticated report/idempotency/invalid two-user tests.
- adapters/storage/postgres/src/talk_safety_report.integration.test.ts — REAL Postgres integration harness; not executed.
- docs/workstreams/r15-persona-reporting-20261008.md — this handoff.

No new schema, shared Gateway composer, root Flutter router, finance, provider or secrets changes. Existing migration packages/talks/migrations/0009_talk_safety.sql defines private talks.safety_reports and UNIQUE (tenant_id, reporter_user_id, client_request_id); existing services/gateway/src/talk_safety/repository.ts preserves reportId on ON CONFLICT. Existing services/gateway/src/talk_safety/service.ts derives tenant/reporter from verified customer bearer. Existing services/gateway/src/talk_safety_routes.ts POST /safety/reports is already conditionally registered through services/gateway/src/app.ts and main.ts. No mock/new backend route masquerades as real. The production deployment of route/DB is NOT verified.

The UI always uses server-retrieved persona publicId, a selected safe reason/optional details, and current canonical session. The journal is written before POST so an uncertain response and app restart retry the identical owner/persona/reason/detail/clientRequestId. Successful report requires actual server receipt, then clears journal; failed clear retains safe same request key. Signout/account changes abort subsequent sends, and an old-account async response cannot display success. No public audio, wallet, AI Seat or autonomous operator access is created. Scope is tap/text profile safety reporting, NOT C07 voice-generated task execution.

## Concurrent duplicate — explicit MERGE STOP, preserve both PRs
During this window a second R15 persona-report PR #489 appeared, created at 2026-10-08 11:48:36Z, after our first repository-visible R15 claim at approximately 11:43Z. Its SHA 73a392342cfc7d9487edfbf9b0781076a8d3b9b6 and branch work/r15-persona-profile-report-20261008-gpt6 overlap the same four profile/report Flutter files, but offer different UI/test approaches. PR #489 already declares itself superseded in favor of #491 pending semantic consolidation; **NEITHER SHOULD MERGE INDEPENDENTLY**. We reviewed #489 and adopted its stronger existing core/request_id.dart cryptographic UUIDv7 generator in #491 (commit ecd18deae2e96c45c9a9c9ce61b5e7eef1c2d17d) instead of our previous timestamp+counter. #491 alone currently implements encrypted restart-persistent report journal and session-switch/reply-ack fencing; #489 may have distinct tests useful for integration. Final Work must diff both, elect one authoritative profile UI/report transport, port useful tests, keep both SHAs as recovery evidence, and run the same E2E gates. Do not cherry-pick both complete report sheets.

## Collision review and residual risks
At claim: active C01 #468, C02 duplicate #472/#475, C03 #473/#483, C04 #478, C05 duplicate #474/#476, C07 #480, R03 #441, R18 #435 and CI #457/#460; R15 older #443/#446/#450/#451 last observed ~06:00Z own nonoverlapping AI Seats/gifts/replays/channel work. Never overwrite old branch evidence, or edit shared app.ts/main.ts or the five-tab router.
Operational gaps: R12 account-deletion/logout purge of unconfirmed local journal; Android keystore/backup settings must be verified under R16; moderation policy for now-invalid persona target IDs may require product clarification. Server report receipt, once-only SQL and per-user tenant isolation must be exercised against actual DB/real auth. No claim that an unverified locale is translated or that Gwani voice can initiate a report.

## Evidence, explicit NOT executed
SOURCE_WRITTEN=YES (only this bounded action); TESTS_WRITTEN=YES.
LOCAL_TESTED=NO (no usable pnpm, Flutter/Dart SDK/full GitHub clone in this execution environment).
CI_EXECUTED=NO (shared GitHub Actions issue #457 documents exhausted quota/zero-step jobs; says nothing about code success/failure).
DB_INTEGRATED=NO (Postgres harness source present, not run).
APP_INTEGRATED=source path linked; NO runtime/analyzer/device evidence.
DEVICE_VERIFIED=NO; PROVIDER_QUALIFIED=not applicable for private safety report; DEPLOYED=NO; MERGED=NO; E2E=NO.
No real signed-in two-user HTTP, tenant-negative, Android Keystore, DB migration, backup/restore, Flutter release build or production readback evidence. This feature is not DONE.

## Exact final ChatGPT Work commands and sequence
1. Inspect live main, drafts PR #491 AND DUPLICATE #489 SHAs/changed paths/claims. Reconcile secure request key + tests; retain both histories. Preserve all existing R/C PRs, especially duplicate C02/C05 and C01/R18 shared files. Check this SHA handoff against current PR, no force-push.
2. Node 24 / pnpm 12: run 'pnpm install --frozen-lockfile', 'pnpm typecheck', 'pnpm exec vitest run services/gateway/src/talk_safety/persona_report.test.ts services/gateway/src/talk_safety_routes.test.ts services/gateway/src/talk_safety/service.test.ts services/gateway/src/talk_safety/repository.test.ts', 'pnpm test:ci'. Fix any code/test failures without weakening checks.
3. Provision ISOLATED EMPTY disposable PostgreSQL per docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md, set MASANAWA_TEST_DATABASE_URL, run 'pnpm exec vitest run adapters/storage/postgres/src/talk_safety_report.integration.test.ts'. Adjust migration dependencies only after inspecting canonical manifest. Verify UNIQUE under concurrent retries, two accounts/tenants, invalid reasons and server readback after restart; never use production as scratch DB.
4. Flutter SDK: cd apps/mobile; flutter pub get; dart format --output=none --set-exit-if-changed lib/src/screens/profile/persona_report_sheet.dart lib/src/screens/profile/persona_report_journal.dart lib/src/screens/profile/persona_profile_screen.dart lib/src/talks/talk_safety.dart lib/src/talks/talk_safety_http_transport.dart test/persona_report_sheet_test.dart test/persona_report_journal_test.dart test/talk_safety_http_transport_test.dart; flutter analyze; flutter test test/persona_report_sheet_test.dart test/persona_report_journal_test.dart test/talk_safety_http_transport_test.dart test/talk_social_profiles_test.dart test/talk_screen_test.dart; flutter test; flutter build apk --release. Review 320dp large text/RTL, keyboard overflow, Keystore and old fake API compatibility. Commit fixes.
5. With two live authenticated customer users and real deployed Gateway SHA: report Expert/Twin, assert HTTP 202 reportId, DB persistence, role/tenant privacy, 401/403, token refresh, signed-out/rotating identity, duplicate/lost response/reboot, journal restore, keystore failure, disabled/deleted persona target and application readiness endpoint. Review R12 deletion/revocation cleanup.
6. Central Work fixes #457, runs actual CI/Flutter/DB/device tests, records logs/verified SHAs, reviews ownership collisions, and merges ONLY after exact real E2E & privacy gates. Otherwise leave PR DRAFT/UNMERGED, with explicit blocker.
7. Write outcome into docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md and final central integration matrix. Maintain open remaining R15 security/channel tasks.

Rollback: reversion removes new UI, stable-key transport extension, local encrypted pending report and tests; no production DB, provider account or migration was modified in this window.
