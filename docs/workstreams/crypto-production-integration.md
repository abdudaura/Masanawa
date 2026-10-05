# Crypto production integration — 2026-10-05

Owner/window: ChatGPT integration continuation explicitly requested by user.

Branch: `work/crypto-production-integration-20261005`
Base: current `main`.

Transferred integration scope:
- integrate PR #124 crypto backend and PR #130 mobile wallet onto current main;
- integrate the production-session financial authority from PR #128 without reintroducing developer tokens;
- wire shared Gateway financial routes/runtime composition previously deferred to PR #100;
- preserve current main changes and do not overwrite unrelated active work;
- reuse the existing NOWPayments fixed-egress relay at 209.38.107.173 only.

Owned for this integration branch:
- crypto-specific new files from PR #124 and PR #130;
- minimal merge edits to current shared Gateway/Postgres/mobile package/index/config files required to expose those capabilities;
- this claim.

Source checkpoints:
- backend PR #124: `cb21805ea58e1dbe6e52340ed72ca49cec463320`;
- mobile PR #130: `7c16aa600a9f17a408f95ed4e222f5d6f7a80763`;
- production auth PR #128 remains the source for normal-session authority semantics.

Rules:
- no fixed developer token for production financial routes;
- deposits, withdrawals, conversions and Buy remain fail-closed unless runtime evidence qualifies them;
- no second relay/server;
- no secret values committed;
- run available CI/typechecks/tests, and record zero-step runner failures honestly.

## Integration checkpoint — 2026-10-05

Implemented on this integration branch:
- selectively ported the PR #124 canonical NOWPayments adapter, crypto ledger/repository,
  additive migrations, exact signed payment/payout evidence and hosted fiat Buy service;
- selectively ported PR #130's Wallet UI/transport, with normal ApiClient production
  session auth and no developer-token dependency;
- exposed deposit, Buy, withdrawal quote/create/refresh, conversion quote/create/refresh,
  balances/history/intents and both NOWPayments IPN routes through the shared Gateway;
- wired the existing canonical production OTP session repository into FinancialAuthorizer;
- composed all provider clients through the existing fixed relay URL
  `https://209-38-107-173.sslip.io/v1`;
- added strict runtime evidence and operator gates so unavailable evidence keeps each
  operation disabled;
- reconciled the workspace lock and package exports.

Production Railway preparation:
- masanawa-gateway now securely references the existing @nurain/worker NOWPayments
  API key, IPN secret, payout credentials, custody/conversion/payout flags and payout
  destination allowlist through Railway reference variables;
- NOWPAYMENTS_RELAY_URL is pinned to the existing 209.38.107.173 droplet;
- variables were written with redeploy skipped, so production behavior has not changed.

Remaining deployment dependency:
- `MASANAWA_NOWPAYMENTS_RELAY_TOKEN` is not present on Railway and cannot be read or
  installed on the existing DigitalOcean droplet through the currently connected
  DigitalOcean API (no SSH/remote command capability). The runtime therefore remains
  fail-closed and will not compose the financial service until that shared relay token
  exists on both sides.
- the intended droplet `masanawa-relay-bridge` (209.38.107.173) is active. A separate
  pre-existing droplet at 165.232.83.17 was observed but is not used by this integration.

No secret values are committed or exposed.

