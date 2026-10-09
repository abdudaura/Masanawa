# F14 / C01 — Moderated contact-originator authorization fence

**2026-10-09 · PARTIAL_IMPLEMENTATION · existing DRAFT PR #468 / UNMERGED / NOT DEPLOYED.** This is an incremental R15/C01 abuse-prevention recovery on the existing canonical C01 contact-admission branch, not a competing contact schema or API.

## Base, lease and immutable source checkpoint

- Main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Existing branch: `work/c01-private-contact-admission-20261008`, PR [#468](https://github.com/Baatiku/masanawa/pull/468); inherited branch head `615678ff4b039330c4e7c1acde79e5f9aa13ce89`.
- Exact-path ownership claim published *before edits*: [comment #6073461429](https://github.com/Baatiku/masanawa/pull/468#issuecomment-6073461429); renewed [#6073471417](https://github.com/Baatiku/masanawa/pull/468#issuecomment-6073471417). Previous F14 C01 route/cache lease explicitly released in #6073366428. The checked open-PR/issue inventory had no conflicting active claim for these four exact paths.
- Source commit: `532d6887da810726ced78097363b332cc2ad0a1c`.
- SQL-contract test commit: `94565245df4d839a4275dbf0941bfda20de29b19`.
- Real-Postgres test *source* commit / verified content checkpoint: `dbf16d456be39db66d23d18d819455a833b955dd`.
- GitHub compare inherited head → source checkpoint: **ahead 3 / behind 0**, exactly the three C01 source/test paths below; no unrelated code/migrations:
  1. `services/gateway/src/human_contacts/postgres_repository.ts`
  2. `services/gateway/src/human_contacts/postgres_repository.test.ts`
  3. `services/gateway/src/human_contacts/postgres_integration.test.ts`
  4. This new handoff (separate final commit; no runtime code changed after source checkpoint).

## Real behavior implemented

**Threat:** A human whose public profile has become `restricted` or `blocked` in `talks.safety_enforcement` can remain an `identity.users.state='active'` session. C01's prior `visibleTarget` checked the *target's* moderation but omitted the *originator's* moderation, allowing that restricted user to discover exact human handles and attempt new contact requests. Its direct list and cursor-paged readback likewise checked peer moderation but not the viewing user's moderated profile. R15 safety restrictions should apply at the authoritative SQL boundary, not a stale Flutter flag.

- Added originator moderation anti-join (tenant- and canonical current public-handle-matched `talks.public_profiles` → `talks.safety_enforcement`) inside the existing parameterized `visibleTarget` expression used by both exact `lookup` and transactional `request`. Existing active-user check, reciprocal user block, recipient discoverability, recipient moderation, contact revision/idempotency and SQL bind parameters remain.
- Added the same originator guard to the shared `queryContactRows` SQL, covering both legacy `list` and new `listPage` with its precision-preserving keyset cursor. A restricted viewer receives no contact rows, while active users continue normal behavior. The target-moderation predicate remains.
- Deliberately **did not** block a restricted user from controlling their *own privacy preferences* or revoking a previous contact: opt-out and revocation remain safe privacy actions. A moderation rule is not a license to trap a user into a relationship.
- No contact identity is derived from phone numbers or AI/Agent accounts. No mobile/router/composer/auth/finance/Firebase/native/migration/production changes.

## Source tests and honest evidence

- New repository SQL-contract test checks both new moderation predicates are present for all four C01 lookup/request/list/listPage statements.
- New opt-in disposable PostgreSQL test constructs two fresh current-tenant identities/public profiles and a pending contact. For **each** of `restricted` and `blocked`, it requires lookup to return no person, request to return unavailable, unpaged and paged contact lists to be empty, and the durable request to retain its original status. It deletes only its temporary moderation record in `finally`, then verifies contact visibility returns after moderation is lifted. Existing test module's cleanup deletes only randomly scoped disposable-tenant test records.
- **EXECUTED:** GitHub readback of all three changed blobs. 12/12 targeted readback/source-invariant checks passed, including precise repeated guard presence, session-scoped SQL parameter, retained consent CAS, ability to revoke and DB opt-in safety gate. GitHub compare confirms only the three authorized changes at source checkpoint. These are **static** checks, not Node/Vitest/DB test passes.
- **NOT EXECUTED:** TypeScript typecheck, Vitest, actual PostgreSQL integration, multi-user Fastify/API, Flutter analyze/widgets, Android handset, CI and deployed staging. Container `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed `Could not resolve host: github.com`; no verified repository checkout/dependencies/PG server/Flutter SDK was available. CI issue [#457](https://github.com/Baatiku/masanawa/issues/457) reports exhausted Actions/zero-step jobs. We did **not** retry it or treat it as a code/test result. The SQL readback checks do not prove a PostgreSQL planner/constraint race or full user journey.

### Exact test sequence for the owner Work integrator

```bash
pnpm exec vitest run services/gateway/src/human_contacts/postgres_repository.test.ts services/gateway/src/human_contacts/service.test.ts services/gateway/src/human_contacts/routes.test.ts
pnpm --filter @masanawa/gateway-service typecheck
# Use ONLY an explicitly enabled, clean, disposable local DB ending in _test:
MASANAWA_C01_ENABLE_DB_TESTS=yes MASANAWA_C01_TEST_DATABASE_URL='postgresql://local_test:REDACTED@127.0.0.1:5432/masanawa_c01_test' pnpm exec vitest run services/gateway/src/human_contacts/postgres_integration.test.ts
cd apps/mobile && flutter analyze && flutter test test/human_contacts_transport_test.dart test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart
```

Then test two real sessions A/B: create an invitation, moderate A, prove direct handle lookup, list and paged list deny A; B cannot expose A through a blocked profile; lift moderation, prove previous legitimate request survives; verify retry/idempotent response, account-switch and declined/new revision states. Confirm with actual Gateway composer and Postgres readback. Check permitted cleanup/revocation for moderated users. Test each outcome on signed-out/expired token, slow network and real Flutter Contacts/New Message after F12 composition.

## Remaining integration and explicit stop gate

- Existing C01 [#468](https://github.com/Baatiku/masanawa/pull/468), C02 [#472](https://github.com/Baatiku/masanawa/pull/472) vs [#475](https://github.com/Baatiku/masanawa/pull/475), R18 [#435](https://github.com/Baatiku/masanawa/pull/435), Work [#497](https://github.com/Baatiku/masanawa/pull/497) and U21 [#508](https://github.com/Baatiku/masanawa/pull/508)/U24 [#510](https://github.com/Baatiku/masanawa/pull/510) must be reconciled, not overwritten. F11 must sequence contact migration `0016` behind R18/profile `0015` and before C02 `0017`; F12/one Gateway composer owner mounts actual Contacts → real human DM; F15 enforces send-time eligibility; F08/R15 must align moderation/blocked-profile semantics. Preserve target five tabs Talks · Chats · Assistant · Wallet · Agents. No false voice/device claim.
- **Limit:** This fence relies on a moderated account having a canonical `talks.public_profiles.handle` record keyed by its current identity. Existing safety_enforcement profile entries are handle-based; migrating that policy to stable user ID and reviewing concurrent profile rename is a separate R15/R18 safety task (do not silently change shared schema here).
- Missing actual code outside F14 remains open: full C01/C02/C03/C04/C05 integration, live Gateway registrations, offline Chats, native/FCM, multi-device tests, real storage and financial/privacy release gates. This bounded recovery does **not** complete F14/C01, J03/J04/J10 or K13–K20.
- Status remains **PARTIAL_IMPLEMENTATION / TESTS AUTHORED NOT EXECUTED / DRAFT-UNMERGED**. No merge, branch deletion, production writes or new paid resources. Re-review active leases before further edits; any future owner can resume only after coordination.
