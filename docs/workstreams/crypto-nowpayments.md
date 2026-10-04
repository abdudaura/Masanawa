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
- Current step: provider-edge catalog, quote preflight and account-capability qualification implemented; next is authenticated live account probing once credentials and shared Security/integration ownership are coordinated.
- Implementation status: exact NOWPayments currency-code preservation, known-network projection, default Ethereum/ERC-20 exclusion, minimum-before-estimate preflight, fail-closed convert/withdraw and low-fee evidence, freshness-bounded Custody/Customer Management/conversion/payout qualification, whitelist prerequisite checks, full payment-status normalization/polling with intermediate/partial states kept non-successful, redacted transport/provider failures and injected-fetch tests implemented.
- Verification status: PR #93 changed-file audit remains confined to claimed adapter/docs paths. Foundation CI run 877 on the earlier head terminated with zero job steps (runner allocation), so it is not application evidence. Latest synchronize commits have not produced a runnable CI job yet; no compile/test pass is claimed.
- Deployment status: not deployed; no live credential/account qualification claimed.
- Handoff evidence: PR #93; `docs/NOWPAYMENTS-ADAPTER.md`; latest implementation head `d8850716052b7c57704c6cd94553817ecb578e0c`.

## Collision constraints

This window did not edit `packages/commerce/**`, Gateway/mobile/channel paths, migrations, root configs, `pnpm-lock.yaml`, or any path claimed by PRs #89–#92.

## Integration dependencies / next steps

1. Shared integration owner: add the new workspace importer to the lockfile and register any required production environment keys without overwriting concurrent adapter/channel work.
2. Security/integration owner: bind NOWPayments credentials through canonical credential custody rather than raw environment access inside the adapter.
3. Crypto workstream: authenticate live Custody/Customer Management/conversion/payout probes and attach their fresh evidence plus actual route-fee evidence before exposing convert/withdraw routes.
4. Commerce owner: own customer crypto balances, conversions, withdrawals, ledger custody and reconciliation; this adapter must not become a second wallet.
5. Gateway/chat/channel owners: consume authenticated server-owned transaction state; never trust a provider currency list or opaque chat selection as financial authority.

No live payment, custody, conversion, withdrawal, fiat payout, NGN settlement, provider deployment or production certification is claimed.
