# Workstream claim — crypto-nowpayments

- Owner/window: ChatGPT crypto NOWPayments window — 2026-10-04
- Branch: `work/crypto-nowpayments-catalog-20261004`
- Base SHA: `3906419669203844018b6687ad06ab2af48654eb`
- Workstream: `crypto-nowpayments`
- Task references: digital-commerce launch overlay; commerce launch qualification; Tasks 133–134 remain open
- Exact owned paths:
  - `docs/workstreams/crypto-nowpayments.md`
  - `adapters/crypto/nowpayments/**`
  - `docs/NOWPAYMENTS-ADAPTER.md`
- Shared-contract dependencies: canonical Commerce settlement/balances remain owned by commerce-core; Gateway/mobile/channel composition remains owned by their active windows; root lockfile/workspace/config/env registries are integration-owned.
- Current step: provider-edge catalog, quote/payment creation, signed IPN verification, lifecycle normalization, account-capability qualification and a non-secret read-only production probe are implemented; next is Gateway/integration wiring of that probe and Commerce reconciliation once shared ownership is coordinated.
- Implementation status: exact NOWPayments currency-code preservation, known-network projection, default Ethereum/ERC-20 exclusion, minimum-before-estimate preflight, HTTPS/order-bound payment creation, bounded recursive IPN canonicalization, HMAC-SHA-512 constant-time signature verification, reconciliable webhook evidence/fingerprint extraction, fail-closed convert/withdraw and low-fee evidence, freshness-bounded Custody/Customer Management/conversion/payout qualification, whitelist prerequisite checks, full payment-status normalization/polling with intermediate/partial states kept non-successful, redacted transport/provider failures and injected-fetch tests implemented.
- Verification status: PR #93 remains confined to claimed adapter/docs paths. Railway production worker has `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET` configured and healthy. A new adapter-level read-only probe now covers `/status`, authenticated `/currencies`, and optional `/min-amount` diagnostics without returning secrets/raw bodies. Railway Agent confirmed it cannot execute arbitrary commands inside the existing worker, so no live provider request was fabricated. Foundation CI run 929 also failed with zero job steps (same runner-allocation failure); no compile/test pass is claimed.
- Deployment status: credentials are installed on the production worker and the worker redeployed successfully; PR #93 adapter code itself is not deployed to production because the worker still tracks the shared `task073-inference-hardening` runtime branch. No live NOWPayments API call or live IPN delivery is claimed.
- Handoff evidence: PR #93; `docs/NOWPAYMENTS-ADAPTER.md`; Railway deployment `9580019c-1527-4ff8-b9d0-b348e2e3b7e3`; read-only probe implementation; latest implementation head before this handoff update `7f4bfdc99e1d6923ad617e2499ef7bc8ed945614`.

## Collision constraints

This window did not edit `packages/commerce/**`, Gateway/mobile/channel paths, migrations, root configs, `pnpm-lock.yaml`, or any path claimed by PRs #89–#92.

## Integration dependencies / next steps

1. Shared integration owner: add the new workspace importer to the lockfile and register any required production environment keys without overwriting concurrent adapter/channel work.
2. Security/integration owner: bind NOWPayments credentials through canonical credential custody rather than raw environment access inside the adapter.
3. Crypto workstream: authenticate live Custody/Customer Management/conversion/payout probes and attach fresh capability/fee evidence before exposing convert/withdraw routes; Gateway/Commerce integration must own persist-before-ack callback dedupe and financial reconciliation.
4. Commerce owner: own customer crypto balances, conversions, withdrawals, ledger custody and reconciliation; this adapter must not become a second wallet.
5. Gateway/chat/channel owners: consume authenticated server-owned transaction state; never trust a provider currency list or opaque chat selection as financial authority.

No live payment, custody, conversion, withdrawal, fiat payout, NGN settlement, provider deployment or production certification is claimed.
