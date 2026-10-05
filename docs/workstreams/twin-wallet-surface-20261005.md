# Twin Wallet mobile surface workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-wallet-surface-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: safe mobile-surface portion of TWIN-030, TWIN-038

## Scope

Build the simple Wallet presentation as new files only.

## Owned paths

- new `apps/mobile/lib/src/commerce/wallet_models.dart`
- new `apps/mobile/lib/src/state/wallet_state.dart`
- new `apps/mobile/lib/src/screens/wallet/**`
- focused mobile tests
- this claim file

## Explicitly not owned

- Commerce package/model/repository/migrations
- billing/crypto implementation
- existing creator economy files
- shared router/transport/provider files

## UX target

Show only:
- Spendable Credits
- Pending earnings
- Available earnings
- Add money / Send / Withdraw
- unified history
- reusable Send Credits and Gift sheets

Never expose Agent Float, fulfillment reserve or provider settlement accounts.

Status: isolated Wallet presentation complete; financial/shared integration pending.

Implemented:
- simple WalletView projection model;
- Spendable Credits / Pending earnings / Available earnings only;
- unified history kinds for funding, transfers, purchases, commissions, gifts, voice,
  owner sessions, refunds and withdrawals;
- Wallet Riverpod state/transport seam;
- Wallet primary screen;
- Add money / Send / Withdraw actions;
- optional Bills / Crypto shortcuts;
- reusable Send Credits sheet;
- reusable Gift sheet;
- tests proving Agent Float metadata is ignored by the consumer model.

Not yet integrated:
- canonical Wallet Gateway projection;
- transfer/gift backend commands and provenance;
- billing/crypto projections;
- authenticated mobile transport/provider;
- shared router/four-tab navigation;
- creator economy migration/deprecation.

No Commerce, billing, crypto, existing creator-economy or shared router/transport file was modified.
