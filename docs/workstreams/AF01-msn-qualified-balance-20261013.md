# AF01 MSN canonical readback and ledger-source integration — 2026-10-13

Main base: `8d5a0492b65ebe702087dfe61457b562ea201760`.
Branch: `lane/af01-msn-qualified-balance-20261013-gpt6`.
Claim: `af01-msn-qualified-balance-20261013-gpt6`.
Prior art: old draft #576 @ aa88511f4add1bbcf9e213283088fea5a6b0561b.
Do **not** wholesale-merge #576 or overwrite mounted MUI08 Crypto or new Wallet.

## Source scope

This batch integrates reusable exact micro-unit MSN issuance admission,
a bounded internal PostgreSQL ledger store, additive migration 0112 with
append-only two-sided journal and deferred balancing, actual PG acceptance,
an authenticated read-only Gateway route and guarded mounted Wallet MSN card.
The route is absent unless MASANAWA_MSN_BALANCE_ENABLED=true on the Gateway,
a real PostgreSQL Pool exists and platform account-session authorizer is
available. Wallet separately gates the card OFF by default at compile time.
Legacy Credits remain separate, unchanged, and Credit Send rollout stays OFF.

No user-facing API can mint MSN. Inherited store.issue is not composed into
a worker, route or provider; its internal evidence booleans are NOT actual
provider verification. NGN conversion, custody-backed issuance, crypto deposit
allocation, internal MSN Send, rates, withdrawals, refunds and provider
execution remain UNIMPLEMENTED/NOT QUALIFIED. Do not activate any financial
or external operations from these changes.

Authenticated balance preserves exact integer micro-units; no floats or
client-invented peg. Cross-user/tenant boundaries come exclusively from the
platform session. DB or network outages are unavailable states, not zero.
Mobile card invalidates stale identity, supports retry and inherits shared
AF08 credential-epoch protection.

## Verification and release

New dedicated CI must actually execute Vitest + PostgreSQL18 migration/
balance/immutability tests, Flutter wallet/AF08 tests and focused Dart
analysis on final source SHA. Whole-project TS and Flutter analysis remain
independent existing debt. Real device/provider, live backed issuance,
operational migration rehearsal/rollback, reconciliation/treasury proofs,
MUI-09, MUI-10 and AF11 remain OPEN. Do not report source or simulated UI
as production financial acceptance.

Next substantial milestone: independently authenticated Flutterwave/crypto
provider settlement evidence; custody reserve and priced quote; trusted
idempotent worker driving NGN->MSN issuance plus recovery and readback;
then atomic crypto deposits/conversion/send, with actual provider evidence.
