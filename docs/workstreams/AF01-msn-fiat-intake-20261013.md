# AF01 — provider-verified NGN funding intake (2026-10-13)

## Authority and baseline

- Exact baseline main: `bb7ebef98f0dac0fbfc8a21511ca52c16487bafc`.
- Branch: `lane/af01-msn-fiat-preflight-20261013-gpt6`.
- Exact claim: `af01-msn-fiat-preflight-20261013-gpt6` on `factory/claims`.
- Canonical source: prior #576 recovered only where already integrated in #713; use the existing NGN funding intents and wallet entries, FlutterwaveFundingClient.verifyByReference, and #713 MSN admission/ledger. No competing provider/ledger, independent NGN customer holdings UI or new auto-migration.

## Connected server-side preflight (no execution/issuance)

The AF01 source bridge consumes one trusted, **server-originated** MsnConversionQuote, reads the existing PostgreSQL NGN funding intent and matched funding ledger credit in a consistent repeatable-read, read-only transaction, and calls the existing merchant-key Flutterwave verification method by the *stored* transaction reference. It requires exact tenant, customer, quote, funding reference, provider transaction ID, provider reference, currency NGN, successful status and integer-kobo amount. It reads the canonical intent/ledger a second time after the provider call; drift, refund/failure, mismatches, unknown amount, missing rows or provider outages fail closed.

Successful preflight returns only `fiat_verified_backing_pending` and a deterministic audit hash of bound provider fields. This hash is fiat payment evidence **only**; it is not a settled crypto deposit, a proof of custody, a treasury reserve, a qualified quote or permission to mint MSN. The bridge has no customer HTTP route, DB writes, provider checkout creation, worker activation or ledger.issue call. It has no ability to turn a redirect or unsigned webhook into issuance. No new feature flag is enabled.

The repository's normal NGN funding credit remains canonically owned by its existing producer, while this module independently verifies that already credited entry before a future backed conversion worker might use it. Production MSN migration `packages/commerce/migration_proposals/0112_msn_wallet.sql` remains outside automatic migrations; MSN balance and Credits Send remain OFF.

## Executable verification

Dedicated `.github/workflows/af01-msn-fiat-intake.yml` runs focused Vitest and **real PostgreSQL 18** acceptance using canonical existing finance migrations, plus Flutter financial/session regression and focused Dart analysis. Synthetic provider replies in the tests establish binding/denial logic **not live provider qualification**. Result counts and run URLs must be filled from actual Actions output; do not infer success from authored tests.

## Source closure and remaining financial dependencies

This is a safe **partial** dependency batch, not funded/converted wallet operation. Complete the independent custody/crypto asset reserve and settlement, qualified executable pricing and stored quote, operator/account policy, NGN debit and refund/chargeback state machine, durable operation/reconciliation worker, exact authenticated customer status + receipts, and rechecked atomic issuance as ONE reviewed subsequent integration. Then qualify MSN Send against spendable/reserved ledger and transaction authorization. Do not reuse the fiat-only hash as a backing hash. Keep MSN readback flag OFF, Credits Send flag OFF, and all real provider execution OFF until approved.

Future release still requires real Flutterwave and NOWPayments account acceptance, custody/treasury proof, regional regulatory checks, staged migration rehearsal and rollback, negative/race/idempotent PG tests, registered worker recovery, Android signed-install/mobile funding/readback, MUI-09/MUI-10 and AF11 device/provider acceptance.
