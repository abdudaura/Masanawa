# R05 funding webhook recovery and error semantics

- Owner/window: ChatGPT continuation 2026-10-08, independently resumed after R16 handoff.
- Branch: `work/r05-funding-webhook-recovery-20261008`; base main: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`.
- Task: R05 — recover confirmed bill execution after credit-before-fulfillment crash; webhook transport must distinguish invalid authenticity from temporary processing errors.
- Exact code ownership: `services/gateway/src/billing_wallet.ts`, `services/gateway/src/billing_routes.ts`, `adapters/storage/postgres/src/commerce/ngn-wallet.ts` and focused new tests `services/gateway/src/billing_wallet_recovery.test.ts`, `services/gateway/src/billing_webhook_errors.test.ts`, `adapters/storage/postgres/src/commerce/ngn-wallet.integration.test.ts`.
- Shared dependencies: existing `BillingFinancialService`, `NgnWalletRepository`, `BillingQuoteRepository`, and canonical Flutterwave V3 verification; no new schema, provider logic, ledger or migrated state machine. No edits to gateway composition `app.ts` / `main.ts`.
- Workstream collision review: open R01/R02/R03/R11/R12/R17 PR paths do not include these files.
- Status: claim published, implementation pending; CI, provider and deployment unverified.
- Acceptance target: credited duplicate verified webhook safely resumes only eligible confirmed quote using existing immutable fulfillment reference; invalid signatures/payloads return 401/400, transient financial/DB/provider errors return retryable 503; no false 200 and no duplicate debit.
- Last update: claim publication; renew through repository-visible implementation commits.

## Committed implementation checkpoint

- `services/gateway/src/billing_wallet.ts`: one `resumeCreditedBill` continuation shared between first funding verification and duplicate credited callbacks; validates persisted owner, existing explicit quote confirmation and permissible quote state; does **not** create a second payment intent or bill identity. A confirmed quote that has expired is not executed against stale terms; already-reserved provider operations remain eligible for reconciliation.
- `services/gateway/src/billing_routes.ts`: distinguishes Flutterwave malformed/signature/oversize events (400/401/413) from temporary DB/provider/ledger failure (503), and only acknowledges successful reconciliation; no swallowed `reconcileFulfillment` errors.
- `services/gateway/src/billing_wallet_recovery.test.ts`: canonical quote fixtures for credited duplicate recovery, first credit, finalized/unconfirmed quote, expired quote, transient fulfillment error followed by safe retry, unknown reference and wrong signature.
- `services/gateway/src/billing_webhook_errors.test.ts`: Fastify HTTP checks for invalid signatures, malformed/oversize payloads, provider errors, reconciliation failure and accepted duplicate callbacks.
- Commits: `3f0b252f`, `3e3a8362`, `3e92a31f`, `8bf50fe9`, `06109070`, `8b7aa235`, `8435d713`, `d9d78147`.
- Verification: source review/readback and test authoring. **Vitest/typecheck not executed** (remote CI runner allocation issue; local environment lacks checked-out workspace/dependencies). No live Flutterwave or wallet balance was touched. Do not call R05 DONE; quote-scoped funding reuse, typed recovery state on mobile, automated sweep and concurrent settlement integration remain outstanding.
- Review requirement: run `pnpm exec vitest run services/gateway/src/billing_wallet_recovery.test.ts services/gateway/src/billing_webhook_errors.test.ts`, gateway typecheck, existing financial test suite and Postgres/provider integration tests on working CI or an equipped checkout. Inspect duplicate callbacks and provider-timeout behavior before merging.

## Scope extension: quote-scoped funding reuse

- Reviewed existing `commerce.ngn_funding_intents` schema and `createPostgresNgnWalletRepository` advisory wallet transaction lock. The table already persists owner, quote ID, txRef, amount, state and expiry; no schema rewrite required for bounded creation serialization.
- Expand owned path to `adapters/storage/postgres/src/commerce/ngn-wallet.ts` and new integration test `adapters/storage/postgres/src/commerce/ngn-wallet.integration.test.ts`.
- Verify no R01/R02/R03/R11/R12/R17 active PR edits these paths. Reuse current wallet lock and existing provider txRef; reject changed pending quote shortfall rather than silently minting a second virtual account.
- Migration/unique-index hardening remains separately governed by integration and must not be applied without historic duplicate-row audit.
