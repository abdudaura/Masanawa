# R12 Account deletion entry — 2026-10-08

- Owner/window: ChatGPT R12 account deletion entry
- Branch: `work/r12-account-deletion-entry-20261008`
- Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
- Task: R12 Settings deletion entry and pure request lifecycle; Gateway endpoints, persistence, migrations and cleanup worker are not claimed.
- Exact owned paths: `apps/mobile/lib/src/screens/settings/settings_screen.dart`, `apps/mobile/lib/src/screens/settings/account_deletion_dialog.dart`, `apps/mobile/lib/src/core/network/api_client.dart`, `apps/mobile/lib/src/core/api/account_deletion_models.dart`, `apps/mobile/test/account_deletion_transport_test.dart`, `packages/identity/src/account-deletion.ts`, `packages/identity/src/account-deletion.test.ts`, `packages/identity/src/account-deletion-repository.ts`, `packages/identity/src/index.ts`, `packages/identity/migrations/0005_account_deletion_requests.sql`, `adapters/storage/postgres/src/identity/account-deletion.ts`, `adapters/storage/postgres/src/identity/account-deletion.integration.test.ts`, `adapters/storage/postgres/src/identity/index.ts`, `services/gateway/src/account_deletion.ts`, `services/gateway/src/account_deletion_routes.ts`, `services/gateway/src/account_deletion.test.ts`, `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, `adapters/storage/postgres/src/index.ts`, `docs/workstreams/account-deletion-entry-r12-20261008.md` (shared app/main/export/migration paths: recheck for conflicts immediately before editing).
- Dependencies: coordinated shared Gateway registration and migration; operator/provider cleanup worker, financial reconciliation, external request URL require separate integration ownership.
- Current step: durable request/OTP infrastructure and server-authenticated Gateway routes composed, mobile request/status/verification wired; final erasure worker and external request channel still missing.
- Implementation: implemented request table, append-only audit, purpose-scoped OTP challenge, transactional revision-checked PostgreSQL adapter, Gateway request/verify/status, Resend/SMS sending, mobile typed transport and Settings dialog. Tests authored: seven identity, seven Gateway, four PG integration, two Flutter transport/model. Tests NOT EXECUTED locally. CI runs 37711718729 and 37711718758 both failed before runner assignment (0 steps); no application test conclusion. Latest Settings/About correction 34bad1136c20d7272adcb9ecd066128af4609202; PR head is authoritative, recheck on merge.
- Last update: 2026-10-08 after R12 Gateway/mobile/SQL integration checkpoints.
- Handoff: R12 remains PARTIAL. Backend accepts and securely verifies deletion requests, but DOES NOT perform deletion or revoke sessions. Implement retention/financial decision, server-side cleanup and processor propagation, external deletion page and support operations before release. Do not advertise compliance or completion. Keep PR draft until Flutter/TypeScript/PostgreSQL tests and main merge readiness verified.

## Integration blocker and next bounded steps

This is intentionally **not an account deletion endpoint**. The booleans `identityReauthenticated` and `cleanupComplete` are trusted-only inputs; untrusted clients must never supply or control them. Persist requests with uniqueness by tenant/user and revisions (compare-and-swap), implement server-confirmed recent authentication and reconciled financial hold checks, enqueue idempotent revocation/erasure jobs, audit processor responses and reconcile outstanding obligations. Only after durable completion should Settings show success. Additional independent task: external authenticated/unauthenticated request intake and privacy disclosures. The source currently has no release-wired export or Gateway handler; these need coordinated integration ownership.

## Security review and evidence

- Signed-in session is the only owner identifier; untrusted request body cannot choose a tenant or user.
- Verification code is deletion-purpose HMAC-bound to the server-assigned request/user and stored as a hash with expiry, resend cooldown and five-attempt lock.
- Concurrent create is idempotent per tenant/user; state changes lock and compare revisions, with append-only audit in same DB transaction.
- User-facing response contains only request ID, phase, revision and dates; no financial obligations, PII or internal error records.
- Verified request remains pending until trusted server cleanup; no optimistic wallet, channel, Twin or session revocation.
- Remaining failure/reliability tests: real PostgreSQL migration/rollback, provider/unsettled-asset gating, deletion worker crash/replay, cross-channel cleanup, archived public Talk retention, and signed-in/out external request intake.
- App and CI checks: Flutter analyzer/tests, TypeScript typecheck/Vitest and database integration all still need an allocated runner or equipped developer environment. CI zero-step failures are infrastructure evidence only.
