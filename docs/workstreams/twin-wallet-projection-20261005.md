# Twin Wallet backend projection workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-wallet-projection-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: backend/read-model portion of TWIN-030

## Scope

Provide one authenticated consumer Wallet projection without owning canonical financial
truth or active billing/crypto persistence.

## Owned paths

- new `services/gateway/src/wallet_projection*.ts`
- focused tests
- this claim file

## Explicitly not owned

- Commerce package/model/repository/migrations
- billing/crypto repositories/providers
- creator economy implementation
- Gateway app/main composition
- mobile Wallet files

## Contract

Return only:
- Spendable Credits
- Pending Earnings
- Available Earnings
- unified consumer history

Never surface Agent Float, fulfillment reserves, provider accounts or crypto asset
balances as if they were Credits.

Status: implementation started 2026-10-05.
