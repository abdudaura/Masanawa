# J01 C04 fan setup — acceptance and composition contract

Claim: L-SHELL/J01, feature-local paths. This is source, not a device proof.

1. Authenticate through the existing OTP/session authority. Guest GET/PATCH /v1/me denied 401; disabled flag returns 503. Never trust a caller-supplied tenant, user, age-verification or role.
2. GET /v1/me returns only the actor's active identity record; PATCH validates 2-60 characters, Hausa/English, up to five approved interests, explicit 18+ self-attestation and the one-time AI disclosure. An attestation is not verified date of birth.
3. Verify optional avatar via the existing account-owned upload service. Reject arbitrary URLs/unverified media. Photo is optional and may be unavailable.
4. Atomic account-scope revision CAS on PATCH. Identical retry returns current revision without another write; stale divergent data receives 409 with client reload. Do not alter financial tables, receipts or historical migrations.
5. Suggested followers use existing approved GET /v1/masana; actual Follow uses existing POST /v1/masana/:id/follow and its established counter worker. No second worker/journal, human contacts or user-created posts.
6. Flutter: pending, offline, disabled, denied, input error, retry, account switch, and server-confirmed completion states; verify with low-end device and 200% font scale.
7. AF00 must check for existing GET/PATCH /v1/me routes, mount this exactly once through existing trusted auth and session-scoped Dio, supply the verified avatar picker, add fanSetup_* keys to app_en/app_ha ARB and register the C04 destination after sign-up/restore. Do not activate private fan actions until the age-guard integration is qualified.
8. Source schema packages/identity/migrations/0007_fan_setup.sql is additive to existing identity.users and should be included by the canonical identity migration root. PG18 fresh, upgrade and checksum tests remain required.
9. Execute: pnpm --filter @masanawa/identity typecheck; pnpm --filter @masanawa/postgres typecheck; pnpm --filter @masanawa/gateway-service typecheck; pnpm exec vitest run packages/identity/src/fan_setup.test.ts services/gateway/src/modules/account/fan_setup_routes.test.ts adapters/storage/postgres/src/account/fan_setup.test.ts; cd apps/mobile && flutter analyze && flutter test test/features/account/fan_setup_screen_test.dart && flutter build apk --debug. Full J01 on device, migrations on a disposable staging restore and rollback rehearsal precede release.

No new background job: setup commits synchronously and follows reuse the existing Masana follow outbox consumer. No duplicate auth, ledger or media service.
