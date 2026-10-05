# Crypto mobile wallet — 2026-10-05

Owner/window: ChatGPT crypto continuation, explicitly assigned by the user to complete the crypto implementation so users can use it in the app.

Branch: `work/crypto-mobile-wallet-20261005`
Base: `main` at `24c8ed783cc2b4797e2c915a698b69ee997f3995`.

Dependencies:
- backend provider/ledger implementation: PR #124 `work/crypto-payment-recovery-20261004`;
- shared runtime/Gateway composition remains owned by PR #100 and must consume PR #124 rather than duplicate its provider or ledger logic;
- previous mobile shell work PRs #104/#125 are merged and no longer own this new crypto surface.

Owned paths for this workstream:
- new `apps/mobile/lib/src/finance/**`;
- new `apps/mobile/test/crypto_*.dart`;
- `apps/mobile/lib/src/screens/chat/chat_list_screen.dart` only for the wallet app-bar entry point. Wallet opens with a local authenticated page push so this workstream does not own or modify the shared production-auth router;
- this claim file.

Purpose:
1. Add authenticated mobile transport for crypto capabilities, deposit routes, balances, history, deposit creation, withdrawal quote/create/refresh, conversion routes/quote/create/refresh.
2. Add a compact production-facing Wallet/Crypto screen with balances, deposit/receive, convert, withdraw, quotes/fees, history, pending refresh and fail-closed capability states.
3. Never expose merchant NOWPayments credentials, payout verification codes or provider internals to the device.
4. Do not edit Commerce, PostgreSQL, provider adapters, shared Gateway composition, billing internals, deployment or unrelated mobile shell files unless this claim is updated first.

The mobile client targets the canonical PR #124/#100 HTTP contract:
- GET `/v1/financial/capabilities`
- GET `/v1/financial/crypto/routes`
- POST `/v1/financial/crypto/deposits`
- POST `/v1/financial/crypto/withdrawals/quote`
- POST `/v1/financial/crypto/withdrawals`
- POST `/v1/financial/crypto/withdrawals/:requestId/refresh`
- GET `/v1/financial/crypto/conversion-routes`
- POST `/v1/financial/crypto/conversions/quote`
- POST `/v1/financial/crypto/conversions`
- POST `/v1/financial/crypto/conversions/:requestId/refresh`
- GET `/v1/financial/crypto/balances/:providerCode`
- GET `/v1/financial/crypto/history`
- GET `/v1/financial/crypto/intents/:requestId`

No end-user payout verification-code endpoint is used.


## Auth/router coordination update — 2026-10-05

PR #128 owns production authentication and `app_router.dart`. This branch has reverted its router file exactly to `main` and no longer depends on a `/wallet` route. The Wallet entry point lives only in the signed-in chat list and pushes `CryptoWalletScreen` locally. Finance transport uses the normal `ApiClient` session bearer/interceptor; it does not read or store any Agent/Alpha/developer token.

## Hosted Buy mobile checkpoint — 2026-10-05

The owned Wallet surface now implements the real hosted fiat Buy journey. Buy is
enabled only when the Gateway reports `fiatOnRamp=true`, at least one fiat
currency and a qualified settlement provider code. The app creates one canonical
purchase request, opens only the HTTPS provider checkout URL with `url_launcher`,
and never receives merchant credentials or payout verification codes.

After checkout opens, returning users can immediately choose **Check status**. The
controller calls the canonical purchase refresh endpoint, merges the refreshed intent
into Activity, refreshes the affected balance after succeeded/refunded settlement, and
shows the exact provider-evidenced crypto amount on success. Pending Buy rows retain
their Activity refresh action, so a failed browser launch or later reconciliation does
not require creating a duplicate purchase. Existing Activity rendering displays exact
`providerTargetAmount` when settlement succeeds.

This branch continues to use `apiClientProvider.dio` with no developer-token
reader or storage. PR #128 remains the owner of the normal production session
interceptor/router and PR #100 remains the owner of shared Gateway financial route
composition; neither owner's files were edited here.

