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

Status: IMPLEMENTING.
