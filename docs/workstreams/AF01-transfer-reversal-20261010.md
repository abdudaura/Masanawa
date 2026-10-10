# AF01 — transfer reversal receipt guard (MASANAWA-01)

**Status:** IMPLEMENTED_UNVERIFIED for this narrow legacy-Credit guard; AF01 MSN financial authority remains PARTIAL_IMPLEMENTATION.
**Date:** 2026-10-10 UTC.
**Owner / window:** MASANAWA-01 / AF01.
**Claim:** `masanawa01-af01-transfer-reversal-20261010` on `factory/claims:.factory/leases.json`.
**Branch:** `work/af01-transfer-reversal-guard-20261010-masanawa01`.
**Base:** `f381f077c485c04261459b77a42c215d3ce3a14b`.
**Source and committed regression-test anchor:** `9760610d8aecbc7dd17e652289c187d01c785188`.
**Scope:** `packages/commerce/src/transfers.ts`, `packages/commerce/src/transfers.test.ts`, this handoff. No other paths, migration, composition, auth or deployment mutation.

## Reconciliation and rationale

Read fresh main, AF01 prompt and current contracts. PR #590 changes `services/gateway/src/financial_billing.ts` and its own AF01 tests only; #576 contains the separate unfinished MSN proposal and is not replaced or merged by this change. No active CAS owner claimed either transfer path when work began. The owner-reported local APK/source remains unavailable and is not overwritten.

Existing `reverseCreditTransfer` could issue a compensating receipt before the original completion, accept a settlement timestamp before the original admission, accept an empty source transfer ID or a malformed/tampered original receipt, and reuse the original request ID. It now validates a structurally consistent completed original receipt, preserves economic fingerprint/provenance/no-commission invariants, refuses chained reversal metadata, requires a distinct request ID, and enforces original admission <= completion <= reversal.

**Trust boundary:** This is a pure receipt-shape guard on the *legacy Credits* transfer contract, **not** proof the caller owns funds, that a posted transfer exists or that a reversal has been performed once. The authoritative server must load the durable original under the authenticated tenant and enforce atomic once-only idempotency and balanced postings. It must not be used as an MSN exchange/ledger implementation. No P2P, fiat or crypto provider has been exercised.

## Source and acceptance

- Existing public function signatures and normal successful receipt remain compatible; specific invalid timestamp labels are now field-accurate.
- `packages/commerce/src/transfers.test.ts` adds negative cases for before-settlement reversal, impossible original settlement, bad timestamps, altered amount/sender/fingerprint, chained/blank receipts and original request ID reuse.
- Relevant future full journey: WF-A04 (server-authorized internal transfers and duplicate/retry safety), WF-A08 (receipt integrity). This patch closes **only a prerequisite shape invariant**, not those E2E journeys.

## Executed evidence

- At GitHub source blob `d5ac6ec3a7cc23030049d6569d039a23ee175faf`, a byte-identical local `transfers.ts` copy was verified by `git hash-object`.
- Node v22.16.0, `node --experimental-strip-types --test /mnt/data/masanawa_af01_verification/reversal.node.test.mjs`: **14/14 PASS**. This is a local executable test harness of the exact source blob (the probe file is environment-local, not the committed Vitest test file).
- `tsc --noEmit --strict --skipLibCheck --target es2022 --module nodenext --moduleResolution nodenext /mnt/data/masanawa_af01_verification/transfers.ts`: **PASS** on exact source blob.
- Repository Vitest `pnpm exec vitest run packages/commerce/src/transfers.test.ts`: **NOT_RUN** (full GitHub checkout/dependencies unavailable in the runner used for this handoff). CI, full TypeScript workspace build, database concurrency, real ledger posting, provider settlement, device and live deployment: **NOT_RUN**. No claimed provider or production verification.

## Integration and recovery

Keep source/test changes together; do not treat this check as financial approval. Audit target branch deployment triggers before merge; avoid a main-triggered production deploy. Since `main` can be connected to production, use a non-deploying integration target. AF00/AF01 must reconcile the separate #576 MSN authority and full money authorization/ledger tests before production activation. No schema change or rollback migration; rollback this isolated commit group before financial integration if downstream invariants conflict.
