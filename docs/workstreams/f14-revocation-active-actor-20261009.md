# F14/C01 — Active actor reauthorization at contact revocation (2026-10-09)

## Status and ownership integrity

**PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED / NOT END-TO-END VERIFIED.** This is an isolated amendment to existing C01/F14 draft [PR #468](https://github.com/Baatiku/masanawa/pull/468), not a new C01 implementation, API or migration.

- `main` checked: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Existing PR head before edits: `e7f8814c4f9aabed20e46677695b5c489cb5b046`.
- Source checkpoint after three commits: `9bcb91abedc7c136e7613adc731b7e3c67633bb5`.
- **Ownership caution: the initial comment #6072132689 incorrectly interpreted PR `updated_at=2026-10-09T01:02:10Z` as stale. This is 02:02:10 in Africa/Lagos, not an hour earlier. The earlier activity was not demonstrably older than the required five minutes.** The existing PR owner must review this bounded overlap. This document does **not** retroactively establish a valid lease; no further edits to these three code/test paths should occur without renewed exact-path coordination.
- The claim did precede our code edits, but its *stale-owner premise* was mistaken. The three commits are non-force additive commits, no branch rewrite or merge. GitHub compare `e7f8814...9bcb91a` showed exactly three modified files; no Firebase, wallet, root Flutter router, shared Gateway composition, schema or production changes.

## Concrete defect and patch

An authenticated contact revocation previously updated a C01 pair using only its tenant and pair IDs plus prior revoker state. If an account became disabled after issuance of a stale bearer token but before this write, repository-level `revoke` would not recheck the actor's current identity state, unlike the existing `request` and `respond` paths.

**Patch:** add an `EXISTS identity.users actor` predicate to the same PostgreSQL UPDATE, matching `e.tenant_id`, the exact `$2` actor and `state='active'`. Keep other C01 contact constraints, revoker-only protection, and exact existing idempotent timestamp behavior. **Do not require the other user's account to be active**: an active customer must still be able to revoke a contact whose peer was disabled or deleted.

Exact changed source/test files:
- `services/gateway/src/human_contacts/postgres_repository.ts` — fresh actor state fence at write time.
- `services/gateway/src/human_contacts/postgres_repository.test.ts` — SQL parameter/active-actor/tenant predicate assertions.
- `services/gateway/src/human_contacts/postgres_integration.test.ts` — dedicated pair: disabled actor must not revoke; recover active actor and disable peer, then revoke succeeds; repeated revoke retains status/updated_at.

## Evidence honestly separated

- **Committed source:** `608a2ec269c65d883cd80989c21c4b57b96018b0`; unit test `2a5707630e70312301fa58da1119c0091a643000`; integration test `9bcb91abedc7c136e7613adc731b7e3c67633bb5`.
- **Executed connector-only structural verification:** read back all three final source blobs; eight structural source-and-test assertions passed; compare returned exactly three files and 3 additive commits from initial branch SHA. This proves the patch/test text was committed, **not that Vitest or PostgreSQL tests passed**.
- **Local available environment:** Node `v22.16.0` was found, but `pnpm`, `psql`, and `flutter` were not available, no repository checkout was mounted, and GitHub DNS `git ls-remote` failed. Therefore no complete backend or mobile suite could run here. A server-wide CI status query on source checkpoint only returned Vercel failure pointing to a build-rate-limit/upgrade URL, **not source compilation evidence**.
- **NOT RUN:** `pnpm exec vitest run services/gateway/src/human_contacts/postgres_repository.test.ts services/gateway/src/human_contacts/postgres_integration.test.ts`; `pnpm -r typecheck`; full Flutter tests/analyzer/APK; real two-account K13–K20, token-disablement race, provider, production/restore, and Android tests.
- **Disposable DB only:** `MASANAWA_C01_ENABLE_DB_TESTS=yes MASANAWA_C01_TEST_DATABASE_URL=postgresql://<local-test-user>:<redacted>@127.0.0.1:5432/masanawa_c01_test pnpm exec vitest run services/gateway/src/human_contacts/postgres_integration.test.ts`. The test has its own localhost `*_test` fail-closed guard; never point it at production.
- **Known limitation:** account state is rechecked in a single UPDATE statement snapshot; a state change concurrent with that statement still requires canonical session-revocation/transaction ordering by the identity owner. This patch does not claim serializability against all concurrent account changes.

## Integration and review before any merge

1. **First resolve the five-minute ownership mistake:** ask current C01/F14 owner to accept, revise or revert these exact three additive changes using PR diff; do not silently declare an exclusive claim.
2. Run scoped Vitest and the opt-in disposable PostgreSQL integration test, verify disabled-actor false, active-peer revocation true and idempotent updated_at, then code/type checks.
3. Preserve the C01/R18 Gateway composer collision (#435), U21 Contacts Hub (#508), U24 request UX (#510), canonical C02 F15 migration contract, C03/C05, F12 five-tab router, Work #497 and Firebase #461. Do not merge C01 until those dependencies are semantically resolved.
4. Validate actual authentication expiry/deactivation, anti-enumeration, block/revoke, two-user restart/deep links and contact messaging send-time authorization. CI issue #457 and real devices remain independent gates.

**Not deployed, not merged, no production mutations.**
