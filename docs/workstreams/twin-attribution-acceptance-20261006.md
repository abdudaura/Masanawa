# Twin funding/purchase attribution acceptance workstream

Owner/window: current ChatGPT continuation window — 2026-10-06
Branch: `work/twin-attribution-acceptance-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/TWIN-TRANSFORMATION-TASKS.md` — TWIN-101.
Roadmap reference: `docs/TWIN-INTEGRATION-MATRIX.md` Phase 3 Credits/gifts/commission.
PR: #238
Acceptance implementation commit: `29bf7a9290bf21bf83b8724771206b3b4ae53cce`

## Exact owned paths

- `tests/integration/twin-attribution-commission-acceptance.test.ts`
- `docs/workstreams/twin-attribution-acceptance-20261006.md`

## Excluded/shared paths

- PR #136 Gateway/mobile/router/APK/production ownership;
- billing/crypto provider orchestration and live purchase/funding hooks;
- Commerce repository/model/index and ledger persistence;
- migrations and production environment;
- Event/Activity ownership.

## Completed acceptance harness

- proves an eligible commerce purchase through the originating Twin receives only the configured purchase commission;
- proves external funding uses its separately configured funding policy rather than a purchase policy;
- preserves originating owner, Character, customer and operation identity in the acceptance fixture;
- proves self-attribution, internal transfers and gifts cannot manufacture commission;
- proves expired attribution is ineligible;
- proves partial refunds create proportional negative commission reversals without mutating the original commission result;
- proves full/oversized reversals can never claw back more than the original commission.

## Changed-file audit

Compare against current `main` reports the branch 2 commits ahead, 0 behind, with exactly:
1. `docs/workstreams/twin-attribution-acceptance-20261006.md`
2. `tests/integration/twin-attribution-commission-acceptance.test.ts`

No protected/shared production implementation changed.

## Verification

Foundation CI run `37454288304` completed as `failure`, but its only job `112237970542` has `steps = null`. Checkout/install/typecheck/tests never executed. This is runner-allocation/non-execution evidence, not an application failure and not a test pass.

No executable local checkout is available in this connector-only window, so no fabricated local test result is claimed.

## Remaining dependencies

- persist originating-Twin attribution through canonical storage;
- capture attribution from real public-share/session origin and attach it only to qualifying provider-success funding/purchase operations;
- post commission and refund/chargeback reversals through the canonical append-only Commerce ledger;
- #136/shared production owner must compose authenticated routes/mobile surfaces;
- Activity/Wallet projections and exact provider/release acceptance remain existing owners.

## Current state

**ISOLATED ACCEPTANCE HARNESS COMPLETE / PRODUCTION ACCEPTANCE BLOCKED ON SHARED OWNERS.**

No further isolated implementation remains in this acceptance slice.
