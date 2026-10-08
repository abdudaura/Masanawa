# C06 internal crypto transfers — active source ownership

Updated: 2026-10-08 11:36 UTC (verify live commits before overlapping); owner/window: GPT-6 C06 isolated financial slice.
Base main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`; branch: `work/c06-internal-crypto-transfer-20261008-gpt6`.
Status: PARTIAL_IMPLEMENTATION; NOT VERIFIED; NO TRANSFERS ENABLED.
Requirements: W06/W07/W08, C06; J09/J11. Source scope: new `services/gateway/src/internal_crypto_transfer*`, new `adapters/storage/postgres/src/commerce/internal_crypto_transfer*`, new `packages/commerce/migrations/*internal_crypto*`, new `apps/mobile/lib/src/finance/internal_crypto_transfer*`, feature-specific tests, this handoff. Shared `app.ts`, `main.ts`, wallet routes, and root navigation are NOT exclusively owned; coordinate with R06/R08/C07/C08 integrator before edits.
No existing C06 PR appeared in open PR inventory at claim; avoid altering overlapping R06/R08 ledgers and old Credits transfers. Full handoff and test ledger will replace this file at checkpoint. Never call this DONE without executed ledger/Flutter/provider proof.
