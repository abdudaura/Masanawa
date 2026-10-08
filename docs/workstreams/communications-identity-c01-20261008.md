# C01 private human-contact admission — 2026-10-08

- Owner/window: GPT-6 implementation, **C01 `communications-identity` only**.
- Branch: `work/c01-private-contact-admission-20261008`; base `main` at `0bed6fe5ada04fc64189a06d64619ef1dd4db87d`.
- Requirements: C01 and P03/N02/M01/M10/Q05, journeys J03/J04/J10.
- Owned new paths: `services/gateway/src/human_contacts/{model,service,postgres_repository,routes}.ts` plus focused service/repository/route tests, `packages/talks/migrations/0016_human_messaging_contacts.sql`, this handoff. No shared Gateway, mobile, finance or previous R owners' files altered.

## Actual code checkpoint (not release)
- **Created** tenant/identity-scoped Postgres contact preferences with independent `admission_policy: requests|anyone|nobody` and `discoverable_by_handle`. Separate unordered-pair contact request storage with unique key, audit status/timestamps, keyset-ready indexing and identity FK/CASCADE.
- **Implemented** exact-handle authenticated discovery, block and platform-safety restrictions in SQL; no arbitrary phonebook import, no exposing the receiver's actual policy on public contact lookup, no cross-tenant or self-contact flow.
- **Implemented** authenticated owner privacy reads/patches, contact request, recipient approval/decline/reaccept, relationship list and either-party revocation. Unique-pair conflict-preserving UPSERT prevents replay resets and duplicated requests; blocked/restricted profiles are omitted.
- **Created** isolated Fastify route registrar and Vitest tests for auth, exact-handle validation, privacy options, SQL predicates, duplicate requests, approval/decline, revocation and HTTP validation. Tests are **written, not executed**; no claim of typecheck/build/DB/device acceptance.
- **Reconciled migration collision**: R18 PR #435 owns `packages/talks/migrations/0015_profile_avatar_objects.sql`; C01 uses unique later name `0016_human_messaging_contacts.sql`.

## Explicit required integration and test gates
1. **Shared Gateway composer owner**, coordinating active R18 #435 and R17/C08, must register this C01 route/service through canonical customer session authorizer and actual connected `pg.Pool`; no placeholder/insecure fallback. We did not touch `services/gateway/src/app.ts` or `main.ts` because R18 #435 actively changes both; isolated code is **not yet reachable in running production**.
2. Execute `pnpm --filter @masanawa/gateway-service typecheck` and focused `vitest` tests, then Postgres migration/integration and concurrent contact acceptance/revocation tests against real Postgres. Current connector environment cannot clone/install project dependencies or run Postgres/Flutter. CI incident #457 concerns GitHub Actions billing; zero-step CI is neither proof pass nor fail.
3. Integrate C02 send-time policy/reciprocal-block checks using the same table and canonical human identities. C01 acceptance is incomplete until two real users can discover/request/accept/block and use the final C02 messaging backend/mobile after C08. No public-facing UI is completed here.
4. R12 deletion integration must revoke/clean contact relationships consistently with legal retention; R15 reciprocal blocks must be enforced at DM send/subscription and media access, not just discovery.
5. Verify security, multi-account switch/tenant isolation, hidden lookup and responses and actual Android/network acceptance; record SHA/build/deployed evidence separately.

**Status: CODE IMPLEMENTED IN AN ISOLATED BRANCH; TESTED / INTEGRATED / DEPLOYED / DEVICE-VERIFIED = NO. Do not merge unverified implementation; no new R/C gate marked DONE.** After this checkpoint, merge/integration ownership requires a fresh 5-minute lease check and preservation of #435's edits.
