# AF01 — Crypto ledger reason/direction admission guard (2026-10-10)

**Window:** MASANAWA-01 / AF01-crypto-ledger-reason-g  
**Base:** `main@f381f077c485c04261459b77a42c215d3ce3a14b`  
**Source+test checkpoint:** `d89524b4de4b2a60654c43d14742aca2b259f783`  
**Pull request:** https://github.com/Baatiku/masanawa/pull/607 (draft)  
**Branch:** `work/af01-crypto-ledger-reason-20261010-masanawa01-g`  
**Claim:** `factory/claims@4768f508d7917d38f23342dc3b70ec19830a8637`, CAS readback confirmed; expiry/renewal coordinated through `.factory/leases.json`.  
**Status:** scoped source and regression cases authored; whole AF01 remains **PARTIAL_IMPLEMENTATION**; **not real E2E qualified or deployed**.

## Exact owned paths

- `packages/commerce/src/crypto.ts`
- `packages/commerce/src/crypto.test.ts`
- `docs/workstreams/AF01-crypto-ledger-reason-20261010.md`

No changes to `packages/commerce/src/index.ts`, PostgreSQL schema, migration registry, shared composition or providers. No local APK or worktree touched.

## Recovery / source conflict check

Fresh main `f381f077c485c04261459b77a42c215d3ce3a14b`. Relevant concurrent AF01 PRs #576 (MSN), #590 (settled billing readback) and #605 (credit transfer reversal) have no changed-path overlap. A separate current AF01 fiat-onramp claim owns `financial_service.ts` and `financial_audio_first/**` files, which this branch did not edit. Existing Postgres crypto adapter calls `normalizeCryptoLedgerEntry` before inserting a ledger entry; the same exported function and schema version were preserved. Owner's locally fixed APK remains unavailable; no screen changes.

## Implementation

The `CryptoLedgerEntry.reason` union already enumerated 12 types but runtime normalization previously passed arbitrary `reason` through. The adapter can receive values from provider/runtime boundaries, so a malformed reason could reach the persistence layer. Added an exhaustive typed, frozen reason/direction table. Rejects unknown or shadow-object-property reasons (including `__proto__`) and impossible sign/reason combinations before producing a normalized entry. `adjustment` explicitly allows both credit and debit. Existing canonical amount, asset, IDs, timestamp and object-freezing behavior remains unchanged.

13 legitimate reason/direction combinations and inverse/forgery/malformed cases are covered by four new Vitest tests. No new API or data migration; historical persisted entries are unchanged. If imported historical entries contain unsupported reasons, they now fail closed when re-admitted (audit required before any migrations).

## Verification and evidence

| Evidence | Result | Immutable identity / limitation |
| --- | --- | --- |
| GitHub Contents pre-edit ownership CAS and immediate readback | PASS (real repository write/read) | Claim commit `4768f508d7917d38f23342dc3b70ec19830a8637` |
| Source and test commit/readback | PASS (real repository write/read) | Source blob `46c70070c0c1190b0b807bf52c2539d514a256d0`; test blob `2744c486eaa49663ef2969314cfa4cfa364064ff` |
| Isolated V8 execution of the **exact guard extracted from fetched source blob** | **PASS_SIMULATED 35/35** | 13 allowed postings, 11 inverted postings, 7 invalid reasons, 3 malformed directions and 1 exhaustiveness count; tests only the extracted admission guard, not the full source module |
| Static source + regression presence readback | PASS source predicates 6/6 | Presence and consistency only |
| Cross-adapter static source contract check | PASS_STATIC (not runtime) | Exact source blob against main Postgres adapter: all 12 union reasons matched the table and adapter type; 12 literal adapter posting callsites used permitted directions |
| `pnpm exec vitest run packages/commerce/src/crypto.test.ts` | NOT_RUN | Full checkout and pnpm workspace packages unavailable in connected GitHub file-write environment |
| Package TypeScript `tsc`, full monorepo unit/integration, real PostgreSQL | NOT_RUN | Full checkout/DB unavailable |
| NOWPayments / Flutterwave, real mobile/APK and provider settlement | NOT_RUN | No provider payments, device or deploy initiated |
| CI exact-branch run | NOT_RUN | No demonstrated executable branch job; prior repository zero-step CI is not passing test evidence |

**Journey IDs:** WF-A02/A03/A07 (crypto asset accounting safety), UX-A12/WF-A04 (money-receipt integrity supporting internal transfers), PF-A01 (security evidence). This guard alone does **not** complete any journey.

## Contracts / dependencies / next merge

Uses existing `CryptoLedgerEntry` v1 and existing PostgreSQL `postLedger` admission. No new contracts or SQL. Depends on AF00 canonical integration ownership, while remaining independent of ongoing AF01 onramp guard and #576. Run the real package Vitest+TypeScript suites on **the immutable PR head**, check all 12 reason mapping directions against live adapter source, and reconcile changes from #576/#605. Once checks pass, integrate to a **non-deploying shared integration branch**; do not merge to main until Git-connected deployments and migration triggers are audited. Keep provider/device/DB qualification as separate release gates. No force push, deploy, refund, funding or provider execution permitted by this handoff.
