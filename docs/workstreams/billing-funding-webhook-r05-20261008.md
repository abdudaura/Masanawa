# R05 funding webhook recovery and error semantics

- Owner/window: ChatGPT continuation 2026-10-08, independently resumed after R16 handoff.
- Branch: `work/r05-funding-webhook-recovery-20261008`; base main: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`.
- Task: R05 — recover confirmed bill execution after credit-before-fulfillment crash; webhook transport must distinguish invalid authenticity from temporary processing errors.
- Exact code ownership: `services/gateway/src/billing_wallet.ts`, `services/gateway/src/billing_routes.ts`, and focused new tests `services/gateway/src/billing_wallet_recovery.test.ts` and `services/gateway/src/billing_webhook_errors.test.ts` (if route tests are necessary).
- Shared dependencies: existing `BillingFinancialService`, `NgnWalletRepository`, `BillingQuoteRepository`, and canonical Flutterwave V3 verification; no new schema, provider logic, ledger or migrated state machine. No edits to gateway composition `app.ts` / `main.ts`.
- Workstream collision review: open R01/R02/R03/R11/R12/R17 PR paths do not include these files.
- Status: claim published, implementation pending; CI, provider and deployment unverified.
- Acceptance target: credited duplicate verified webhook safely resumes only eligible confirmed quote using existing immutable fulfillment reference; invalid signatures/payloads return 401/400, transient financial/DB/provider errors return retryable 503; no false 200 and no duplicate debit.
- Last update: claim publication; renew through repository-visible implementation commits.
