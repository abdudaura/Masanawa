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

## Fresh scoped shared Gateway integration claim — 2026-10-08
- Rechecked open PR changed paths: **only R18 #435** currently overlaps `services/gateway/src/app.ts` and `services/gateway/src/main.ts`, and #435's latest repository-visible update is **2026-10-08 05:53 UTC**, more than five minutes old. Its avatar work is preserved, unmerged, and must not be overwritten.
- Published coordination notice to #435 with exactly the additive C01 imports, optional service injection, real database repository and session authorizer composition; no modifications to its avatar/S3/profile logic.
- Narrow additional owned paths after fresh claim: `services/gateway/src/app.ts` and `services/gateway/src/main.ts`, **only** the non-overlapping humanContact imports/interfaces/repo factory/auth wiring/route registration segments; no other shared platform paths.
- Re-read fresh main blob SHAs immediately before every edit; on conflict merge rather than force. No CI workaround or unverified release/merge.

## Concrete Gateway integration increment — 2026-10-08
- After notifying R18 PR #435, scoped C01 optional route registration into `services/gateway/src/app.ts` and real repository/auth composition into `services/gateway/src/main.ts` were implemented on this branch. These additions use the **canonical customer session authorizer** and existing Postgres pool; they do not add a parallel login.
- Added `services/gateway/src/human_contacts/composition.test.ts` for real `createGatewayApp` inject tests (opt-in route installation, authenticated self, privacy-safe 404).
- R18 #435 still modifies those two shared files; preserve and semantically reconcile both PRs during integration. API is **source-wired in this branch, not deployed on main**, so C01 is not available in the currently installed app.
- **No source-level tests have executed yet** in this connector-only session (GitHub Actions quota #457). PR remains DRAFT, with real Postgres, TypeScript/Flutter, two-device, profile privacy and deletion tests still required.


## C01 continuation — authenticated Flutter contact feature (2026-10-08)

**Ownership/recovery:** Existing draft PR #468 was reused, not duplicated. Fresh lease and intended new mobile paths were publicly claimed in [PR #468 comment 6058235693](https://github.com/Baatiku/masanawa/pull/468#issuecomment-6058235693). Earlier C01 activity at 10:13 UTC was stale at reclaim. Baseline `main` at inspection: `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`. This PR deliberately remains **DRAFT and UNMERGED**; GitHub compare after the mobile commits showed 44 commits ahead and 2 behind `main` (reconcile, do not force-push).

**New C01-owned source paths (no R17/C08 routing edits):**
- `apps/mobile/lib/src/messages/human_contacts_transport.dart`: fully typed human account/contact/preferences/status DTOs, exact normalized @handle validation, authenticated Gateway `/messages/contacts/*` operations, recipient IDs instead of persona IDs, privacy-preserving 404 lookup, rejection of malformed acknowledgments, bounded lists, no client-imagined accept/send, and no request without current bearer.
- `apps/mobile/lib/src/messages/human_contacts_controller.dart`: Riverpod account-lifetime contact state, server-refreshed preferences/list, exact lookup, request/accept/decline/revoke, loading/network/server error, retry, no optimistic permission, discard late account-switch/logout response and stale search results.
- `apps/mobile/lib/src/messages/human_contacts_screen.dart`: compact explicit handle-search, incoming consent actions, outgoing/cancel/accepted/revoke actions, policy and handle visibility settings, confirmation before revoke, real feedback and refresh, and signed-out privacy gate. **No disabled/fake direct-message action**: C02 real messages and C08 final five-tab entry do not exist on this branch.
- `apps/mobile/test/human_contacts_transport_test.dart`, `human_contacts_controller_test.dart`, `human_contacts_screen_test.dart`: executable test **source written** (bearer, hidden/unknown lookup, exact request/response, deny/error, account switch, out-of-order lookup, signed-out controls and UI flows). No mock service is shipped; local doubles exist only inside tests.

**Proof/state fields:** `SOURCE_WRITTEN=yes` (GitHub commits); `LOCAL_TESTED=no`; `CI_EXECUTED=no`; `DB_INTEGRATED=no`; `APP_INTEGRATED=no` (isolated Flutter screen is not mounted into final C08 shell); `DEPLOYED=no`; `DEVICE_VERIFIED=no`; `PROVIDER_QUALIFIED=n/a`; `MERGED=no`; `BLOCKED=GitHub Actions #457, no Flutter/Dart/Postgres/runtime in this connector environment, C02 and C08 dependency ownership`. This is **PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED source**, never C01 DONE or a shipped human chat.

**Exact Work verification/handoff:**
1. Fetch fresh `main`, existing #468 HEAD and R18 #435 changes; confirm claims and inspect exact Gateway app/main diffs. Semantically reconcile both additive Gateway compositions and migration `0015` before `0016` without deleting either. Review `main`'s later two commits before cherry-picking/rebasing. Do not merge unverified code.
2. With Node/pnpm/Postgres available: `pnpm --filter @masanawa/gateway-service typecheck`, `pnpm exec vitest run services/gateway/src/human_contacts/*.test.ts`; apply real migrations on a disposable Postgres with canonical identity/profiles/safety tables and test two real tenant-scoped accounts, reciprocal block, idempotent concurrent request, acceptance, decline, revoke, deactivation, discovery privacy, policy changes and deletion.
3. With real Flutter SDK: `cd apps/mobile && flutter analyze && flutter test test/human_contacts_transport_test.dart test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart`, then all mobile regression tests and an actual APK build. Fix any compile/analyzer errors and record real command exit codes. None was executable in this environment.
4. R17/C08 owner alone mounts `HumanContactsScreen` inside authenticated human-only `/messages` search/new-message flow, preserves legacy AI `/chats` semantics and 5-tab order, tests deep links/back/drafts; C02 owner adds server-authorized message delivery and checks fresh C01 policy/blocks at send time. R12/R15 validate deletion and reciprocal block behavior. Only after C02–C05 and Android two-account roundtrip may J03/J04/J10 be certified.
5. Real mobile/network matrix: account A sign-out and B sign-in during pending lookup/request, blocked and hidden handle lookups, request acceptance on B device, throttled/timeout/offline retry, revocation mid-conversation, large text and accessibility, process restart, Gateway deployed SHA, latency and logs without leaking addresses or DM content. Report `SOURCE/LOCAL/CI/DB/APP/DEVICE/MERGE` independently. No automatic payment or Talk/AI context sharing.

**Do not solve #457 by modifying CI/Actions billing here.** Keep #468 draft, no deploy, no release-gate sign-off. C01 owner scope is contact authority and UI; real DMs, media, crypto transfers and final router remain separate C02–C08/R owners.


### Further C01 database verification source (same ownership lease)

Added `services/gateway/src/human_contacts/postgres_integration.test.ts` at commit `8f0b4b5aa40910e75679389e496aff073d8890b3`: **actual** `@masanawa/postgres` migration and Postgres queries, isolated randomized tenant/user/profile fixtures, concurrent idempotent request, consent/revocation, cross-tenant/self/hidden lookup, reciprocal blocks and inactive-recipient checks, with test-only fixture cleanup. This suite intentionally skips without two explicit safeguards; a skipped test is **not a PASS**. It requires both `MASANAWA_C01_ENABLE_DB_TESTS=yes` and `MASANAWA_C01_TEST_DATABASE_URL` pointing to a **loopback PostgreSQL host and database whose name ends in `_test`**. Example command in a terminal with a disposable Postgres + migration-capable extensions installed:

```bash
MASANAWA_C01_ENABLE_DB_TESTS=yes MASANAWA_C01_TEST_DATABASE_URL='postgresql://tester:local-password@127.0.0.1:5432/masanawa_c01_test' pnpm exec vitest run services/gateway/src/human_contacts/postgres_integration.test.ts
```

Use real local test-only credentials in the runner, never copy a production database URL into this command and never commit a secret. The integration test **has not run**; the other six C01 backend/Flutter test files also remain unexecuted. Work must record any migration extension/schema/transaction failures and fix them on the draft branch before release.


### Additional review risks, not release claims

- Exact-handle lookup now maps **only** the Gateway's structured `messages.contact_unavailable` 404 to a private not-found; a generic 404 from an undeployed `/messages/contacts` route propagates as a transport error. Flutter regression coverage added.
- **Shared auth interceptor caution:** `ApiClient` owns 401 refresh/retry for every Dio request. Flutter C01 suppresses stale A→B results and checks current owner before actions, but a cross-account sign-in *during* 401 replay needs a dedicated shared-client identity-fencing test and, if necessary, coordinated fix under canonical auth ownership. Do not equate UI stale-response suppression with proof that no request can be sent under a changed principal. Run the A→B mid-401 request test before deployment.
- The `HumanContactsScreen` is a real, **isolated** C01 widget—not currently reachable from an approved route. C08 integration and C02 delivery are hard prerequisites; do not describe its presence in source as an end-to-end shipped contact journey.


## C01 stale lease reclaimed for contact revocation correctness — 2026-10-08T11:51:22.088Z

- Continuing **existing draft PR #468 and branch** `work/c01-private-contact-admission-20261008`; last PR activity 2026-10-08 11:04:53 UTC, stale beyond 5 minutes at 2026-10-08T11:51:22.088Z. No force push, no duplicate PR.
- Owner/window: GPT-6 C01 correctness continuation. Baseline existing head `708506ca7e35b73b393401b570ccc8093f7ddd33`; current canonical main `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. Conflict/reconciliation R18 #435 and C02 #472/#475 remains deferred.
- Narrow ownership: `packages/talks/migrations/0016_human_messaging_contacts.sql`, `services/gateway/src/human_contacts/{model,postgres_repository,postgres_repository.test,postgres_integration.test}.ts`, and `apps/mobile/lib/src/messages/{human_contacts_transport,human_contacts_screen}.dart`, focused Flutter tests and this handoff. No root shell or shared auth interceptor changes; other C owners retain routes, ledger, C08 navigation.
- Security defect under review: a revoked accepted human contact becomes indistinguishable from ordinary decline, allowing the original invite recipient to accept again without the revoker's fresh intent. SQL request UPSERT similarly cannot reopen a declined connection. Implement an explicit revocation tombstone and fresh consent recovery path, update mobile status/error tests. Preserve API compatibility where possible; leave entire C01 unverified pending executable DB/Flutter integration.
- Status: `PARTIAL_IMPLEMENTATION` until bounded code/tests are committed; `TESTED=false`, `DEPLOYED=false`, `MERGED=false`. CI #457 already blocks GitHub-hosted checks; do not retry quota. Five-minute claim refreshed by this GitHub commit.


### Revoke/reconnect safety correction — 2026-10-08T11:54:50.674Z

**SOURCE COMMITTED ON THE EXISTING #468 DRAFT (NOT VERIFIED):** Preserved the C01 human-only tenant/identity table pair and added a durable `revoked_by` column to its unmerged `0016_human_messaging_contacts.sql` migration. A revocation is no longer an ordinary decline. SQL rejects re-acceptance after revoke, keeps the original revoker immutable against a peer's retry, and allows **only** the revoker to initiate a new pending request, even if the recipient selected `anyone`. Atomic `ON CONFLICT` serializes same-pair retries. Private exact-handle lookup yields `revoked` only for the revoker, never grants messaging based on an old consent edge. A non-revoker sees `declined`; neither can silently reauthorize. The Flutter transport parses this state and the existing authenticated contact UI offers a working `Request reconnect` command, with server-acknowledged status and no optimistic grant.

**Concrete changed files:** SQL migration `packages/talks/migrations/0016_human_messaging_contacts.sql`; Gateway `services/gateway/src/human_contacts/model.ts`, `postgres_repository.ts`; Flutter `apps/mobile/lib/src/messages/human_contacts_transport.dart`, `human_contacts_screen.dart`; regression tests `postgres_repository.test.ts`, `postgres_integration.test.ts`, `human_contacts_transport_test.dart`, `human_contacts_screen_test.dart`. Existing auth, API wiring and service routes remain in the preserved #468 branch. No mock production shortcuts and no shared router/financial/provider changes.

**Caveat:** A stale recipient UI accepting a *new* pending request still requires normal server admission, and the final Work integrator should consider a request-version/nonce binding in C01/C02 before production to rule out stale UI response replay across revocation/re-request. This is a remaining security review, NOT proof of guaranteed replay fencing.

**Unexecuted commands** (there are no locally executed test results in this connector-only run; GitHub Actions #457 has exhausted its budget): `pnpm --filter @masanawa/gateway-service typecheck`, `pnpm exec vitest run services/gateway/src/human_contacts/*.test.ts`; guarded real PostgreSQL test `MASANAWA_C01_ENABLE_DB_TESTS=yes MASANAWA_C01_TEST_DATABASE_URL=postgresql://tester:<local-password>@127.0.0.1:5432/masanawa_c01_test pnpm exec vitest run services/gateway/src/human_contacts/postgres_integration.test.ts` (use disposable local credentials and make sure environment matches the guard); `cd apps/mobile && flutter analyze && flutter test test/human_contacts_transport_test.dart test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart`, full regression/Android build, two real accounts + app process restart, concurrent accept/revoke/re-request, blocked/hidden/deactivated recipients, auth refresh A→B switching and both sides' list updates. All **UNVERIFIED**.

**Remaining owned/integration gaps:** C08/R17 route entry and approved five-tab shell; C02/C03/C04/C05 message enforcement, realtime, media/cache and human thread UX; R18 #435 Gateway/avatar shared-file merge, C02 #472/#475 conflicting contact schemas, R12 cleanup and R15 reciprocal safety gate; CI #457 runner and disposable DB/device evidence. Preserve their branches. `SOURCE_WRITTEN=yes`, `LOCAL_TESTED=no`, `CI_EXECUTED=no`, `DB_INTEGRATED=no`, `APP_INTEGRATED=no`, `DEPLOYED=no`, `MERGED=no`, `DEVICE_VERIFIED=no`. Overall C01/J03/J04 remains **PARTIAL_IMPLEMENTATION**, never DONE. Future Work owner must keep this PR draft until truly green.


### New-contact revision binding — 2026-10-08T11:58:05.967Z

**Bounded source change:** C01's `0016` migration now stores positive monotone `request_revision`. A revoker-driven new invitation atomically increments that version; unchanged idempotent retries do not. The authorized recipient's current lookup/list projection contains the revision, the Flutter DTO/controller/Accept and Decline buttons forward it unchanged, and the Gateway requires it on every response. SQL compares `request_revision=$5::bigint` as well as tenant, participants, blocked/disabled and revocation checks. Old approval/rejection against a *new* pending request now fails closed (404), instead of acting on stale mobile state; absent/invalid revision fails validation. The consent revision is a compare-and-set binding, **not** an authentication credential or money authorization.

**Exact additional paths:** `services/gateway/src/human_contacts/{model,service,routes,postgres_repository}.ts`, `packages/talks/migrations/0016_human_messaging_contacts.sql`, `apps/mobile/lib/src/messages/{human_contacts_transport,human_contacts_controller,human_contacts_screen}.dart`, matched `services/gateway/src/human_contacts/{service,routes,composition,postgres_repository,postgres_integration}.test.ts`, `apps/mobile/test/human_contacts_{transport,controller,screen}_test.dart`. Shared root routing remains R17/C08-owned. **No tests executed**: GitHub has no check context at prior HEAD and Actions #457 is exhausted; local environment has no Flutter, pnpm project install or disposable Postgres. Existing commands and Work handoff above remain mandatory; also test old revision 1 rejected after re-request revision 2, idempotent retries preserve revision, account-switch stale approvals, and Flutter missing-revision controls. `PARTIAL_IMPLEMENTATION`, not C01 DONE / E2E / DEPLOYED. Draft remains unmerged.


### Static review and source repair — 2026-10-08T12:00:09.823Z

Static source review (NOT executed tests) found a regression introduced by the prior revision edit: JavaScript replacement-string interpolation of a Dart regex appended duplicated stale source into `human_contacts_transport.dart`. Rebuilt that file from its pre-revision clean blob `0e276622ac660175894e6a402d635474bd29784a` and reapplied intended DTO, parser and transport changes using literal callback replacements. Corrected the `respond` transport test to send the required revision; added service non-string revision defense. This commit supersedes the corrupted intermediate version. **No executable tests passed**; Work must still run Dart analyzer and full tests. The PR remains draft/unmerged.


### Moderation and request-revision hardening — 2026-10-08T12:01:43.948Z

C01 PostgreSQL recipient approval now checks current `talks.safety_enforcement` restrictions on either public profile as well as reciprocal safety blocks and active identities. A person restricted between request and approval cannot gain consent through a stale screen. Added SQL assertion and service missing/malformed/overflow revision tests. Flutter rejects request revisions outside signed 64-bit PostgreSQL range. This is source/test creation ONLY: no executable Postgres, Vitest, Flutter or Android result; original #457 runner exhaustion unchanged. C02 must still enforce safety at **actual message send**, not trust approved contact projection. Stay draft/unmerged.


### Disposable PostgreSQL moderation regression — 2026-10-08T12:02:55.295Z

The guarded opt-in real `postgres_integration.test.ts` now sets an actual `talks.safety_enforcement` `restricted` profile on the requester *after* the recipient has received the request, asserts acceptance is refused, removes that isolated fixture, then checks a legitimately permitted acceptance. Fixture teardown includes `safety_enforcement` rows for the ephemeral tenant. SQL source assertions alone are not used as a substitute for DB verification. **The DB suite remains UNEXECUTED** pending disposable loopback `*_test` PostgreSQL and #457 Work verification.


### Restart-safe revoked contact projection — 2026-10-08T12:04:53.643Z

Previously a revoker's contact disappeared from the server list immediately after revoke; deliberate reconnection required remembering their handle. C01 `list` now returns a `revoked` projection **only to the actor who revoked**, while the other party's revoked row remains absent from their list. It carries no permission to DM and retains an exact server revision for subsequent request handling. The existing authenticated Flutter screen now exposes the same real `Request reconnect` action on that server-backed saved contact row after reload/restart; no client persistence or optimistic regrant. Added opt-in Postgres checks for revoker-visible vs peer-hidden and widget list-recovery test. C02 still owns actual DM admission and R17/C08 owns mounting this screen; no production UI claim. No tests executed, draft.


## Owner-assigned ChatGPT Work executable verification — scoped reclaim
Updated UTC: 2026-10-08T12:18:00Z. Work integration PR #497. Fresh PR #468 head remains 9b63401dde4d9aeeaeb10ba4f80575cf71cb4a0e; latest activity 12:06:07 UTC, stale beyond five minutes. Preserve existing branch and all other C01 production source.

Narrow claimed repair paths: services/gateway/src/human_contacts/routes.ts, routes.test.ts, postgres_repository.test.ts and this handoff. No app.ts/main.ts, Flutter, migration, ledger or other lane writes. Executed local Node24/pnpm12 frozen install and real Vitest C01 suite: 19 passed, 2 failed, 3 DB skipped at immutable head over recovered main 1d6a67e. Failures: Fastify removes additional body properties before validation, so policy+forged userId returns 200 contrary to strict contract; repository test retains obsolete pending-only predicate assertion after allowed same-revision preference changes. Gateway typecheck failed with broader declaration/test errors; baseline comparison pending. No C01 DONE or merge. Next: fix exact-body admission before AJV, align assertion to current consent policy, rerun tests and attempt disposable PostgreSQL.


## Work Flutter execution — scoped test repair
Tested source ee4e7372745ba1efa01736c0dff88d4f9d94d1f6 on Node24/pnpm12 plus Flutter3.47.6/Dart3.13.5. C01 backend 21 passed / 3 PostgreSQL skipped. Flutter C01: 20 passed / 1 failed. Failure is an obsolete exact-text finder: UI correctly renders `@bob · You removed this connection`, while test expects a separate bare status Text widget. Claim only apps/mobile/test/human_contacts_screen_test.dart plus this handoff for assertion repair; no C01 production widget change. Full Flutter analyzer executed: 484 issues in combined recovered main+C01; C01 paths have 3 info-level lint findings, no errors or warnings. Most main errors include pre-existing corrupt gift transport/store and shadowed locale annotation already repaired on #460; Work #497 preserves/revalidates those separately. Native PostgreSQL18 cannot start under sandbox user-switch permissions. No C01 E2E/device/deployment/merge acceptance.


## Work execution checkpoint — 2026-10-08

Verified source head `f4551467d46e4fc708e4f3bbafbebc17aaf68a36` on recovered main `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`, with C01 source overlaid. Node 24.19.0, pnpm 12.8.2; Flutter 3.47.6/Dart 3.13.5.

- C01 backend focused suite: 21 passed, 3 database tests skipped. Strict request-body injection regression tests pass.
- Flutter `test/human_contacts_transport_test.dart test/human_contacts_controller_test.dart test/human_contacts_screen_test.dart`: 21 passed. Fixed stale text finder against the composite revoked-contact subtitle; production behavior unchanged.
- Gateway typecheck: same 74 errors as recovered main, zero additional C01 errors. This is NOT a passing typecheck.
- Full mobile analyzer: 484 issues in recovered main+C01; C01 paths have only 3 informational lints, no error/warning. Pre-existing gift-source syntax corruption and other main issues still block global analyzer.
- Database execution, multi-device contacts, migration ordering with R18, final Gateway/root composition, APK/device and provider qualification remain OPEN. Native PostgreSQL cannot initialize under the available sandbox user restrictions. Hosted Actions quota remains blocked by #457.

C01 is locally verified for the listed unit/widget scope, not DONE or merged. Work integration evidence continues in PR #497.
