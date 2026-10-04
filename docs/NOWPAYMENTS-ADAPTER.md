# NOWPayments adapter boundary

Status: implementation slice on the `crypto-nowpayments` workstream.

## Purpose

`@masanawa/nowpayments` is a provider-edge adapter. It discovers NOWPayments payment
currency identifiers, obtains provider minimum/estimate evidence and qualifies explicitly
observed account capabilities. It does not own customer balances, creator Float, pricing,
settlement, transaction state, identity, approval, or chat rendering.

The adapter preserves the exact provider currency code because NOWPayments distinguishes
the same asset on different networks (for example TRC20 versus ERC20). Known suffixes
are projected into a network hint without rewriting the provider identifier.

## Route admission rules

- Ethereum-mainnet/ERC-20 routes are excluded by default.
- Payment-currency discovery proves deposit/payment availability only.
- Convert and withdraw remain unverified until operation-specific account/provider
  evidence is supplied.
- A low-fee policy fails closed while fee evidence is unknown.
- Unknown networks can be rejected by callers that require exact network qualification.
- Provider error bodies are never surfaced through adapter errors.

## Payment preflight

Before a payment can be offered as processable, the adapter can:
1. request the current provider minimum through `GET /v1/min-amount`;
2. reject an amount below that minimum before requesting a quote;
3. request the current estimate through `GET /v1/estimate`;
4. preserve the exact input/output currency identifiers and normalized numeric evidence.

These are quote/preflight facts only. They do not create a canonical Masanawa quote,
reserve customer funds or authorize a transaction.

## Account capability qualification

Custody, Customer Management, conversion and payout are represented as explicit
account-capability evidence rather than assumptions derived from the public product list.
Evidence is three-state (available / unavailable / unverified), carries an observation
timestamp and must be fresh when the composition layer uses it.

The adapter additionally fails closed when required security prerequisites are unknown:
- IP-whitelist evidence is required for account-level custody operations;
- payout qualification additionally requires destination-whitelist evidence.

This does not make the adapter an account-management system. The composition/security
owner must obtain these facts through approved provider/account checks and canonical
credential custody.

## Integration still required

The shared integration owner must:
- add the workspace importer to the lockfile;
- register required production environment keys;
- bind credentials through canonical Security custody;
- implement authenticated account probes for Custody / Customer Management / conversion /
  payout availability and current security-whitelist state;
- attach actual route fee evidence where a low-fee product rule is enforced.

Commerce remains the authority for customer crypto balances, canonical quotes,
conversions, withdrawals, ledger custody, settlement and reconciliation. Gateway,
channels and mobile must consume server-owned Commerce state rather than calling this
adapter as a wallet.

No live credential, account eligibility, payment, payout, custody, conversion, NGN
settlement, deployment or production certification is claimed by this slice.
