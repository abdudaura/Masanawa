# Digital Commerce Launch

Status: **canonical service commerce direction — 2026-10-07**

Consumer commerce is deliberately narrow.

Masanawa has two standalone service families:
1. Billing
2. Crypto

Talk monetization (AI Seats, gifts, Twin revenue, creator earnings) is part of the Talk
economy and Wallet, not an additional service family.

## Billing

Selected provider: **Flutterwave**, subject to live account/operation qualification.

Supported product families to expose when provider evidence is valid:
- airtime;
- data;
- electricity;
- TV/cable.

The experience must be voice-friendly and compact.

If a user says all required details in one instruction and has sufficient authorized
balance, Gwani should collect only genuinely missing information.

Every purchase requires:
- current catalog/recipient validation;
- server-derived quote;
- explicit confirmation;
- durable idempotency;
- terminal receipt or honest checking/unknown state;
- reconciliation before any retry after an ambiguous provider dispatch.

## Crypto

Selected provider: **NOWPayments**, subject to exact account, region, asset, network and
operation qualification.

Consumer operations:
- deposit;
- buy where supported;
- convert;
- withdraw.

Do not treat ticker alone as eligibility. Resolve exact network.

Current policy excludes expensive Ethereum-mainnet ERC-20 routes. Other networks are
eligible only when operation support, minimums and total fees pass current policy.

Do not hard-code a tiny permanent token list; discover/filter eligible provider assets.

## Private by default

All financial flows are private.

A user may invoke Billing/Crypto while listening to a public Talk via private Gwani or
Services, but the public Talk must not receive financial details as context/output.

## Money separation

Keep distinct:
- spendable platform balance/credits, if enabled;
- creator earnings;
- crypto asset balances;
- provider settlement;
- internal execution reserves.

Only the first three have ordinary-user projections, and they must remain visibly distinct.

Agent Float/execution reserves are not consumer concepts.

## Confirmation contract

For any consequential operation:
1. derive allowed choices server-side;
2. bind selection to authenticated user and durable operation/request identity;
3. show/read back recipient/asset/network/amount/fees/expiry;
4. require explicit confirmation;
5. execute once;
6. reconcile uncertain outcomes;
7. return durable receipt/status.

Model text and button labels do not establish financial truth.

## Access surfaces

Billing/Crypto are reachable from:
- private Gwani;
- You -> Services;
- Wallet -> Services.

Do not rebuild Rooms or a general marketplace around them.

## Launch qualification

Do not claim an operation production-ready until the exact live provider account has
passed:
- credential/authentication;
- catalog/asset availability;
- quote/minimum/fee behavior;
- success path;
- failure path;
- duplicate/idempotency path;
- lost webhook/reconciliation path;
- physical app confirmation/receipt path.

See `CONSUMER-SERVICES.md` for the consumer-facing scope.
