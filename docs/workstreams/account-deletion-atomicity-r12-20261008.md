# R12 atomic deletion verification and recovery — 2026-10-08

- Owner/window: ChatGPT, account privacy integrity continuation.
- Branch: `work/r12-deletion-atomicity-recovery-20261008` (stacked on PR #409), base SHA `405ff94f119dae26a96763705f07c0aae8e70c4c`.
- Reclaim rationale: #409's last repository-visible work was >5 minutes earlier. Preserve all its commits; do not edit or force-push its branch.
- Scope: fix *non-atomic deletion verification*, failed-request recovery and retry/replay weaknesses in #409. This does not claim final erasure is implemented.
- Exact owned paths: `packages/identity/src/account-deletion.ts`, `packages/identity/src/account-deletion.test.ts`, `packages/identity/src/account-deletion-repository.ts`, `packages/identity/migrations/0006_account_deletion_access_revocation.sql`, `adapters/storage/postgres/src/identity/account-deletion-access.ts`, `adapters/storage/postgres/src/identity/account-deletion-access.integration.test.ts`, `adapters/storage/postgres/src/identity/index.ts`, `adapters/storage/postgres/src/identity/account-deletion.ts`, `adapters/storage/postgres/src/identity/account-deletion.integration.test.ts`, `services/gateway/src/account_deletion.ts`, `services/gateway/src/account_deletion.test.ts`, `apps/mobile/lib/src/screens/settings/account_deletion_dialog.dart`, `apps/web/src/app/delete-account/page.tsx`, `docs/workstreams/account-deletion-atomicity-r12-20261008.md`.
- Shared dependencies: no Gateway composition or migrations edited without a fresh collision check. Trusted revocation adapter may update canonical identity state, account sessions and customer channel/push links only *after* a processing request with no stored obligations. It never mutates financial records/provider receipts and is not yet wired to a worker. Revocation receipt migration is additive and must not modify previously applied migration 0005.
- Latest activity: 2026-10-08 06:18 Africa/Lagos — atomic verification + fresh-financial-clearance revocation adapter and integration tests committed.
- Verification: TypeScript, Flutter and PostgreSQL integration tests authored but not executed on an allocated runner. PR #416 Actions 37731226033 and 37731226267 completed before any runner step (`steps=0`); do not claim application test success or failure.
- Handoff: do not merge or deploy #409 on the basis of source presence alone; all deletion transitions must be transactional and backed by verification/reconciliation evidence.

## Code checkpoint / acceptance evidence

- Atomic deletion code verification now locks request then challenge, checks the expected revision, applies wrong-code attempt accounting, advances to `identity-verified`, writes the immutable audit event and consumes the code inside **one** transaction. An audit failure rolls everything back; no consumed-code stranded request. Generic repositories cannot promote to verified through a caller-supplied boolean.
- A failed request may receive a *new purpose-bound challenge* and return to `identity-verified`, keeping its request ID, audit sequence and existing unsettled-obligation evidence; both mobile and external browser show the recovery flow.
- New migration `0006_account_deletion_access_revocation.sql` records one immutable access-revocation step per request, bound to a short-lived financial reconciliation reference. It does not claim deletion completion.
- `createPostgresAccountDeletionAccessRevoker` requires a trusted `AccountDeletionFinancialClearance` callback. It runs under the same DB transaction and deletion-request lock, rejects unqualified/stale clearance and outstanding holds, then disables the user identity, revokes platform sessions, unlinks private customer channels, removes push/presence records, disables owned personal-clone Characters and hides Twins, removes verification challenges and writes an idempotent receipt.
- **No permissive financial guard is wired to production.** The test-only guard proves adapter behavior but does not qualify wallet/Credits/earnings/crypto/AI Seat/payment settlement correctness. Do not compose this revoker until a real provider/ledger preflight guarantees no pending operations under appropriate transaction-scoped locks.
- PostgreSQL integration tests cover challenge rollback, replay, failed-state re-verification, prevention of early revocation, denial by financial guard, atomic revocation and idempotent immutable receipt. Real PostgreSQL execution remains unverified.

## Remaining R12 production gates

1. Implement and qualify the mandatory commerce/crypto/gifts/payout reconciliation guard, and prevent new financial operations while deletion processing begins; no stale balance snapshots.
2. Add worker-owned durable orchestration, replay leases/attempts and processor cleanup with policy-approved retention; do not infer full data erasure from access revocation.
3. Handle post-revocation progress lookup without reopening the disabled account and prevent relinking/reissued sessions, including concurrent writes.
4. Define Twin memory/chat/files, public Talk/replay/comment, and immutable financial audit data disposition with precise retention purposes and durations; route processor cleanup and support escalation.
5. Run typecheck/Vitest, isolated PostgreSQL migrations/integration, Flutter analyzer/device and external browser security tests, then deploy only through integration ownership. PRs #409/#416 remain draft and should merge sequentially after validation.
