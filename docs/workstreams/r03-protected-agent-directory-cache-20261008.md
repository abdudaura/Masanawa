# R03 / R16 — protected, account-scoped offline Agent roster cache

**Updated:** 2026-10-08, Africa/Lagos. **Window:** GPT-6 R03 protected directory cache.  
**Status:** IMPLEMENTED_UNVERIFIED for this **bounded local cache privacy/recovery source**; **entire R03 is PARTIAL_IMPLEMENTATION**. NOT DONE. Draft/unmerged, no Android proof.

## Claim / ownership
- Claim was committed first at a5f6a3dee75c72a0e299d6f202cff240e3730c0c. Five-minute lease is determined by last repository-visible branch activity; check the latest GitHub commit before reclaiming.
- Base main: 1d6a67ea3c182455b55a7d1d07eacdb4311682e3.
- Branch: work/r03-protected-agent-directory-cache-20261008-gpt6.
- Implementation SHA: d132e045abd142fc35ab88f42104dd8933d5c5f5.
- Regression test SHA: ec00fb86b52531cc170cbfeffb8f8f7f06c96925. Handoff is the next checkpoint commit; fetch branch HEAD for its exact SHA.
- Pull request: draft PR linked in the branch's GitHub PR metadata/body.
- Requirements: R03 (server-driven persona directory/cache), R16 (local privacy/recovery); P03/P08, N05, J06/J10/J11.

**Exclusive touched paths:**
1. apps/mobile/lib/src/agents/agent_directory_cache.dart
2. apps/mobile/test/agent_directory_secure_cache_test.dart
3. docs/workstreams/r03-protected-agent-directory-cache-20261008.md

Existing R03 preference draft #495 edits agent_directory_state.dart and settings_screen.dart, not the cache. Existing R16 Android backup draft #455 is complementary. No claims on shared Gateway app/main, database/ledger, auth/session, root navigation or l10n. The existing AgentDirectoryController and its signed-in/401/403 clearing behavior remain canonical.

## Implemented source (no end-to-end success claimed)
- Existing app provider still instantiates const FileAgentDirectoryCache; its compatible constructor now writes only through FlutterSecureStorage (Android OS secure storage; iOS this-device-first-unlock Keychain). No package additions or mock runtime transport.
- Removes old readable masanawa_agent_directory_v1.json and .tmp on read, write or clear without migrating the old plaintext data into protected storage. Fresh server refresh remains authoritative when the old snapshot is lost.
- Stores one version-2 account-bound snapshot; refuses a different account, empty owner, corrupt/wrong-version contents, over-250 entries or over-256-KiB values. Does not cache tokens, skills, runtime permissions, microphone eligibility or finance.
- Before persisting and after restoration, drops live presence and workload counts. Offline fast startup shows only historical identity/presentation, not false server readiness.
- Keychain failures fail closed to network refresh without new readable files. In-memory directory denial/logout logic is unchanged.
- Serialized reads/writes/clear across cache instances prevent an already queued pre-logout write from recreating the roster after clear completes.
- Actual Flutter and authenticated server flow are already connected in main: agentDirectoryProvider -> agentDirectoryTransportProvider -> GET /agent/directory -> authorized presentation repository. This PR changes only the protected local persistence seam; no new DB schema/API/credentials are applicable.
- New real filesystem-based tests use a temporary directory for deleting legacy plaintext; a fake *test-only* protected storage adapter checks the native storage call contract. They are not native encryption/device proof.

## Tests and checks
**Executed:** GitHub create/update file commits succeeded. No Dart/Flutter code tests or Android runs executed in this tool environment. Do not infer a passing test, format, compile or deployed behavior.

**NOT executed — final Work integrator MUST run on a Flutter/Android toolchain:**
1. cd apps/mobile && flutter pub get
2. cd apps/mobile && dart format --output=none --set-exit-if-changed lib/src/agents/agent_directory_cache.dart test/agent_directory_secure_cache_test.dart
3. cd apps/mobile && flutter analyze
4. cd apps/mobile && flutter test test/agent_directory_secure_cache_test.dart test/agent_directory_fast_start_test.dart test/agent_directory_readiness_test.dart
5. cd apps/mobile && flutter test
6. On an actual Android device upgraded from the old app with v1 plaintext snapshot: sign in, confirm old v1 file is deleted; force stop and reopen with network offline; confirm historical roster but presence unknown; restore connection and confirm authentic server refresh; switch user, sign out during a slow refresh, revoke token/403, and confirm neither old user's roster nor restored past presence is shown. Inspect Android app private storage/backup artifacts and native encrypted storage behavior without logging actual secrets.
7. Reconcile with draft #495's state changes and #455's Android backup policy before merge; run full Flutter suite and a production release build after integration.

**Known shared CI blocker:** #457 documented exhausted GitHub Actions quota/failed before job steps, not a code verdict. Do not retry unavailable CI or label these tests green. Native storage security and upgrade recovery require actual device verification under the final Work integration window.

## Dependencies and safety
- Database migrations: N/A (offline presentation cache only). Backend routes, auth, PostgreSQL: unchanged; existing signed-in service still owns authoritative visibility/tenant/user and 401/403 denial.
- Voice/text/tap: no new action UI; fast-start roster remains the same existing Agents surface. Offline historical roster never creates paid admission or permission.
- Encryption: native plugin rather than custom crypto; its release-keystore, Android backup rules, iOS behavior, package compatibility and error paths require device proof. Old plaintext installed before upgrade might remain in external device backups; this code cannot revoke historical backups.
- Recovery: missing/corrupt/denied secure value causes authenticated API refresh; native keychain unavailable => skip cache, never fall back to plaintext. Failed legacy deletion is best effort, not claimed secure erasure; inspect upgrade devices. Storage.delete failure leaves an OS-stored snapshot; the session controller clears memory and cross-owner reads remain denied, but device tests must verify logout persistence behavior.
- Risk: unverified Flutter compile and native keychain integration; cache snapshot remains historical until server refresh; do not treat as runtime availability proof.
- Rollback: revert this PR to prior source only after considering that doing so reinstates plaintext caching, which is a privacy regression. Safer rollback is to disable the optional fast-start cache in a separate reviewed fix while retaining live directory fetch.

## Final one-window Work integration instructions
1. Read this file on the branch, compare with latest main and open PRs; preserve #495 state changes, #455 backup policy and root shell #493.
2. Run exact format/analyzer/tests above, fix any actual Dart/plugin issues; verify full Flutter and physical Android upgrade/account-switch/offline matrix.
3. Check Android secure storage, backup and app-private directory for any v1 JSON remnants; treat failed cleanup as unresolved until measured.
4. Merge only after executable proof and no relevant conflicts, rerun relevant J06/J10/J11, and update R03 ledger with actual evidence. Preserve any remaining unverified claims.
5. Recheck five-minute lease and pick a nonoverlapping next lane; do not duplicate C02/C05/C06 or take the shared R17/C08 shell.

## Release gates
SOURCE_WRITTEN: YES. LOCAL_TESTED: NO. CI_EXECUTED: NO (#457). DB_INTEGRATED: N/A (unchanged server). APP_INTEGRATED: existing provider/source only; **runtime UNVERIFIED**. DEVICE_VERIFIED: NO. PROVIDER_QUALIFIED: N/A (no new provider). DEPLOYED: NO. MERGED: NO.
