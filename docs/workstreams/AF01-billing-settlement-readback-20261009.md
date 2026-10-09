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

## Scoped implementation handoff (2026-10-09T21:44:58Z)

- Scope: AF01 existing-billing financial readback safety only. The full MSN issuance/backing/escrow workstream is **not** delivered; AF00/AF01 must reconcile #576 and the authoritative ledger.
- Base: `f381f077c485c04261459b77a42c215d3ce3a14b` (main read back unchanged at handoff).
- Source+test checkpoint (before this handoff): `84be6b312b9a2587140f506eff9005952da6a712`.
- PR: https://github.com/Baatiku/masanawa/pull/590 (isolated draft; no production integration).
- Changed: `services/gateway/src/financial_billing.ts`, `services/gateway/src/financial_audio_first/billing_receipt_recovery.test.ts`, this handoff.
- Contract: existing Flutterwave verified-signature webhook, owner-scoped `BillingFulfillmentStore`, `BillingFundingAuthority`, and cross-slice AF v1; no new ledger, API, migration or service root.
- Behavior: signed customer billing reference takes precedence over generic provider reference. Contradictory customer aliases, oversized/control/bidi identifiers fail closed before DB admission. A nested charge `tx_ref` alone is **not** a bill reference. Previously persisted `succeeded` fulfillment remains readable on retryable provider transport/5xx failure **only**; pending/unknown states and DB compare-and-set/reversal errors propagate. Refresh still queries the provider when reachable, preserving reversal reconciliation; existing funding settlement is awaited.
- Added nine Vitest test cases (including a three-row validation matrix) for idempotent admission boundaries, signature denial, provider downtime, unsettled state, reversal storage conflict, and unreferenced charges. These tests have **not** executed in the actual monorepo.
- Commands necessary on a real checkout: `pnpm install --frozen-lockfile`; `pnpm exec vitest run services/gateway/src/financial_audio_first/billing_receipt_recovery.test.ts services/gateway/src/financial_billing.test.ts services/gateway/src/billing_webhook_errors.test.ts`; `pnpm --filter @masanawa/gateway-service typecheck`; `pnpm --filter @masanawa/gateway-service build`. Run integration tests against disposable PostgreSQL/credentialed staging before production.
- **PASS_SIMULATED only:** 9 standalone `node --input-type=module` reference-selection assertions executed in the tool sandbox against copied narrow logic. These are a smoke rehearsal, not the actual TS/Vitest module suite.
- **BLOCKED:** GitHub Foundation CI run `37995254295` at source checkpoint reported failure with zero executed job steps (runner evidence unavailable); Vercel status failure directed to `upgradeToPro=build-rate-limit`. No usable Flutter/Android device/provider credential or full monorepo checkout is available in this execution container (GitHub DNS unavailable). Do not equate CI/job status with tested failures.
- **NOT_RUN:** monorepo Vitest, gateway TypeScript build/typecheck, actual PostgreSQL races, Flutterwave provider callbacks, Android behavior, deployment, rollback.
- **Integration state:** isolated source `IMPLEMENTED_UNVERIFIED`; full AF01 lane `PARTIAL_IMPLEMENTATION`. Avoid non-deploying merge until executable checks on exact head pass and AF00 reviews route/ledger/deploy interactions. Production activation remains blocked by MSN backing/issuance, real provider and financial controls.
- **Safe merge target:** AF00-managed non-deploying integration branch or main only after proving main does not auto-deploy. Never deploy from this PR as-is.
- **Next action:** run source tests/typecheck at exact PR head, repair any failures, reconcile signed callback payload formats with provider samples, and integrate in AF01/AF00 dependency order. Refresh SHA and tests after any updates.
- **Claim released at handoff:** this window does not hold a perpetual path lock. A new writer must inspect PR #590 and preserve its unique source/tests before touching these paths.
