# NOWPayments adapter boundary

Status: implementation slice on the `crypto-nowpayments` workstream.

## Purpose

`@masanawa/nowpayments` is a provider-edge adapter. It discovers NOWPayments payment
currency identifiers and converts them into bounded route evidence. It does not own
customer balances, creator Float, pricing, settlement, transaction state, identity,
approval, or chat rendering.

The adapter preserves the exact provider currency code because NOWPayments distinguishes
the same asset on different networks (for example TRC20 versus ERC20). Known suffixes
are projected into a network hint without rewriting the provider identifier.

## Admission rules

- Ethereum-mainnet/ERC-20 routes are excluded by default.
- Payment-currency discovery proves deposit/payment availability only.
- Convert and withdraw remain unverified until an operation-specific account/provider
  check supplies evidence.
- A low-fee policy fails closed while fee evidence is unknown. Callers may attach
  bounded fee evidence and then qualify against a configured maximum.
- Unknown networks can be rejected by callers that require exact network qualification.
- Provider error bodies are never surfaced through adapter errors.

This intentionally prevents a supported-coins list from being mistaken for proof that
the merchant account can custody, convert, withdraw, or pay out that route.

## Integration still required

The shared integration owner must later register the package in the lockfile/environment
registry, bind credentials through canonical Security custody, and compose account-specific
Custody/Customer Management/Payout qualification. Commerce remains the authority for
customer asset custody and settlement records. Gateway/channels/mobile must consume
server-owned Commerce state rather than calling this adapter as a wallet.

No live credential, account eligibility, payout, custody, conversion, NGN settlement,
deployment, or production certification is claimed by this slice.
