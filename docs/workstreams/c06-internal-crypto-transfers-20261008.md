# C06 internal crypto transfers — source claim, precise Work handoff (2026-10-08)

**Status: PARTIAL_IMPLEMENTATION. NOT DONE. NOT VERIFIED. NOT DEPLOYED. DO NOT MERGE.**
Owner: GPT-6 independent C06 window; source branch `work/c06-internal-crypto-transfer-20261008-gpt6`; original main base SHA `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. Draft PR [#487](https://github.com/Baatiku/masanawa/pull/487) is the authoritative current branch head. Source claim first committed as `856a0db5623cf0aa32100a05fbd326f846edaa2f`; code checkpoint before this handoff `40ea52adfdb0d009c4ac56fec2b12a3561d51a33`. Refresh PR head before integration.

## Scope implemented and committed, not execution-verified

- `packages/commerce/migrations/0110_crypto_internal_transfers.sql`: tenant-scoped immutable quotes, receipts and matching debit/credit entries, expiry and uniqueness, deferred commit-time balance trigger; `commerce.crypto_all_ledger_entries` union preserves custody wallet liabilities.
- `adapters/storage/postgres/src/commerce/internal-crypto-transfer.ts`: canonical asset+network and exact decimal validation, sender+recipient profile existence, idempotent quote, quote lock, expiry, policy revision, shared provider withdrawal/conversion advisory balance lock, numeric balance assertion, atomic and balanced transfer, request-id retry, participant-scoped receipt and history.
- `adapters/storage/postgres/src/commerce/crypto-repository.ts`: three existing readBalance/readAggregateLiability/readPlatformAggregateLiability queries now include real internal entries. This change is **essential** and must not be dropped in cherry-pick.
- The C06 PostgreSQL store now also checks `identity.tenants.state='active'` and both canonical `identity.users.state='active'` with `FOR SHARE` locks while quoting and committing; disabled/deactivated parties are denied. Quotes also check actual spendability before confirmation (execution rechecks under custody lock).
- `adapters/storage/postgres/src/index.ts`: exports the store.
- `services/gateway/src/internal_crypto_transfer.ts`: session-scoped admission, fresh live qualified custody route, injected KYC/AML/limits eligibility policy with revision + explicitly supplied zero fee, quote, approve, requalify, request replay readback, scoped history.
- `services/gateway/src/internal_crypto_transfer_routes.ts`: HTTP availability/quote/approve/receipt/recovery/history, typed fail-closed errors and no raw SQL exception leakage.
- `services/gateway/src/app.ts` and `services/gateway/src/main.ts`: isolated route registration and production Postgres composition using the **existing** financial authorizer; optional audited policy not silently invented.
- `apps/mobile/lib/src/finance/internal_crypto_transfer.dart`: typed transport and fail-closed receipt/quote parsing, existing bearer session interceptor.
- `apps/mobile/lib/src/finance/internal_crypto_transfer_screen.dart`: Wallet-triggered signed-in screen, live availability, asset selection, human account ID, quote review and approval, per-account encrypted pending request/quote journal, server readback and recipient/sender confirmed history, account switch widget teardown, no duplicate after uncertain send.
- `apps/mobile/lib/src/finance/crypto_wallet_screen.dart`: source-linked entry from existing crypto Wallet.
- `docs/contracts/INTERNAL-CRYPTO-TRANSFER-C06.md`: exact API, security and release limitations.

**Tests written, not executed:**
- PostgreSQL fixtures include both Security and canonical Identity migrations; negative coverage also checks disabled recipients and races.
- `services/gateway/src/internal_crypto_transfer.test.ts`: HTTP unauthorized denial, policy disabled, custody disallowed, self-transfer, refusal without fresh consent, replay and conflict.
- `adapters/storage/postgres/src/commerce/internal-crypto-transfer.integration.test.ts`: real PostgreSQL migration + custody-backed deposit event, balanced sender and recipient, constant aggregate liability, replay, cross-user privacy, immutable financial rows, concurrent quote consumption and insufficient balance.
- `apps/mobile/test/finance/internal_crypto_transfer_models_test.dart`: parse disabled capabilities and reject fake quotes/receipts.
- `apps/mobile/test/finance/internal_crypto_transfer_screen_test.dart`: signed-out UI security.

## Hard release blockers (source work still required)

1. **No live KYC/AML/amount/velocity/recipient-status/market policy adapter.** The Gateway `TransferRiskPolicy` is intentionally optional/unconfigured and `/capabilities` fails closed. Do not substitute an unconditional `allowed: true`, env-only bypass, hardcoded country, or static whitelist for real recorded eligibility. The policy must check active/undeleted identities, real KYC/sanctions/limits/market entitlement and exact route/fee; zero-fee transfer permitted only on explicit policy fee `"0"`. Nonzero fees currently reject because a platform-fee ledger leg is not designed. This is why **new transfers cannot be enabled**.
2. **Fresh transaction authorization** requires approved quote-bound step-up authentication and policy-proven consent rather than relying solely on a client Boolean `confirmed`.
3. **Human handle/contact resolution:** only verified canonical human account IDs are accepted now. Coordinate C01 contact authority #468 and existing social profile ownership before resolving handles; never treat AI/Twin IDs as human wallet accounts.
4. **Wallet/DM/Assistant parity:** Wallet is wired, but C02 DM Transfer, C07 Assistant operation and approved five-tab shell C08 are unmerged independently. They must enter the SAME quote/confirm/receipt operation IDs after those lanes are reconciled; no second ledger. Transfer must NEVER execute via the message Send arrow or model-generated approval.
5. **Mobile recovery polish:** a corrupt encrypted pending journal intentionally blocks transfer and instructs support; implement audited support recovery and account deletion journal purge (R12). Recipient notifications, secure paging/history, assisted accessible confirmation, low-memory/offline device acceptance are not qualified.
6. **Provider/backend qualification:** no credentials were read or changed, no live NOWPayments custody/coverage/evidence KYC proven, no production migration run and no transactional proof on deployed data. Provider withdrawal-route qualification is intentionally conservative (requires payout eligibility even if internal book transfers could theoretically settle); product policy owner must determine approved internal-only eligibility without relaxing custody evidence.

## Verification to run in ChatGPT Work (all NOT EXECUTED by this window)

Precondition: recover shared GitHub Actions issue [#457](https://github.com/Baatiku/masanawa/issues/457) or use an isolated trusted terminal. Its sampled Foundation CI and Mobile Build runs concluded in zero steps: neither pass nor code failure is established. This window's container lacks external GitHub connectivity; edits pushed through GitHub connector. No local node_modules, Flutter SDK checkout, provider keys, disposable Postgres or Android device execution was available, so **no tests/build/typecheck actually ran**.

```bash
git fetch --all --prune
git switch -c verify-c06 origin/work/c06-internal-crypto-transfer-20261008-gpt6
git rev-parse HEAD
corepack enable && pnpm install --frozen-lockfile
pnpm --filter @masanawa/postgres typecheck
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/internal_crypto_transfer.test.ts
# USE ISOLATED disposable PostgreSQL with migrated schema and transactional data:
MASANAWA_TEST_DATABASE_URL='postgresql://.../masanawa_c06_disposable' pnpm exec vitest run adapters/storage/postgres/src/commerce/internal-crypto-transfer.integration.test.ts
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/finance/internal_crypto_transfer_models_test.dart test/finance/internal_crypto_transfer_screen_test.dart
flutter build apk --debug
```

Then execute on **two real authenticated Android user accounts**: wallet quote/cancel/confirm, recipient lookup/consent, balance and provider custody invariant before and after, network loss after POST, app kill/restart with encrypted journal, retry same request, session revocation/account switch, both receipt histories and alerts, account disable/deletion, old URLs, limits and market denial, fresh policy revision invalidation, concurrent transfers and withdrawal racing over the same balance, and rollback/restore rehearsal. Verify no funds are sent on-chain; verify platform custody liabilities stay covered across tenants and network. Only then consider release and merge.

## Concurrent C06 PR collision — never merge both migrations

At the final inventory, **draft [#490](https://github.com/Baatiku/masanawa/pull/490)** appeared after this C06 claim. Its branch `work/c06-internal-crypto-book-transfer-20261008`, last observed head `532b158e77909d0c8c81ffe59124e673663ab876`, uses a **different `0110_internal_crypto_transfers.sql`** schema based on ordinary crypto intents, alternative `@masanawa/commerce` quote/consent primitives, and overlapping files (`app.ts`, `main.ts`, `internal_crypto_transfer.ts`, storage, Flutter). Its own PR body explicitly yields to active #487 and asks ChatGPT Work to compare both. **#487 and #490 MUST NOT BE MERGED TOGETHER AS-IS.** Work must choose one canonical financial migration, prove migration drift/recovery, retain one exact ownership ledger and review the other PR for unique consent-token/security tests. The sibling's SHA256 consent token is stronger than this branch's client Boolean; preserve this as an explicit security-review requirement, not a claim that it has been adopted here.

## Integration collisions and ordering

Live inventory at claim: C02 duplicate draft [#472](https://github.com/Baatiku/masanawa/pull/472) and [#475](https://github.com/Baatiku/masanawa/pull/475); C05 duplicate [#474](https://github.com/Baatiku/masanawa/pull/474) and [#476](https://github.com/Baatiku/masanawa/pull/476); C03 #483, C04 #478, C07 #480, R06 #438, R08 #444/#454 and shared Gateway #435. PR #475 also touches `app.ts` and `main.ts`. Merge or reconcile in dependency order. C06 owns its new files only, and its minimal common file edits must be selectively reconciled against the current main; never overwrite other windows. C06 schema is forward-only and needs real DB backup/restore checks before migration.

**Explicit Work disposition:** PR #487 remains **DRAFT/UNMERGED**. An implementer must finish blockers above and rerun all checks. The feature ledger is **NOT DONE** and platform internal transfers remain unavailable. Update `docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md` plus `CONTINUE-HERE.md` during later unified integration with exact outcome evidence.
