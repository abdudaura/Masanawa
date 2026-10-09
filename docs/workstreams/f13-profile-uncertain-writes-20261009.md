# F13 / R18 — uncertain profile-write recovery (2026-10-09)

**Status:** bounded Flutter editor safety fix SOURCE_COMMITTED / STATIC_READBACK_VERIFIED / DART_TESTS_NOT_RUN. Whole F13/R18 **PARTIAL_IMPLEMENTATION**. **DRAFT / UNMERGED / NOT DEPLOYED**, not E2E accepted.

## Scope claim, ownership and source identity

- Existing draft: [PR #435](https://github.com/Baatiku/masanawa/pull/435), branch `work/r18-avatar-end-to-end-20261008`. Existing implementation, migration, backend, widgets and prior handoffs were retained.
- Latest `main` inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`. Original PR head before claim: `cb40c32de11af93efa5114bf45675f39e8fd4c7c`; prior visible activity 2026-10-09T02:47:27Z, older than five minutes when reclaimed.
- Exact-path claim committed **before source edits**: `0ed33cce07f821ec8e523a5ac77f808bce62a35d` at approximately 03:13 UTC. Five-minute lease expires without further repository-visible activity. Previous #435 source and workstream claims inspected, no competing fresh R18 edit at claim.
- Scoped source/test checkpoint: **`1d9a19ed3f6c7b2f5242e4fc23e5d81f224a6db2`**. Code commit `6c36910ae39b8d0dcb53eaf9dd88e23bf2402851`, test commit `48c7a3e1fb56da753654bae20a1c01daf5718035`, test correction `1d9a19ed3f6c7b2f5242e4fc23e5d81f224a6db2`. The final handoff commit follows this source checkpoint; retrieve exact current HEAD from PR #435.
- **Exclusive changed paths:** `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`, `apps/mobile/test/edit_profile_screen_test.dart`, this handoff file. Branch compare against pre-claim head: four commits ahead, zero behind, and **only these three paths changed**. All shared Gateway `app.ts/main.ts`, `talk_profiles`, financial source, native/Firebase config, navigation, database/migrations, and other teams' files untouched.
- Requirements: R18/F13 authenticated profile write/readback/restart trust, per-account privacy, J-person-profile editing journey; F12 five-tab navigation must remain Talks · Chats · Assistant · Wallet · Agents. No new UI page or user-facing provider flow.

## Implemented source (not a released feature)

Problem: After an ambiguous network/service exception during profile update/create (including when the server already committed), the editor warned to reload but still left Save enabled, letting a user send a second non-idempotent or stale update. A failed reload could likewise leave old editable data.

- New explicit `_requiresReload` fence disables Save and photo mutation after any uncertain profile create/update/delete chain; server-committed changes are **not** assumed to have failed.
- Photo errors **before** upload dispatch (picker/crop) remain retryable; only an attempted upload or subsequent failed readback requires reconciliation. Existing native image selection and server-side S3 policy are unmodified.
- An authoritative successful `GET /profiles/me` clears the fence and refreshes form state; an authorized 404 permits first-time create; a failed GET keeps the lock. The visible `Reload from server` action is retained.
- Account switching/sign-out clears the previous session's fence along with drafts, preserving existing old-request epoch suppression and same-user token-refresh continuity.
- Three new fake-transport widget regressions cover (1) committed-but-unacknowledged PATCH without replay, (2) committed-but-unacknowledged first-time create without duplicate POST, (3) failed readback still blocked until a successful GET; existing failed-save retry test now requires server reload first. **13 total widget tests authored in the file; all must be executed**.

## Evidence and limitations — do not misrepresent

- **PASS (static source integrity only):** GitHub readback and 14/14 explicit structural predicates covering UI guard, async error/readback states, account identity reset, photo submission fence, regression declarations and safe exact-path diff. This is **not** a Dart analyzer, widget runner or emulator execution.
- **NOT RUN:** `flutter analyze`, `flutter test`, physical Android photo/credential/account tests. This tool environment has no `flutter` or `dart` command or local private-repo clone; source was read/written through authenticated GitHub connector.
- **CI BLOCKED:** shared Actions quota/runner issue [#457](https://github.com/Baatiku/masanawa/issues/457); other runs failed before steps. Do not retry the known quota block or claim new CI outcome for this checkpoint without checking actual runner steps.
- **NOT RUN:** Gateway TypeScript/Vitest/PostgreSQL/S3/profile cleanup, current deployed app build, Firebase and two-device profile tests; this narrow change does not provide those qualifications.
- **No customer data, credentials, bills, crypto transfers, production changes, deployments, merges or branch deletion.**

## Exact acceptance for the integration owner

1. Fetch **PR #435 current HEAD** and verify comparison against current main. In `apps/mobile`, run `flutter pub get`, `flutter analyze lib/src/screens/profile/edit_profile_screen.dart test/edit_profile_screen_test.dart`, then `flutter test test/edit_profile_screen_test.dart`. Record Flutter/Dart versions, sha, full output and failures; fix any analyzer/runtime regressions. Static predicate success is not executable test success.
2. Real Android/Gateway account A edits name, server commits but HTTPS response is dropped: Save and photo are disabled until a fresh authenticated GET, then server-truth is visible and no duplicate PATCH/POST occurs. Try failed GET and retry, ambiguous 409, unauthorized 401, photo picker-denied/error before and after dispatch, app restart and A→B→A session switches. Test authenticated B cannot see/mutate A; backend auth and CAS remain mandatory regardless of client fence.
3. On same integration SHA, qualify existing PR #435 owner-scoped S3/WebP staging, garbage retry and historical avatar links; PostgreSQL migrations in order `0015` profile journal → `0016` C01 contacts → `0017` C02 DMs. Reconcile #435 shared Gateway with C01 [#468](https://github.com/Baatiku/masanawa/pull/468), Work [#497](https://github.com/Baatiku/masanawa/pull/497), Firebase [#461](https://github.com/Baatiku/masanawa/pull/461) and F12. The deferred safe existing-handle rename/alias migration remains unimplemented; do **not** claim global F13 complete.
4. Repeat backend/device/CI tests after actual merged SHA only with owner approval. Keep draft until real results are recorded. Rollback this bounded change by reverting its commits, not deleting previously implemented R18 assets.

**Risk:** This client-side write fence deliberately discards unsaved edits on reconciliation and cannot cancel already-dispatched POST/PATCH/S3 requests. Server-side authorization, idempotency/CAS and persistence still decide actual outcomes. Backend/profile and provider integration remain unavailable on main until reviewed/merged.
