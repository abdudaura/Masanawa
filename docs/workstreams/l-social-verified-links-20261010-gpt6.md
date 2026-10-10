# L-SOCIAL J21/J22 — source-first handoff (2026-10-10)

**Repository** weavewellindustrieslimited/masanawa · **Feature PR** #626 · **base** integration/rebuild · **lane claim** l-social-verified-links-20261010-gpt6-1718. Not deployed. No money, live messaging, production DB or Railway actions.

## Finite source/verification checklist

| Deliverable | Exact owned source | State |
|---|---|---|
| Canonical public identity contract, URL allowlist, explicit no-personal-WhatsApp automation | packages/masana_social/src/domain.ts,store.ts,index.ts,delivery.ts | IMPLEMENTED_UNVERIFIED |
| Tenant-owned character-only SQL, audit, event/attempt uniqueness, deny unverified publish | packages/masana_social/migrations/0001_social_links.sql | IMPLEMENTED_UNVERIFIED; central migration registration AF00 pending |
| Staff account operations with server-assigned actor/tenant, versioned writes, evidence authority | services/gateway/src/modules/masana_social/{service,routes}.ts | IMPLEMENTED_UNVERIFIED; composition AF00 pending |
| Transactions and composite isolation/audit | adapters/storage/postgres/src/masana_social/repository.ts | IMPLEMENTED_UNVERIFIED; PG18 execution pending |
| Stored event claim and deny-on-permission-loss/unknown-provider hold | adapters/storage/postgres/src/masana_social/delivery_store.ts, services/worker/src/jobs/masana_social/delivery.ts | IMPLEMENTED_UNVERIFIED; canonical outbox registration AF00 pending |
| Consumer verified links, external-launch guard, offline/retry and account/character switch invalidation | apps/mobile/lib/src/features/masana_social/social_links.dart | IMPLEMENTED_UNVERIFIED; L-MASANA profile composition pending |
| Staff Android Admin controls and honest permission/network states | apps/admin_mobile/lib/src/features/masana_social/social_accounts_page.dart | IMPLEMENTED_UNVERIFIED; AF00 Admin drawer composition pending |
| Unit/negative and PG tests | packages/masana_social/src/domain.test.ts, services/gateway/src/modules/masana_social/routes.test.ts, services/worker/src/jobs/masana_social/delivery.test.ts, tests/e2e/J21/social_db.test.ts, apps/*/test/features/masana_social/* | authored; executable verification pending |
| J22 Telegram bot external authorization, signed webhook and provider send | no activated provider transport; worker defaults off | MISSING / BLOCKED by provider permission/credential and L-SOCIAL J22 scope; never claim functional automation |

## Shared-file composition requested of AF00

1. Gateway/Postgres/worker manifests: add `@masanawa/masana-social` to the relevant workspace dependencies and regenerate `pnpm-lock.yaml` with pnpm 12, Node 24. **This is a newly observed actual CI failure**: Foundation run #38068005493 job #114259492314 `ERR_PNPM_PACKAGE_MANAGER_NO_IMPORTER`.
2. Register additive `packages/masana_social/migrations/0001_social_links.sql` in the canonical registry following identity ownership and L-MASANA schema; enforce unique prefix/checksum; PG18 fresh/upgrade/restore in disposable DB.
3. In existing Gateway app composition, call `registerMasanaSocialRoutes(app,createMasanaSocialService(store,evidenceVerifier),auth)` with the **existing verified staff principal**, tenant derived from trusted server context, and **durable verifiable official-account ownership evidence**, not a client flag. Missing evidence authority leaves Verify denied.
4. Reuse existing PG pool for `createPostgresMasanaSocialStore(pool)`; do not create a new schema registry/session authority.
5. Profile C24: L-MASANA owns embedding `MasanaSocialLinks(characterId: ...,loadLinks: ...)`; connect the existing authorized Dio. Admin A20-A26: AF00/Admin own drawer composition to `MasanaSocialAccountsPage` with existing authenticated Dio and staff RBAC.
6. Worker registration only with the existing events.outbox lease/settle authority, confirmed fan opt-in, live capability proof, rate budget and verified provider transport. Never register personal WhatsApp send. Any uncertain delivery must halt for reconciliation.
7. Integrate **only** to non-deploying `integration/rebuild` after the missing workspace dependency and protected compositions are resolved. Do not merge to Railway-linked main or run production migrations until complete release gates.

## Actual external test evidence (not inferred)

- Exact PR #626 initial head `316c4f75cbf25034e29d3f2778336d81b370c6e1`: Foundation Actions #38068005493 FAIL install (missing lockfile importer); TypeScript/Vitest/PG NOT_RUN because install failed; provider qualifier subset executed but unrelated.
- Same head Mobile #38068005499: consumer analyze/test FAIL with our `const Semantics` error, and known preexisting legacy gift transport parse failures; Admin widget 0 PASS/1 FAIL due offscreen Save draft finder; Admin analyze/APK FAIL on preexisting duplicate code in `platform_pages.dart` and `admin_auth_api.dart`.
- Our Flutter-specific failures corrected in later feature commits `c57e3de`, `dfefacff`, `e02020db`; source/type/security hardening continued after. Subsequent runs may be cancelled by new commits; always check newest exact head, do not label pass without execution.
- Node24/pnpm12/PG18 hosted runner is **available**; local Windows checkout/APK signer and protected production database snapshot are not accessible from this GitHub connector. Do not assume either is clean.
- No test or build has qualified the unified integration SHA; no merge SHA and no released APK.

## Source boundaries and residual security questions

- Existing money/journal/financial schema is untouched. Social schema is additive and is not applied to any shared/prod database.
- Official personal WhatsApp is **link-only** (verified phone in wa.me), no Baileys/Cloud/Business bridge or automation through unofficial sessions.
- The evidence checker must establish true account control; arbitrary form evidence text is denied without trusted injected checker.
- AF00 must verify existing identity/role middleware and tenancy, route conflicts, J10 legacy-channel retirement, PG18 upgrade history and actual staged rollback. L-MASANA keeps its feature paths; L-SOCIAL does not edit protected root/router/manifests.
