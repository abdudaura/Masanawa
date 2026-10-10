# MSN crypto-primary wallet transition — 2026-10-09

**Status: PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT DEPLOYED. Real-money conversion and issuing MSN are NOT operational.**

## User decision and scope

On 2026-10-09 the owner approved a crypto-first wallet, **MSN** platform balances with earn/hold functionality, and **NGN only as an optional Nigerian deposit method converted automatically to MSN after actual provider settlement**. NGN must not appear as a held-wallet balance; users must see quoted NGN→MSN rate, fees and expected output before funding. This product decision supersedes the earlier Wallet prominence of spendable NGN, **but does not authorize rewriting/losing existing NGN liability or financial history**.

### Safe classification (not a promise that MSN is already an on-chain asset)

- User holdings: independently qualified crypto assets by asset/network, primary wallet presentation.
- Platform unit: **MSN** as an initially **off-chain** ledger/accounting unit, never falsely represented as a launched token, stablecoin, bank deposit, investment return or guaranteed redeemable USD. Actual redemption/secondary-market transfer/withdrawal is **disabled until contractual, reserve and compliance approval**.
- Existing legacy Credits, NGN kobo billing ledger and creator pending/available Credits remain **unchanged** on main. No silent redenomination or balance conversion. The final F05/F06 owner must reconcile historical liabilities and creator-earned value into MSN after documented approved conversion economics and qualified backing.
- Optional NGN is a **funding rail**. Server always tracks it in exact kobo internally for lawful payment reconciliation and bill/refund accountability, but consumer wallet balances are never displayed as NGN.
- **Do not hardcode an MSN/NGN peg.** A server-approved time-bounded quote must include net confirmed backing, an explicitly priced MSN unit, payout/deposit fees, credible conversion provider/FX, and user confirmation. Financial charge only upon opted-in user submission; provider processing/settlement may be asynchronous. Credit MSN only after actual stable crypto acquisition and locked backing.
- Financial support/creator earnings must not fabricate stablecoin backing by transferring nominal “Credits”.

## Exact isolated branch evidence

- Latest baseline `main@5e758673ae91082520b21b3153da53791ae2cbf3`.
- Branch `work/msn-crypto-primary-wallet-20261009-gpt6`.
- Central five-minute path claim `gpt6-msn-crypto-primary-20261009` committed to `factory/claims` before source changes; tracked with subsequent heartbeats.
- Pushed code in `services/gateway/src/msn_wallet/**`: exact micro-unit parsing and provider/funding/FX quote settlement admission, required qualified backing and customer bindings; Postgres issuance/debit store, only authenticated read-only route and tests; **no externally exposed mint route**.
- `packages/commerce/migrations/0112_msn_wallet.sql`: additive append-only journal, unique provider settlement globally, deferred double-entry commit trigger and restricted ledger entries.
- `apps/mobile/lib/src/finance/msn_wallet_panel.dart` + matching widget tests: crypto first, MSN distinct, NGN funding as quote entry only, no fake balances, truthful loading/offline/error. Not mounted into root while F12/PR #493 and R06/PR #438 own the integrated screens.
- **Source issued at HEAD to be taken from PR metadata at review.** This file is part of the immutable commit snapshot once PR is created. No deployment or production changes.

## Financial invariants enforced in new isolated code

