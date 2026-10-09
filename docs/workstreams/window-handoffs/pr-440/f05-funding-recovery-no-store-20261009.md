# F05/R05 — authenticated billing funding recovery response privacy

Updated: 2026-10-09 (UTC); owner: independent F05/R05 security-recovery window

## Status and provenance
- **Source:** PARTIAL_IMPLEMENTATION (R05/F05 product-wide); this bounded HTTP cache-safety patch is source-written with regressions authored, **NOT VERIFIED_E2E**.
- **Verification:** STATIC_SOURCE_CHECK_ONLY (9/9 structural/readback assertions); Vitest / TS / PostgreSQL / Flutter / device / Flutterwave **NOT_RUN**.
- **Integration:** ISOLATED_EXISTING_R05_DRAFT; release **BLOCKED**; money **DISABLED_UNQUALIFIED**.
- **Current latest main inspected at claim:** `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Existing continuation branch:** `work/r05-quote-funding-restoration-20261008`; **draft/unmerged PR:** https://github.com/Baatiku/masanawa/pull/440
- **Five-minute repository-visible claim:** https://github.com/Baatiku/masanawa/issues/553
- **Source commits:** `ff6fca4d2a1a2992427e008897684b04bd32bbfc` (route) and `b5875556176e55756a1235f3898ae4eada4f0035` (test).
- **SHA-specific source checkpoint:** `b5875556176e55756a1235f3898ae4eada4f0035` (this handoff document is a later commit; check actual PR head).
- **Requirements:** R05, F05; private quote funding recovery and authorization, R06 finance segregation, J service funding/restart recovery. The broader R05/R06/R07 provider and release acceptance remains OPEN.

## Scope and real code
1. `services/gateway/src/billing_routes.ts`: add a route-specific, pre-validation `onRequest` hook only to `GET /v1/commerce/bills/quotes/:quoteId/wallet-status`. Emits `Cache-Control: private, no-store, max-age=0`, legacy `Pragma: no-cache`, and `Expires: 0`. Includes authenticated HTTP 200 and error 400/401/404/503, and Fastify's automatic HEAD route. The bank instructions are temporary owner-sensitive information; intermediaries must not reuse them. No new money actions.
2. `services/gateway/src/billing_funding_restoration.test.ts`: extend the existing real Fastify injection test for cache headers across owner success, unauthenticated, missing quote, DB unavailable, invalid long quote ID, and HEAD empty-body cases.
3. `docs/workstreams/f05-funding-recovery-no-store-20261009.md`: this exact-source handoff.

**Explicitly NOT modified:** bank intent PostgreSQL tables, quote/economic authorization, webhook verification, wallet balances, ledger/reservations, native Firebase, Flutter router/five tabs, billing mobile screens, provider/production deployment, Actions configuration.

## Execution evidence — do not promote static evidence to Vitest
- GitHub content readback after commits checked **9/9 structural invariants**, covering unique route, pre-validation hook, all three cache headers, ownership auth forwarding, authored 200/400/401/404/503/HEAD coverage. This is source static verification, **not actual Fastify behavior execution**.
- New Foundation CI https://github.com/Baatiku/masanawa/actions/runs/37871739187: **failure before steps (0 job steps)**, no application test result.
- New Mobile Build https://github.com/Baatiku/masanawa/actions/runs/37871739272: **failure before steps (0 job steps)**, no build/device result.
- Container toolchain check: Node `v22.16.0` present; no pnpm, Flutter/Dart or repository checkout. GitHub clone failed DNS, `Could not resolve host: github.com`. No Vitest/TypeScript/Flutter runtime or DB available. No credentials or real payment flow exercised.
- **Deferred commands**, from a clean checkout of this exact PR head with network/dependencies/CI restored:
  `pnpm install --frozen-lockfile`; `pnpm exec vitest run services/gateway/src/billing_funding_restoration.test.ts`; `pnpm exec tsc --noEmit -p services/gateway/tsconfig.json` (confirm workspace script/tsconfig); billing wallet/integration suites; physical Flutter journey restart/expire and backend DB/provider qualification. The root script and package workspace invocations must be confirmed in checkout.
- Verify actual Fastify **HEAD inheritance and pre-validation onRequest headers** with the authored tests before merge. The scripted static checks alone do not prove this.

## Conflicts, owners, and remaining integration
- This is a **continuation of existing R05 PR #440**, not a duplicate finance backend. The head may be behind `main`; no force push, rebase, merge or production mutation performed.
- **Work PR #497** has prior copies of `services/gateway/src/billing_routes.ts` and recovery tests, with other unmerged Firebase, Gateway, C01–C08 and five-tab changes. Its elected integrator must semantically preserve this narrow header hook/tests when reconciling the R05 draft; never wholesale overwrite its newer composition. Other R06/R07 and money authority PRs remain independent.
- All other F05 outcomes remain unfinished: real Flutterwave sandbox/credential replay and late funding, quote expiry under concurrent state transition, restarts/DB failover and signed receipts, billers in each market, Flutter UX voice/text/tap, settlement/chargeback/reconciliation, money scopes, logged-out cache purging, low-end Android and exact full CI gates. Neither a no-store header nor a mocked funding fixture proves any of these.
- **Privacy reminder:** HTTP `no-store` constrains compliant intermediaries. It does not itself prevent screenshots, malicious clients, client logs, or old device state. Client app must clear bank details on expired/revoked quote/session; verify independently.

## Exact next actions
1. Restore GitHub Actions job execution per #457; execute the focused Fastify tests, Gateway TypeScript compile and surrounding wallet regression suite on pinned branch head. Fix any real compiler/test errors.
2. In a clean disposable Postgres, verify owner/tenant scoping, expiry, post-credit suppression and double-quote/concurrent-funding races under actual transactions.
3. Work integrator compare #440 with latest #497, transfer only the new safety change and tests preserving the canonical service/router/five-tab/Firebase/financial composition, then run integration CI.
4. Verify physical low-end Android app behavior across sign-in/out, expiry, background/restart and loss/retry; exercise Flutterwave sandbox and authorization boundaries before ever permitting production.
5. Keep PR draft/unmerged until evidence is recorded. No merge, delete or production writes without explicit permission.
