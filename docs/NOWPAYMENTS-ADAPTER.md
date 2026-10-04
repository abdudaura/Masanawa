# NOWPayments adapter boundary

Status: implementation slice on the `crypto-nowpayments` workstream.

## Purpose

`@masanawa/nowpayments` is a provider-edge adapter. It discovers NOWPayments payment
currency identifiers, obtains minimum/estimate evidence, creates preflighted provider
payments, verifies IPN callbacks and qualifies explicitly observed account capabilities.
It does not own customer balances, creator Float, canonical pricing, settlement,
transaction state, identity, approval, or chat rendering.

The adapter preserves exact provider currency codes because the same asset can exist on
different networks. Known suffixes are projected into network hints without rewriting
the provider identifier.

## Route admission

- Ethereum-mainnet/ERC-20 routes are excluded by default.
- Currency discovery proves incoming payment availability only.
- Convert and withdraw remain unverified until operation/account evidence exists.
- Low-fee qualification fails closed while fee evidence is unknown.
- Unknown networks can be rejected when exact network qualification is required.
- Provider response bodies are not exposed through adapter errors.

## Payment preflight and creation

The safe public client flow:
1. fetches the current `/v1/min-amount`;
2. rejects amounts below the provider minimum;
3. fetches the current `/v1/estimate`;
4. validates an HTTPS IPN callback URL and bounded platform order reference;
5. submits `POST /v1/payment`;
6. validates the provider response and rejects a mismatched returned order id.

The result is provider evidence only. Commerce must persist its own canonical quote,
customer intent, transaction identity and settlement state before/around this edge call.

## Payment lifecycle

Raw provider statuses are normalized without collapsing intermediate states:
`waiting`, `confirming`, `confirmed`, `sending`, `partially_paid`,
`finished`, `failed`, `refunded`, and `expired`.

Only `finished` maps to successful provider completion. `confirmed` and `sending`
remain processing; `partially_paid` remains a distinct non-terminal condition for
Commerce policy and reconciliation.

## IPN verification

IPN handling implements NOWPayments' signed-callback boundary:
- the callback payload is bounded to JSON-safe values and recursively key-sorted;
- HMAC-SHA-512 is calculated using the separately supplied IPN secret;
- the received 128-hex signature is compared in constant time;
- no secret is stored in this adapter;
- only a verified payload can be projected into payment evidence.

Verified evidence contains payment, purchase, optional parent-payment and order
references; payment status; expected and actual amounts/currencies; and a stable
SHA-256 payload fingerprint. The fingerprint supports later durable deduplication but
is not itself a ledger receipt or idempotency store.

Gateway/integration must persist-before-ack and deduplicate verified callbacks.
Commerce must compare the evidence with its own expected order/quote/payment custody
before crediting balances or fulfilling anything. A signed `finished` webhook alone
does not authorize a financial state change.

## Account capability qualification

Custody, Customer Management, conversion and payout are explicit three-state account
capabilities (available / unavailable / unverified). Evidence is timestamped and can be
required to be fresh. Account-level capabilities also fail closed when required
security prerequisites are unknown:
- IP-whitelist evidence is required for account/custody operations;
- payout qualification additionally requires destination-whitelist evidence.

## Shared integration still required

The integration/Security owners must:
- add the workspace importer to the lockfile;
- register required production environment keys;
- resolve API and IPN secrets through canonical Security credential custody;
- configure the public HTTPS callback route and pass the raw parsed JSON plus signature
  to this verifier;
- persist and deduplicate callback evidence before acknowledging delivery;
- implement authenticated live Custody / Customer Management / conversion / payout
  capability probes and current whitelist evidence;
- attach actual route-fee evidence where the low-fee product policy is enforced.

Commerce remains the authority for customer crypto balances, canonical quotes,
conversions, withdrawals, ledger custody, settlement, refunds and reconciliation.
Gateway/channels/mobile must consume authenticated server-owned Commerce state rather
than treating this adapter as a wallet.

No live credential, payment, IPN delivery, account eligibility, payout, custody,
conversion, NGN settlement, deployment or production certification is claimed here.


## Read-only production probe

`runReadOnlyNowPaymentsProbe` provides a bounded integration smoke test that never
returns the API key, request headers or raw provider bodies. It performs:

1. `GET /v1/status`;
2. authenticated `GET /v1/currencies`;
3. optionally, `GET /v1/min-amount` for an explicitly chosen pair.

A successful result exposes only reachability/authentication booleans, currency count,
a bounded sample of provider currency codes and optional normalized minimum evidence.
The current NOWPayments API documentation describes status and currency discovery as
the first API integration checks.

This probe is intentionally not an HTTP route by itself. The shared Gateway/integration
owner may call it from an authenticated operator-only diagnostic surface or one-shot
deployment verification. It must never be exposed to unauthenticated public clients.