1. NGN fiat funding requires an independently verified settled Flutterwave receipt matching exact tenant, user, quote and kobo amount, a real acquired custody reserve, an approved exchange/price and permitted account; absent evidence denies admission. A Boolean gate in the isolated *internal* function is NOT itself an external verification mechanism: only the F05/F06 trusted provider adapter may call it.
2. The NGN quote, funding and MSN issuance are transactionally fenced; the store locks the same per-user NGN wallet advisory lock used for existing billing, verifies credited funding intent and **debits the spendable NGN balance in the same PostgreSQL transaction** before issuing MSN. A bill and MSN cannot spend the same NGN ledger balance.
3. MSN issuance inserts a treasury liability debit and customer positive credit in one transaction; deferred constraint fails one-sided/different-value commit. No UPDATE/DELETE of issuance or ledger entries.
4. The same provider settlement reference is globally unique across tenants, and the same quote/funding reference cannot create a second issuance. Exact idempotent replay returns the prior result; incompatible replay fails closed.
5. Exact integer mathematics, 6-digit precision, explicit per-MSN USD-denominated quoted purchase price, never floating-point quote/mint, rounded-down micro-unit issuance. No implicit peg or guaranteed fiat/crypto redemption.
6. Crypto→MSN is deliberately rejected in the store until the actual crypto backing reserve/debit is composed. Without this, a customer could simultaneously spend their crypto and minted MSN. Existing NOWPayments crypto wallets remain separate.
7. Balance read is authenticated and tenant/user scoped; route errors return 401/503 without disclosing sensitive raw errors or inventing ₦0 / MSN 0 on outages. **Route is NOT mounted on main**, and cannot be treated as live.

## Source implementation vs missing integration

| Journey / screen | Expected state and behavior | Current evidence |
| --- | --- | --- |
| Wallet overview / crypto-first | qualified asset-network balance list with refresh, price/fee disclosures; MSN separate, creator earnings separate; loading/error/offline/empty; no NGN held-wallet balance | Independent unmounted Flutter panel; existing /crypto is implemented, provider-gated; F12 & R06 integration still needed |
| Crypto asset details | receive verified address, buy, convert, withdrawal quote/step-up, tx history + safe retry | Existing R08 source, unverified provider/Android; F06 completion |
| MSN balance + earn | available/pending actual MSN, earned attribution and backed settlement events, owner-readable receipt | Additive read-only service/store; no producer for earnings, no authenticated main composition |
| NGN funding quote | Nigeria-only option, show exact paid NGN, exchange price, fee, expected MSN, expiry, identity requirements; no defaults/fake price | UI callback seam only; actual approved FX/conversion provider and quote API MISSING |
| NGN deposit pending→settled | existing Flutterwave funded intent; quote-locked NGN liability debit and custody-backed MSN issue; webhook dedupe; interrupted readback | Atomic ledger primitives written; independent provider proof adapter, worker/outbox, schema migration and real DB still MISSING |
| MSN send/use/redeem | authenticated quote/consent, idempotent settlement, recipient receipt and AML; credits migration | MISSING. Not appropriate to expose token-like payouts before policy/licensing |
| Creator earnings to MSN | qualified settled revenue → treasury-backed MSN distribution, pending/available and reversal | MISSING. Existing Credits creator ledger remains unchanged |
| Admin risk and support | set verified reserve issuer/limit, review AML/FX, refund/chargeback, reconciliation, audit/incident, redacted support | MISSING; sensitive changes require financial owner & audited admin permissions |

States: loading (skeleton), empty (0 only after verified server response), error (no fictitious amount, Retry), offline (no unsafe purchases), pending (settlement not confirmed), denied region/KYC/provider (disabled explanation), quote expired (new quote), duplicate replay (same receipt), refunded/chargeback/unknown (reserve and reconciliation, never mint), signout (account cache wiped), tenant switch (no cross-account read), provider timeout (read-only confirmation), recurring earnings (no double credit).

## Existing PR collisions / integration dependencies

