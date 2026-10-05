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

Status: isolated Wallet read model complete; shared integration/history persistence pending.

Implemented:
- authenticated WalletProjection service;
- exact consumer balances: Spendable Credits, Pending Earnings, Available Earnings;
- unified history contract for funding/transfers/purchases/commission/gifts/voice/owner sessions/refunds/withdrawals;
- strict validation and deterministic newest-first ordering;
- isolated GET /v1/wallet route registrar;
- canonical balance adapter over existing Commerce + PersonalClone repositories;
- creator Agent Float is explicitly dropped from the consumer projection;
- merged history-source adapter with duplicate consistency checks;
- focused service/route/source tests;
- twin-economy event -> Wallet history adapter with owner-scope enforcement.

Not yet integrated:
- Gateway app/main composition;
- authenticated mobile Wallet transport;
- event reader/outbox implementation feeding the provided twin-economy Wallet adapter;
- transfer/funding/withdrawal history subsources not represented by twin-economy events;
- crypto asset presentation remains separate and must not be folded into Credits;
- Activity emission and final four-tab router.

No active Commerce/billing/crypto persistence or shared Gateway files were modified.
