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

Status: implementation started 2026-10-05.
