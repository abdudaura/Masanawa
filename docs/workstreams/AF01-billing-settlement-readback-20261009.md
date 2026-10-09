# AF01 — Billing terminal receipt and webhook evidence hardening

- Window/owner: MASANAWA-01 / AF01 billing readback
- UTC claim time: 2026-10-09T21:39:26Z
- Lease: five minutes from last concrete repository-visible work; recheck live path collisions before any edit. No stale ownership takeover.
- Branch: `work/af01-billing-settlement-readback-20261009-masanawa01`
- Base SHA: `f381f077c485c04261459b77a42c215d3ce3a14b`
- Contract: docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md (AF v1), docs/MSN-WALLET-P2P-CONTRACT.md; existing canonical NGN billing authority is preserved, **not** silently converted to MSN.
- Dependencies: AF00 composition baseline; no gateway root/export/migration modifications.
- Recovery inspected: #576 (MSN wallet isolated), #497 (integration), existing `financial_billing.ts` and tests; no shared path overlap observed in their current diffs. Local owner APK/source unavailable: do not modify screens.
- **Exact owned file**: `services/gateway/src/financial_billing.ts`
- **Exact owned new test file**: `services/gateway/src/financial_audio_first/billing_receipt_recovery.test.ts`
- **Exact owned handoff**: `docs/workstreams/AF01-billing-settlement-readback-20261009.md`
- Goal: Finalized fulfillment readback is canonical and does not create redundant provider calls on refresh; reject contradictory provider callback identifiers before durable admission, preserving idempotency and original signed verification.
- Acceptance: WF-A01, UX-A07, WF-A08 (partial existing-billing pre-MSN contract). Negative tests for terminal readback without provider, conflicting references and retries.
- State at claim: PLANNED; source/tests not yet edited, no deployment or provider/device evidence.
- Next action: read back claim; implement narrow provider/settlement improvements and unit tests; open scoped PR and record SHA-specific qualification. AF00 owns eventual composition/merge target and MSN conversion election.
