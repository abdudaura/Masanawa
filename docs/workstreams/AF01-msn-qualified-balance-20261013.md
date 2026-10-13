# AF01 MSN canonical readback and ledger-source integration — 2026-10-13

Main base: `8d5a0492b65ebe702087dfe61457b562ea201760`.
Branch: `lane/af01-msn-qualified-balance-20261013-gpt6`.
Claim: `af01-msn-qualified-balance-20261013-gpt6`.
Prior art: old draft #576 @ aa88511f4add1bbcf9e213283088fea5a6b0561b.
Do **not** wholesale-merge #576 or overwrite mounted MUI08 Crypto or new Wallet.

## Source scope

This batch integrates reusable exact micro-unit MSN issuance admission,
a bounded internal PostgreSQL ledger store, staged additive migration proposal 0112 with
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

## CI repair from first hosted run #38388319251

Gateway package correctly lacks a direct pg dependency, so PostgreSQL18 acceptance moved into the canonical adapters/storage/postgres/src/commerce location rather than creating a second database dependency. 31 Gateway/MSN tests passed before the old path's missing pg error aborted the fifth file. The old #576 Flutter disabled-route test created a completed-error future before attaching its consumer; deferred the fault until after the widget mounts. A new exact-head hosted run is required before claiming success.

## Hosted qualified source e3f70616e53a693e746724ff4cf453f8eebb7f74

CI #38388652652: PostgreSQL18+Vitest **34 passed across 5 files** (including new real migration/immutability/tenant fencing), Flutter **44 passed** across inherited MSN transport/card, MUI07 and AF01 Wallet and AF08 regression. Focused Dart analysis exited successfully with four informational style lints in reused #576 sources; follow-up source fixes these without changing behavior, requiring a final exact-head verification. No financial flags activated.

## Pre-merge production migration safeguard

The trial DDL is stored at `packages/commerce/migration_proposals/0112_msn_wallet.sql`, **outside** `platformProductMigrationRoots()` and the auto-applied commerce migrations directory. Thus a deployment of main cannot silently create MSN finance tables. Real PG acceptance executes canonical migrations and then expressly applies the proposed SQL within its disposable test database. An operator must first qualify custody/provider evidence, migration versioning and production rollback and then schedule a distinct controlled migration for release. Until then even an accidentally enabled read-only Gateway route shows 503 instead of a fabricated balance.
