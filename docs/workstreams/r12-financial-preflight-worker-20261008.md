# R12 — Financial preflight and durable deletion worker
- Owner: ChatGPT identity/privacy workstream, 2026-10-08.
- Branch: `work/r12-financial-preflight-worker-20261008`; base main `af0f4254156a1d6d2745e47c3d07096aa0ed7980`.
- Scope: conservative real PostgreSQL financial-account exposure audit; durable leased worker to re-evaluate verified deletion requests and advance only to waiting/processing after trusted clearance; NO assertion of provider cleanup or final deletion.
- Exact owned paths: `adapters/storage/postgres/src/identity/account-deletion-financial.ts`, `adapters/storage/postgres/src/identity/account-deletion-access.ts`, `adapters/storage/postgres/src/identity/account-deletion-financial.integration.test.ts`, `adapters/storage/postgres/src/identity/account-deletion-queue.ts`, `adapters/storage/postgres/src/identity/account-deletion-queue.integration.test.ts`, `adapters/storage/postgres/src/identity/index.ts`, `packages/identity/migrations/0007_account_deletion_worker.sql`, `services/worker/src/account-deletion-runner.ts`, `services/worker/src/account-deletion-runner.test.ts`, `services/worker/src/account-deletion-main.ts`, `services/worker/package.json`, `docs/workstreams/r12-financial-preflight-worker-20261008.md`.
- Dependencies: current R12 server verification is merged in main; gated revocation and atomic verification landed through #424; disabled-account guards landed through #429. No overlap with other fresh claims or finance implementation files. Shared identity migration and export must be rechecked before each update.
- Locked safety: no provider callback, funds, ledger, statutory record, private data, or session is deleted by this worker. Any unverified financial footprint must block. Worker will never mark a request `completed`.
- Tests authored (worker Vitest + two PostgreSQL integration suites) but not executed: no local checkout or reachable GitHub from the build container and no confirmed allocated CI runner. Source committed; deployment and production schema migration not attempted. Last activity 2026-10-08 Africa/Lagos.

## Implemented scoped deliverables

- `0007_account_deletion_worker.sql`: durable per-request job row with claim lease, token, attempts, next due time, retry outcome and immutable audit of financial scan categories. This is additive; earlier R12 migrations remain unchanged.
- `createPostgresDeletionFinancialPreflight`: checks Billing quotes/fulfillments, NGN wallet/funding/reservations, crypto intents/ledger/actions, credit debit/receipts, creator commissions/transfers/attribution, voice/owner access, trials and Talk AI Seat records. Historic/settled activity is conservatively a **review flag**, never silently forgiven; query/schema failures abort the scan. Checks and an immutable scan reference are recorded in one database transaction. Uses canonical request and user locks.
- Clearance is **not granted by absence of history**. An optional *separate* `FinancialAdmissionFence` must prove that every synchronous/asynchronous money admission, settlement webhook and replay for that user is blocked. No such fence is installed by default. The existing R12 access-revocation adapter must not receive a permissive callback in production.
- `createPostgresAccountDeletionQueue`: idempotent bounded backfill of verified/pending review requests, `FOR UPDATE SKIP LOCKED` single-claimer leases, stale-token rejection, bounded retry delays, persistent outcomes and atomic request/audit advancement from verified to awaiting settlement. It cannot mark processing or completed.
- `createAccountDeletionRunner`: worker iteration with retry exponential backoff and pending-review result, without authorizing erasure.
- `services/worker/src/account-deletion-main.ts` + `start:privacy-reconciliation`: separate entrypoint opt-in through `MASANAWA_ACCOUNT_DELETION_RECONCILIATION_ENABLED=true`; refuses startup without explicit flag and database URL. Not wired into ordinary `worker` readiness/deployment and not launched by this PR.
- Tests authored: 5 worker runner tests; 4 PostgreSQL financial-preflight tests (including owned Twin float); 1 PostgreSQL lease/replay test. These are *not test-pass evidence* until an equipped runner executes them.

## Remaining professional release gates

1. Financial **admission fence** across NGN/Billing/Crypto, AI seats, gifts, Twin commissions, provider callbacks and settlement jobs, with real end-to-end race tests. A provider history flag does not prove balance/payout resolution. Accounts with any financial footprint require manual reviewed reconciliation in the meantime.
2. Canonical scope-controlled provider cleanup, object storage/media/chat/memory deletion, privacy-approved retained financial audit, public Talk/replay references, and a durable per-domain completion receipt. This worker does none of these.
3. R12 access revocation and disabled-account guards are merged on `main` (#424/#429) but must be fully tested before processing permission; this PR does not perform that integration or modify their branches.
4. Real PostgreSQL migration integration and concurrent worker tests on isolated database, TypeScript typecheck/build/Vitest, Flutter/web regression and production rollback tests; no local test runner available in this turn.
5. Qualified deployment and monitored operations, store privacy disclosures, retention schedules and externally usable request URL. **Do not claim deletion or Play Store readiness.**

## Reproducible verification commands
```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test:ci
pnpm -r build
# Set an ISOLATED TEST database, then run the PostgreSQL integration suites
MASANAWA_TEST_DATABASE_URL=postgres://... pnpm exec vitest run   adapters/storage/postgres/src/identity/account-deletion-financial.integration.test.ts   adapters/storage/postgres/src/identity/account-deletion-queue.integration.test.ts
```

Integration order: merged intake/verification on `main` first, preserve the integrated R12 changes on main, then consider this bounded worker after checks. The worker is deliberately **not an automated erasure process**.

## Freshness clock integration

The previous access revoker compared financial evidence to the requester's timestamp; the new DB scan is recorded at PostgreSQL clock time, so a valid scan could appear to be in the future. This lane updates the adapter to compare against a trusted database clock instead. It does not authorize revocation with the default unqualified fence.

## PR and CI status

Draft PR #430 targets main. Workflow 37733043801 failed with zero executed steps; no code or database test result is established. Local clone failed due to GitHub DNS resolution. This workstream remains unverified and not deployed.

## Most recent safety coverage

- Follow-up review added owner-scoped Twin ledger matching via `identity.character_ownership` and the character debit/credit columns of `commerce.ledger_entries`; financial exposure must not be missed merely because credits are held in an owned Twin's float.
- Added integration test where the human has no direct ledger rows but their personal Twin holds agent-float. Expected finding: `owned-twin-ledger`. This is authored only; PostgreSQL has not executed the test here.