- **F05/R05–R07**: [#438](https://github.com/Baatiku/masanawa/pull/438) attempts to present spendable NGN; new owner instruction supersedes its *consumer display*, not its exact-ledger guards. Keep the fail-closed NGN transport/recovery and return it only to restricted funding/payment internals. Preserve [#440](https://github.com/Baatiku/masanawa/pull/440) funding status and [#447](https://github.com/Baatiku/masanawa/pull/447) genuine bill confirmation.
- **F06/R08/C06**: [#487](https://github.com/Baatiku/masanawa/pull/487) and [#490](https://github.com/Baatiku/masanawa/pull/490) have competing 0110 schema; do not merge both. [#444](https://github.com/Baatiku/masanawa/pull/444) owns crypto account-switch and [#454](https://github.com/Baatiku/masanawa/pull/454) owns quote-specific consent.
- **F12/C08**: [#493](https://github.com/Baatiku/masanawa/pull/493) and Work [#497](https://github.com/Baatiku/masanawa/pull/497) own shared five-tab/root Gateway integrations. No edits in this PR to `app.ts`, `main.ts`, root router/shell, existing NGN/crypto ledgers, Firebase, production or CI.
- Database migration `0112` is only proposed in this draft; F06/F11 must review 0110/0111 sequencing, migrator ordering/checksums, PG18 apply, upgrade and restore before integration. Never apply or backfill directly to live DB.
- **Reserve & currency obligation:** NOWPayments fiat Buy or crypto custody proof alone cannot establish an NGN→USDT exchange; the approved FX/provider, recognized custodian, depeg policy, licensing and conversion costs are still undecided. No arbitrary fiat exchange or simulated deposit as user balance.

## Regulatory/operational stop gates

Nigeria SEC's 2022 virtual assets issuance/VASP rules, its 2026 VASP accelerated programs and minimum-capital circular, 2025 Investment and Securities Act and 2026 virtual assets coordination order create potentially material token, virtual-asset, custody and transmission obligations. Do not infer that creating an internal MSN unit automatically exempts the platform. Obtain jurisdiction-specific legal/provider review before marketing MSN as money, tradable coin, redeemable stablecoin, investment yield or securities. Sources: https://sec.gov.ng/our-mandate/regulation/rules-and-regulations/ ; https://www.sec.gov.ng/for-investors/keep-track-of-circulars/revised-minimum-capital-mc-for-regulated-capital-market-entities/ ; https://statehouse.gov.ng/president-tinubu-signs-executive-order-on-virtual-assets-establishes-council-to-harmonise-regulation-of-digital-economy/ .

Live disbursement, production environment flags and unbacked user credits remain **BLOCKED** pending provider qualification, signed risk/KYC/AML, quote-by-quote treasury reserve, migration review, audit trail, reconciliation/reversal policy and real E2E device/provider/DB acceptance. This work does not modify the external services.

## Tests / commands / evidence honesty

- **WRITTEN, NOT EXECUTED:** `services/gateway/src/msn_wallet/admission.test.ts` (11 grouped negative/positive scenarios), `store.test.ts`, `routes.test.ts` and `apps/mobile/test/finance/msn_wallet_panel_test.dart`.
- **NOT EXECUTED:** repository pnpm Vitest, TypeScript typecheck, real PG18 schema/migration and concurrent settlement tests, Flutter/Dart analyzer/tests/build, Android sign-in/account switch and provider SANDBOX, live deposits, actual reserve readback, end-to-end rollback. Connected GitHub connector can read/write but no network checkout (`git ls-remote` fails DNS) and no Flutter SDK; current #457 hosted CI allocation remains unqualified.
- Required final Work commands on composed source:
```sh
pnpm install --frozen-lockfile
pnpm exec vitest run services/gateway/src/msn_wallet
pnpm --filter @masanawa/gateway-service typecheck
pnpm --filter @masanawa/gateway-service build
cd apps/mobile && flutter pub get && flutter analyze
flutter test test/finance/msn_wallet_panel_test.dart
```
- Real database: apply all migrations in manifest order to a clean disposable Postgres 18 + upgrade rehearsal; verify constraints and duplicate concurrent webhook behavior, fail after NGN debit, exactly one issue, forensic receipts; back up/restore a second DB and re-evaluate reserve liabilities. Real provider: signed Flutterwave settlement and actual custody-acquired crypto asset, valid FX payout, stressed interruption/retry, account A/B IDOR/KYC/limits before any customer activation.
- **PASS — 14/14 pure-JavaScript V8 assertions executed against the GitHub-fetched latest `admission.ts` after mechanically stripping only TypeScript syntax**, covering exact MSN issue amount, provider qualification failure, cross-user/tenant/quote/funding/network tampering, NGN-receipt mismatch, exact 6-digit decimals and rejection of excess precision. This is a **source-projection smoke**, NOT compiled TypeScript/Vitest, not authoritative ledger, real PostgreSQL, Flutter or provider verification.
- **PASS — GitHub exact branch readback:** committed source contains NGN advisory-lock and debit before MSN mint, double-entry deferred SQL trigger and crypto-first/no-NGN-held-balance UI. This is static verification only; run actual tests before merge.
- Link exact PR head and verification evidence when captured.

## Next exact integrator sequence

1. Reconcile F05/F06/F12 existing PR source, security and migrations; establish signed MSN economic policy and approval scope (internal utility vs regulated redeemability) and treasury/custody reserve.
2. Qualify actual Nigerian NGN→stablecoin acquisition partner and conversion quote evidence, refunds and disputes, and safe default disabled gateway flag.
3. Wire provider-backed settlement/outbox consumer into `admitMsnSettlement` and `createMsnLedgerStore`; require backing debit/treasury coverage and permit only approved tenant/market; reconcile legacy NGN and Credits without silent conversion.
4. Register authenticated `GET /v1/wallet/msn` in one shared Gateway composition and mount mobile primary crypto/MSN panel in F12 five-tab shell; show creator earnings separately.
5. Add real MSN earnings, spending and transfer only once funded reserve, audited receipts and reversible policies exist. No promises of investment return.
6. Execute complete TS/Flutter/Postgres/device/provider/security testing at composed SHA; do not turn on live crypto payouts or fund flow until R08/C06 and regulatory gates are genuinely satisfied.

## 2026-10-10 — AF03/AF01 continuation: authenticated Wallet readback

**Existing PR:** #576, branch `work/msn-crypto-primary-wallet-20261009-gpt6` (no replacement PR). **Initial previous PR head:** `c3d821e5dad6a8405d5efa0cd4a450ac4ce1a775`. **Fresh main observed before source:** `6bbb689fd65d977984be2487e6a6bd56aaf83001` (main advances independently). **New source checkpoint:** `a5c0f3314b47d7331c52a9f9beb6b03d1b441c82` as of this continuation. Ownership: `masanawa-msn576-wallet-readback-20261010-0320` on `factory/claims`; prior #576 lease had been released. This is still **PARTIAL_IMPLEMENTATION / NOT DEPLOYED**, not a finished wallet or a safe main merge.

### Finite source-completion checklist

| # | Required source, exact path / customer outcome | Owner | State at source checkpoint | Execution / integration |
| --- | --- | --- | --- | --- |
| 1 | MSN admission/ledger persistence: `services/gateway/src/msn_wallet/{admission,store}.ts`, `packages/commerce/migrations/0112_msn_wallet.sql`; reserve-backed NGN debit + balanced issuance | AF01 finance + AF00 migration review | IMPLEMENTED_UNVERIFIED in original #576; real settlement bridge absent | Vitest/Postgres NOT_RUN; no integration SHA |
| 2 | Authenticated, exact MSN GET: `services/gateway/src/msn_wallet/routes.ts`, bound via `services/gateway/src/{app,main}.ts` and existing auth + PG pool | AF00 exact-path composer, AF08 session authority, AF01 ledger | Route source IMPLEMENTED_UNVERIFIED; production binding **MISSING** | Existing mock-route tests written, NOT_RUN; needs app inject + DB auth/read test |
| 3 | Authenticated Dio MSN DTO/transport with no fake rates/zeros: `apps/mobile/lib/src/finance/msn_balance_transport.dart` | AF03 #576 | IMPLEMENTED_UNVERIFIED at this head; strict decimal parse, bearer-required GET, 404/401 typed errors, post-response session recheck | New Flutter transport tests authored, NOT_RUN |
| 4 | Account-fenced MSN card with refresh/loading/error/denied and delayed-response rejection: `apps/mobile/lib/src/finance/msn_balance_card.dart` | AF03 #576 | IMPLEMENTED_UNVERIFIED; no persistent balance cache | New Flutter card tests authored, NOT_RUN |
| 5 | Connect the card to **actual customer Wallet destinations**: `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`, `apps/mobile/lib/src/finance/crypto_wallet_screen.dart`, with `sessionProvider` driving disposal/reload on auth change | AF03 #576; AF00 owns root navigation, no edits to root | IMPLEMENTED_UNVERIFIED; MSN shown separately from unmigrated Credits, including legacy/crypto loading and outage states | Flutter compile/widgets NOT_RUN; route entry from existing shell still requires AF00 integrated checkout review |
| 6 | Provider-settled NGN→MSN pending/credited/recovery/refund/outbox with real reserve & compliance: existing financial provider service + `services/gateway/src/msn_wallet/**` | AF01 + AF00 composer | **MISSING**; never mint from a redirect or guessed rate | Provider contract/negative + PG transactions NOT_RUN |
| 7 | Executable rate/fee/expiry quote, user consent, receipt/history and safe replay; Wallet actions reuse one authorized operation | AF01 + AF03 + AF08 | **MISSING** | Contract/UI/negative tests NOT_RUN |
| 8 | MSN send/convert/creator earnings with canonical treasury/escrow rather than renaming Credits or cloning crypto ledger | AF01 + AF02 + AF03 | **MISSING** | Role/concurrency/ledger/receipt tests NOT_RUN |
| 9 | Allocate and reconcile migration 0112 vs existing 0110/0111, wire auth and operational app registration; test unified source with source conflicts resolved | AF00 integrator, delegated bounded tests; AF13 qualification | **MISSING** / no published unified integration SHA for #576 | Composite TS, Flutter, PG, config/deploy gates NOT_RUN |
| 10 | APK/account switches, signed provider settlements, custody reserves, DB retries/restore, rollback and region/legal eligibility | AF13, AF01, authorized external/device runner | **NOT QUALIFIED**; not a local-source task | Real DB/provider/device tests NOT_RUN, release BLOCKED |

**Source closed here:** items 3–5 now have actual repository source plus authored tests; item 2 remains uncomposed. No item above is asserted SOURCE_CHECKED merely from source readback. The mobile screen uses existing `apiClientProvider`, the reactive `sessionProvider`, and the server's `GET /v1/wallet/msn` shape. It never shows fake zero on server failure. When the existing shared Dio interceptor changes its token mid-request, the transport rejects late cross-session reads. Existing Credits remain distinct, without any implicit migration; crypto deposits and unrelated finance options were not enabled by this patch.

**Boundary/transfer request to sole AF00 integrator:** inspect current claims and accept only exact composition paths `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, `adapters/storage/postgres/src/migrations.ts` (if needed), and current Wallet root route owners. Compose the already-authenticated read-only MSN route with the existing session authorizer and PG pool, after validating the 0112 SQL dependency ordering and production flags. Do not expose `store.issue` to HTTP or enable purchase, conversion, or transfer. Return precise composition commit and injection/auth/integration check results on one **reviewed non-deploying** integration target; branch name alone does not prove safety. AF01 retains final money authority and the settlement bridge; AF08 retains auth. Source from newer AF01 financial PRs is a conflict/recovery input, not silently replaced.

**Runner capability checked:** `git --version` is available, and Node v22 is available; `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/main` fails `Could not resolve host: github.com`. `dart`, `flutter`, `pnpm`, and `psql` executables were not found. GitHub connector source-readback works, not a checked-out executable workspace. No Dart analyzer or Flutter tests were executed, and earlier 14/14 projection assertions apply only to the previous admission source, not this continuation.

**Next executable check assignment — AF13 capable Flutter window, on this exact PR source:** `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/finance/msn_balance_transport_test.dart test/finance/msn_balance_card_test.dart test/finance/msn_wallet_panel_test.dart`. AF00/AF01 backend runner after the source composition: `pnpm install --frozen-lockfile && pnpm exec vitest run services/gateway/src/msn_wallet && pnpm --filter @masanawa/gateway-service typecheck && pnpm --filter @masanawa/gateway-service build`, then disposable PostgreSQL migration/rollback/dual-replay checks. **Do not ask the owner for a local pull:** items 2 and 6–9 are missing source or integration, not merely unavailable runners. Device/provider checks can be handed to their actual executor only after unified source closure.
