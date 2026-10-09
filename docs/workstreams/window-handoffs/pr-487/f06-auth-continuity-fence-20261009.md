# F06 — transfer reauthorization identity-continuity recovery (2026-10-09)

**PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT DEPLOYED / NOT VERIFIED_E2E.** Existing C06 work remains production-disabled. This checkpoint is a narrow safety recovery, **not** F06/R06–R08/C06 completion.

## Ownership and source of truth

- Inspected latest `main@5e758673ae91082520b21b3153da53791ae2cbf3` and the U01–U30/F01–F18 reconciliation and Software Factory v0.4.2 guidance.
- Found 30 U streams already in draft PRs, and no active independent F06 recovery claim. Resumed the established, **unmerged** C06 [draft PR #487](https://github.com/Baatiku/masanawa/pull/487), not a competing transfer schema/PR. Competing [#490](https://github.com/Baatiku/masanawa/pull/490) explicitly yields to #487; its distinct 0110 migration must not be merged alongside this one.
- Existing branch: `work/c06-internal-crypto-transfer-20261008-gpt6`; initial branch HEAD `0950b0ce091e18a5c05f9deeab35cce33feea065`; original PR base `main@1d6a67ea3c182455b55a7d1d07eacdb4311682e3` (behind the currently observed main).
- Before any implementation edit, published exact-path five-minute claim at commit `08bc45ebfd1bfd29d05c850615593aa4d2954854`.
- Source fix `c175882aaeb1328c0afc1e752e1718d1c4a59e7e`; regression tests/source checkpoint `a79220272eb9392691c910f1383af697502ef251`. Final branch HEAD resolves at the PR/branch after this handoff commit; integrator must pin that exact SHA and compare with current main.

## Substantive source and security behavior

Changed only:
1. `services/gateway/src/internal_crypto_transfer.ts`.
2. `services/gateway/src/internal_crypto_transfer.test.ts`.
3. `docs/workstreams/f06-auth-continuity-fence-20261009.md` (this handoff and initial claim).

Previously, `transfer()` authorized the request, checked sender-bound recovery/quote, and reauthorized during current custody-route and risk-policy qualification. It rejected a changed **user ID**, but not a changed **tenant ID**, before calling the original-tenant `store.execute()`. When a caller has the same user ID in two tenants and session authority switches across await boundaries, tenant B's refreshed eligibility could be used with tenant A's earlier quote.

Now a transfer is rejected with `crypto.internal.authorization_changed` (HTTP 401) when **either tenantId or userId differs** between those two auth snapshots. This guard precedes all financial `store.execute()` effects. No second authorization or ledger implementation was added and no idempotent committed-receipt recovery semantics were changed. The change does not claim to solve all account-switch or risk-policy TOCTOU questions.

Two Vitest regressions were added:
- Same user ID, different tenant after second authorization: rejects and never executes a transfer.
- Different user ID after second authorization: rejects and never executes a transfer.
Both preserve original mock custody/policy APIs and existing tests; they are authored, not reported as run.

## Verification truth

**Performed:** GitHub connector re-fetched both committed changed blobs and actual draft PR HEAD. Eight static assertions passed: tenant and user guards present; before `store.execute()`; both negative test cases present; both assert no ledger execute; branch HEAD pinned to `a79220272eb9392691c910f1383af697502ef251` during that check; PR remains draft/unmerged. GitHub commit SHA confirms code and tests pushed. Static inspection does **not** prove TypeScript compilation or runtime.

**NOT RUN / NOT PASS:** `pnpm install --frozen-lockfile`, `pnpm exec vitest run services/gateway/src/internal_crypto_transfer.test.ts`, `pnpm typecheck`, `pnpm test:ci`, Postgres financial integration, migration rehearsal/restore, Flutter analyze/widget tests, APK, two-device session-switch acceptance, KYC/AML decisions, custody/provider qualification and Android financial E2E. This execution container has Node 22 (root requires Node 24 / pnpm 12), no mounted private checkout, no DNS to clone GitHub, and no populated dependency tree; CI #457 documents GitHub Actions runs failing before any job steps. **No runtime test result is claimed here.**

## Integration / remaining critical blockers

- Compose/rebase semantic fix onto latest `main` without losing C06 #487's ledger union/liability reads, canonical tenant/user `FOR SHARE` active locks, unchanged request-id idempotency and quote-expiry behavior. Evaluate #490 for useful security ideas, **not** its duplicate `0110` migration.
- Before enabling transfers: audited actual KYC/AML/sanctions and market/rate/velocity rules with recipient privacy/block/deletion checks; real transaction/quote-bound server one-use step-up (the current `confirmed:true` is inadequate); qualified custody provider; single financial and migration owner, actual security approval.
- Coordinate C01/F14 contacts, C02/F15 canonical human DM, C07/F18 Assistant, F12 five-tab router and Work #497; preserve #461 Firebase and all financial safeguards.
- At isolated integration checkout with Node 24/pnpm 12, execute `pnpm install --frozen-lockfile`, `pnpm exec vitest run services/gateway/src/internal_crypto_transfer.test.ts`, `pnpm typecheck`, `pnpm test:ci`, and disposable Postgres18 migration/recovery + concurrent transfer tests. Then real Flutter/device tests, two independent tenant/user principals, no-double-debit retry/timeout, abnormal session-revision changes, and provider-ledger reconciliation. Record test exits/artifacts against the **merge candidate** SHA before considering release.
- No production writes, secret configuration, external money movement, merger, branch deletion or rollout in this F06 checkpoint.

The three exact claimed paths are released when this handoff is committed; future edits require a fresh five-minute claim and reinspection of live PR heads.
