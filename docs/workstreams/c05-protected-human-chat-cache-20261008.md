# C05 — Protected, indexed human-chat history and offline outbox

- Owner: ChatGPT, independent C05 mobile-performance lane.
- Branch: `work/c05-protected-human-chat-cache-20261008`
- Started: 2026-10-08T10:59:09.225Z (repository-visible lease; recheck current activity after 5 minutes).
- Base: main `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
- Requirement refs: N02, P05, P07; J03, J04, J10, J11.
- Exclusive source paths: `apps/mobile/lib/src/messages/cache/**`, `apps/mobile/test/messages/cache/**`, `apps/mobile/pubspec.yaml` (only C05 SQLCipher dependency). No shared shell/route, Gateway app/main, provider/ledger, C01/C02 or CI workflow edits.
- Dependency: two incompatible active C02 branches both claim `0017`: `work/c02-durable-human-dm-20261008` vs `work/c02-private-text-core-20261008-gpt6`. These must be reconciled into one canonical API/schema before C05 may wire live synchronization into R17/C08 navigation. C01 is unmerged PR #468.
- CI block: #457 Actions budget; Flutter/Dart SDK unavailable in this execution environment. Do not report tests as run.
- Implementation target: encrypted per-account indexed local cache, stable message identity and paged history, safe pending outbox with crash-consistent request IDs, tombstones, bounded pruning, and account switch/sign-out removal. Build isolated component and relevant tests, then hand off shared root integration only to R17/C08.
- Status: CLAIMED / NOT VERIFIED. Never call this full C05 or J03/J10 DONE without real API, two-device/Android benchmark proof.

## Implementation checkpoint — 2026-10-08T11:10:06.569Z

**Current status: PARTIAL_IMPLEMENTATION, UNVERIFIED — draft/unmerged.** The standalone C05 mobile source is substantial but not a connected production Chats feature. No test pass, E2E, release build or security audit is claimed.

### Source committed
- `apps/mobile/lib/src/messages/cache/human_chat_models.dart`: typed server-acknowledged messages, server-authorized person list, stable IDs, tombstones, and honest pending/unknown/blocked outbox.
- `apps/mobile/lib/src/messages/cache/human_chat_cache.dart`: per-tenant+user SQLCipher SQLite file with 256-bit random secret in platform secure storage; no silent wrong-key reinitialization; indexed conversations, sequence pages, unread projection, durable request IDs, atomic message/delta cursor and outbox acknowledgment; stale tombstone cannot restore deleted content; explicit account purge and verified conversation revocation; bounded oldest-message eviction.
- `apps/mobile/lib/src/messages/cache/human_chat_sync.dart`: deterministic UUIDv4 local queueing, bounded sequential cursor catch-up, 50-row inbox, timeout/unknown retry of **same ID**, definitive server-blocked state and late-response deactivation safety. `HumanChatRemote` is an interface awaiting **one real C02/C03 transport**, not a fake backend.
- `apps/mobile/lib/src/messages/cache/cached_human_chats_list.dart`: nonblocking indexed local-first person inbox with verified display labels, unread count and callback to typed conversation route.
- `apps/mobile/lib/src/messages/cache/cached_human_chat_thread.dart`: locally paged virtualized human-thread UI; no public Talk/AI transcript reuse; visible send/unknown/blocked states, cache first then bounded background sync; no invented voice/transfer controls (C04/C06 owners).
- `apps/mobile/pubspec.yaml`: SQLCipher 3.4.1, crypto 3.x, dev SQLite FFI 2.4.3.
- Tests authored: `apps/mobile/test/messages/cache/human_chat_cache_test.dart`, `human_chat_sync_test.dart`, `cached_human_chat_thread_test.dart`, opt-in `human_chat_stress_test.dart` (1k threads/100k rows). These use **real FFI SQLite schemas/transactions**, no production in-memory substitute. FFI does NOT qualify SQLCipher Android encryption.

### Blocked or missing implementation — remain OPEN
1. **C02 source conflict:** two concurrently authored branches each claim incompatible `0017` tables, API paths and send idempotency field: `work/c02-durable-human-dm-20261008` (`/messages`/`clientRequestId`) vs `work/c02-private-text-core-20261008-gpt6` (`/v1/messages/conversations`/`clientMessageId`). Issue #463 has an explicit collision alert. Resolve C01 PR #468 consent + one canonical C02 schema/routes first. Implement the single genuine `HumanChatRemote` Dio transport, typed server-side errors, and C03 event cursor; do **not** merge both `0017` migrations or accept untrusted client membership. This is missing integration source, so the status is PARTIAL, **not** IMPLEMENTED_UNVERIFIED.
2. **R17/C08 shared ownership:** wire `/messages`, `/messages/:conversationId`, person profile Message action, actual authenticated tenant/user from session, per-account cache open before first Chats frame, and on all logout/account-switch/disabled-account cases call `sync.deactivate()` + `cache.purgeAccount(...)`. Coordinate old `/chats` AI alias; do not edit shared root router on this branch.
3. **C03/C04/R14:** actual server-authorized realtime/push/cursor semantics, missed edits/deletions and media-on-demand, no stale lock-screen message previews, and delivery/read reconciliation still require their owners. Cache server sequence alone cannot prove every edit/revocation update is observed until C03 defines an event stream. C05 needs server older-history paging beyond locally cached rows and thread-list cursor/delta sync before final acceptance.
4. **Native release integration:** `sqflite_sqlcipher` documents `-keep class net.sqlcipher.** { *; }` for Android code shrinking. `apps/mobile/android/app/build.gradle.kts` is touched by Firebase draft #461 and Android release controls by R16; shared R16/Android owner must resolve ProGuard and shrinker config, lock file, Android/iOS compatibility and actual encryption/read-after-restart test. Do not overwrite shared Gradle ownership.
5. **Performance/operations:** bounded indexed queries exist; opt-in fixture is **not executed**, and warm first-use UI/list/thread p50/p95, network bytes, crash/jank, disk quotas, background sync, cache eviction/media LRU, RTL/large text and low-end physical Android profiling are NOT measured. No A/B mobile, DB/live Gateway, revoked-url, multi-device or push tests executed.

### Tests and handoff for ChatGPT Work (all UNEXECUTED)
Execution environment has **no Flutter/Dart SDK**, cannot `git clone` private repo over its disabled network; GitHub connector source writes and readback are available. Foundation CI/Mobile Build are blocked at shared quota in #457 (no test steps). Do not rerun broken Actions until owner Work fixes allocation. In a real Flutter/Android toolchain:

```bash
git fetch origin
git checkout work/c05-protected-human-chat-cache-20261008
cd apps/mobile
flutter pub get
git diff -- pubspec.lock
dart format --output=none --set-exit-if-changed lib/src/messages/cache test/messages/cache
flutter analyze
flutter test test/messages/cache/human_chat_cache_test.dart
flutter test test/messages/cache/human_chat_sync_test.dart
flutter test test/messages/cache/cached_human_chat_thread_test.dart
flutter test --dart-define=HUMAN_DM_STRESS=true test/messages/cache/human_chat_stress_test.dart
flutter build apk --release
```

Commit the **real generated** `pubspec.lock` after dependency resolution; fix analyzer/test/SQLite errors on this same draft branch, with a fresh coordination lease. The FFI stress runner logs read time but is **not** an APK p95 benchmark. Test actual Android SQLCipher password isolation, wrong key/corrupt DB policy, app kill/restart, airplane mode, 2 devices with distinct accounts, session switch and purge, secure cache deletion, browser/deep link authorization, and C01 blocked/revoked identities; measure p50/p95 with build/device labels. Security review C02/C03 integration, old edits and tombstone delivery before merging.

**Status fields:** SOURCE_WRITTEN=YES (isolated component); LOCAL_TESTED=NO; CI_EXECUTED=NO (#457); DB_INTEGRATED=NO (SQLite FFI tests only authored); APP_INTEGRATED=NO (await C02 and R17/C08); DEPLOYED=NO; DEVICE_VERIFIED=NO; PROVIDER_QUALIFIED=NOT APPLICABLE; MERGED=NO; E2E_VERIFIED=NO.

**Next non-overlap check:** C02 has competing active branches; C01 #468, R17/C08, R14, R16 and shared CI #457 have other owners. Do not take those paths merely because checks are blocked; independent future C05 work may resume on this branch, not a duplicate.

## Collision recheck after draft PR #476 creation (2026-10-08)

A concurrent window published **draft C05 PR #474**, branch `work/c05-protected-dm-cache-20261008`, created at **11:07:21 UTC**, while this independent C05 window was coding; #476 was created at **11:10:32 UTC**. **This invalidates any assumption of uncontested C05 ownership.** Most exact code paths do not intersect (#474: `apps/mobile/lib/src/human_sync/**`; #476: `apps/mobile/lib/src/messages/cache/**`), but both implement the **same cache/outbox/benchmark behavior** and both modify `apps/mobile/pubspec.yaml`. This is substantive functional duplication and requires product/contract consolidation, not blind merging. See PR #474 comment and PR #476 comment on 2026-10-08. Stop independent edits to either C05 owned source until the two owners/ChatGPT Work reconcile a SINGLE storage format, schema/version/key lifecycle, cache entry and sync contract; evaluate usable unique pieces/tests from each. Both PRs are deliberately left draft/unmerged. The C02 competing #472/#475 schema and route naming remains an independent hard blocker.

