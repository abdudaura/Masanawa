# AF01 — staged MSN immutable-accounting reconciliation (2026-10-13)

## Source and ownership

- Base: main `ce7f4a9df38262b00c9fab78986143e6ccdf760c` (#720).
- Branch: `lane/af01-msn-reconciliation-20261013-gpt6`.
- Claim: `af01-msn-reconciliation-20261013-gpt6` on `factory/claims`.
- Existing #714 independently verified NGN + Flutterwave intake; #715 persisted immutable quotes, fiat verification and authenticated readback. This slice reuses both and staged `migration_proposals/0112_msn_wallet.sql`, not any competing ledger.
- No root router, main worker startup, financial production migration, customer API, Flutter or provider execution changed.

## Connected source

Read-only `createMsnReconciler(pool).scan(tenantId,limit)` executes one repeatable-read PostgreSQL snapshot and compares the canonical fiat funding intent, verified-fiat audit, immutable quote, issued economics and two-sided MSN ledger. Detects missing/changed provider settlement references, reversed/absent canonical funding, re-priced issues, issuance without verified fiat, orphan/unbalanced journal lines and inaccurate exact-micro rounding. Bounded tenant-only scan, defensive invalid SQL evidence, no SQL writes; returns no PII or spendable unreceived balances.

`runMsnStagedReconciliation(scanner,{tenantId,limit})` is a worker-callable adapter that aggregates bounded anomaly/backing-pending counts. It fails closed on invalid results and cannot mint, settle, debit, refund, or mark custody qualified. Both source and status always explicitly say internal accounting does **NOT** prove acquired crypto backing. This worker is **not scheduled or registered** into production; doing so would query the non-production-only 0112 proposal tables.

## Verification and activation

- Focused mocked Vitest contracts: pending vs issued accounting, rounding, tampering, foreign-tenant denial, invalid results and rollback.
- Real PostgreSQL18 integration: canonical commerce migrations then explicitly staged 0112 in disposable DB; independent Flutterwave fake yields backing-pending; simulated issuance is bookkeeping only; worker reads actual PG and immutable row mutation is rejected.
- Focused Actions: `.github/workflows/af01-msn-reconciliation.yml`, including Gateway and Worker build/typecheck.
- Checks must be attributed to exact head and actual run conclusion; authored tests are **NOT_RUN** until Actions completes.
- `0112_msn_wallet.sql` remains outside production migration registry; **all** MSN funding readback, issuance, conversion, Send/Credits finance flags remain OFF. Do not enable financial execution.
- No live custody, NOWPayments settlement or reserve evidence, executable qualified pricing, approved compliance/economics, rollback proof, signed Android or provider-device acceptance in this slice.

## Next full financial integration

AF01 must obtain independently verified provider-acquired backing, global provider settlement reservation, quoted conversion economics with price/expiry, real NGN debit and chargeback compensation, atomic issuance via canonical `createMsnLedgerStore.issue`, supervised durable worker with concurrent/replay recovery, provider reconciliation against treasury inventory and signed-Android customer readback. Existing crypto holdings must never simultaneously remain spendable after funding the same MSN issuance. Real accounts/licensing/provider evidence are external gates, not inferred from source tests. MUI-09, MUI-10 and AF11 stay OPEN.

## Executed source verification

- Source/test head: `28bf4729490e98016a5bc2580b1a94f66f6e25aa` (seven added paths). Focused [Actions run #38422726606](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38422726606), job `115384025029`, executed **SUCCESS**.
- 5 Vitest source test files: **61 passed**. Real PostgreSQL18 staged accounting + worker integration: **2 passed**. Gateway and Worker production builds **PASS**. Worker TypeScript **PASS**.
- Test payment/custody proofs are synthetic fixture evidence, not live provider confirmation; real PostgreSQL 18 is used for accounting consistency and append-only invariants. No signed Flutter/Android, live provider, priced backing, migrated production database, production worker or deployment verified.
- PR #721 is the tracked source; update source/main merge SHA only after GitHub reports an actual merge. Unrelated Foundation CI/Vercel failures do not override the successful scoped job.
