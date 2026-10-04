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
- Current step: establish a provider-edge NOWPayments catalog/eligibility adapter that discovers supported currencies/networks/operations, excludes Ethereum-mainnet ERC-20 routes, normalizes provider evidence, and fails closed when account/network operation eligibility is unknown.
- Implementation status: claim only; no implementation edits yet.
- Verification status: claim publication pending verification.
- Deployment status: not deployed; no live credential/account qualification claimed.
- Handoff evidence: this file and the workstream PR will record exact commits/checks/gaps.

## Collision constraints

This window will not edit `packages/commerce/**`, Gateway/mobile/channel paths, migrations, root configs, `pnpm-lock.yaml`, or any path claimed by PRs #89–#92. Any required shared change will be recorded as an integration dependency rather than edited here.
