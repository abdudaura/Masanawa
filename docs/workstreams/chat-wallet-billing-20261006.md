# Chat-native NGN wallet + billing production workstream — 2026-10-06

Owner/window: current ChatGPT production billing continuation, explicitly assigned by the user on 2026-10-06.
Branch: `work/chat-wallet-billing-20261006`
Base SHA: `5dd094214539793095de7c98ab74cf067eaf0a01`

## Product requirement

Replace the hosted-checkout customer experience with a wallet-first, agent-led billing flow:
- no permanent/static customer virtual accounts;
- use Flutterwave dynamic NGN virtual accounts only when a user needs to fund;
- one authoritative NGN customer wallet balance for chat/header/agent/purchase;
- all user-facing funding and billing stays inside chat;
- agents ask only for missing fields and explicit confirmation;
- confirmed purchases execute immediately when balance is sufficient;
- insufficient-balance requests create a temporary funding account and automatically resume after verified funding;
- wallet balance refreshes after credit, reserve, purchase, failure/refund and reconciliation;
- retain the known-good DigitalOcean Flutterwave relay.

## Ownership / transfer

The older billing-main claim documents the hosted-checkout implementation. The user explicitly superseded that customer-flow requirement in this window and instructed this production integration window to fix the complete flow. This branch owns the replacement billing customer-flow files and only the narrow shared seams needed to integrate it into #136.

Owned paths:
- `packages/providers/src/flutterwave-bills/funding-client.ts` + tests;
- new NGN wallet/funding contracts under `packages/commerce/src/`;
- new append-only migration after existing billing migrations;
- new PostgreSQL NGN wallet/funding adapter under `adapters/storage/postgres/src/commerce/`;
- `services/gateway/src/billing_checkout.ts`, billing routes/composition and focused tests;
- wallet projection/routes only where needed to expose the authoritative NGN balance;
- mobile wallet/chat/header billing integration only where needed;
- this claim and billing readiness docs.

Constraints:
- never rewrite applied migrations;
- never relabel AI Credits as NGN;
- financial authority is server-side;
- webhook/browser/client claims never credit funds without provider verification;
- exactly-once funding credit and bill debit/reserve;
- no duplicate external bill purchase on retry;
- preserve existing DigitalOcean relay and live Flutterwave catalog qualification.

Status: INTEGRATION READY.


## Production qualification evidence — 2026-10-06

Exact qualified branch head:
- `093d66293efcee4c3d47ea7372ff9be0d1c0c2c7`

Railway Gateway qualification:
- deployment `3316b8d7-e5cd-4aae-88af-75274059947a` — SUCCESS;
- Gateway TypeScript workspace build passed;
- `commerce/0102_ngn_wallet.sql` had already been applied by the preceding successful deployment and the final deployment reported zero pending migrations;
- Gemini startup qualification: 6 checked / 6 authenticated on `gemini-3.8-flash`;
- Flutterwave startup qualification: 12 live categories;
- Flutterwave relay: enabled, dual-header protocol, existing DigitalOcean fixed-IP relay preserved;
- Gateway service reached `service.started`.

Earlier compile gate `6b061f8b-5bd4-4a50-81d6-0c8df5655637` intentionally failed before deploy and exposed strict TypeScript issues in the new integration. Those errors were corrected before the successful deployments.

Customer-flow changes qualified on this branch:
- authoritative NGN wallet ledger and temporary dynamic funding intents;
- wallet-funded bill reservation with idempotent reserve/refund behavior;
- Flutterwave dynamic NGN virtual-account creation through the existing relay;
- verified funding webhook credit with automatic linked-bill continuation;
- agent text/media billing directives with server-side catalog validation;
- signed wallet-confirm action path;
- mobile Bills screen no longer opens hosted checkout or asks for checkout email;
- chat header displays and periodically refreshes authoritative NGN wallet balance.

Remaining release proof after integration:
- merge exact qualified head into canonical PR #136;
- repoint Railway source back to canonical #136 branch and verify the merged canonical SHA starts cleanly;
- APK/device qualification remains dependent on an available Android/Flutter build runner; Render build-pipeline minutes remain exhausted, so do not claim DEVICE VERIFIED until an APK is built and exercised.
