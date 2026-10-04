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
- `apps/mobile/lib/src/router/app_router.dart` only for the protected `/wallet` route;
- `apps/mobile/lib/src/screens/chat/chat_list_screen.dart` only for the wallet app-bar entry point;
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
