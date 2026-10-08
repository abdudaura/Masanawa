# R12 Account deletion entry — 2026-10-08

- Owner/window: ChatGPT R12 account deletion entry
- Branch: `work/r12-account-deletion-entry-20261008`
- Base SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
- Task: R12 Settings deletion entry and pure request lifecycle; Gateway endpoints, persistence, migrations and cleanup worker are not claimed.
- Exact owned paths: `apps/mobile/lib/src/screens/settings/settings_screen.dart`, `packages/identity/src/account-deletion.ts`, `packages/identity/src/account-deletion.test.ts`, `packages/identity/src/account-deletion-repository.ts`, `packages/identity/src/index.ts`, `packages/identity/migrations/0005_account_deletion_requests.sql`, `adapters/storage/postgres/src/identity/account-deletion.ts`, `adapters/storage/postgres/src/identity/index.ts`, `services/gateway/src/account_deletion.ts`, `services/gateway/src/account_deletion_routes.ts`, `services/gateway/src/account_deletion.test.ts`, `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, `adapters/storage/postgres/src/index.ts`, `docs/workstreams/account-deletion-entry-r12-20261008.md` (shared app/main/export/migration paths: recheck for conflicts immediately before editing).
- Dependencies: coordinated shared Gateway registration and migration; operator/provider cleanup worker, financial reconciliation, external request URL require separate integration ownership.
- Current step: claim expanded to implement durable account deletion request API using existing authentication and PostgreSQL. Recheck ownership before touching shared app/main/migrations.
- Implementation: Settings 8158bcd; lifecycle 3709cdac, failure re-verification 8ae6b173, settlement/self-transition defenses ceafa2cf; tests e79f52c2 (seven Vitest test cases). No executable tests run in connector; build/deployment/device: NOT VERIFIED.
- Last update: 2026-10-08 after e79f52c2.
- Handoff: R12 remains OPEN. Next integrate a real authenticated durable deletion-request API, secure reauthentication, asynchronous revocation/cleanup/reconciliation, external request page and tests. Replace informational modal only when backend and support mechanism are genuinely available. Do not classify this UI as successful account deletion.

## Integration blocker and next bounded steps

This is intentionally **not an account deletion endpoint**. The booleans `identityReauthenticated` and `cleanupComplete` are trusted-only inputs; untrusted clients must never supply or control them. Persist requests with uniqueness by tenant/user and revisions (compare-and-swap), implement server-confirmed recent authentication and reconciled financial hold checks, enqueue idempotent revocation/erasure jobs, audit processor responses and reconcile outstanding obligations. Only after durable completion should Settings show success. Additional independent task: external authenticated/unauthenticated request intake and privacy disclosures. The source currently has no release-wired export or Gateway handler; these need coordinated integration ownership.
