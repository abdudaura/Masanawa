# C05 — protected indexed human DM history and durable outbox
## Owner checkpoint — 2026-10-08

**Branch:** `work/c05-protected-dm-cache-20261008`
**Draft PR:** #474
**Base main:** `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`
**Requirement trace:** M02, M05, M06, M07, N09, Q04, Q05, Q08, J03/J10/J11.

### Implemented source in owned C05 paths

- Real local SQLite indexed messages (tenant/account/conversation, descending server sequence), recent inbox, bounded rows and keyset pages.
- AES-256-GCM ciphertext with row-bound AAD; no plaintext preview, person display names, body or queued message in SQLite. 32-byte random key stored in OS secure storage separately from account-specific database; fail closed if key disappears while database exists.
- Server edit/delete tombstones overwrite stale cached bodies; verified per-thread access revocation purges cached messages, inbox preview and outstanding drafts.
- Durable exact client request ID across restarts. Explicit queued/uncertain/rejected status; only matching server C02 response with correct sender/conversation/request ID clears draft. Same ID with different text rejected.
- Isolated HTTPS Dio transport with fixed bearer token per signed-in session, never the shared refresh interceptor; cancels pending HTTP on coordinator close. Gateway remains sole authentication/membership/consent and delivery authority.
- Flutter `CachedDmThreadController` and embedded outbox/status widget, designed for C02's existing human-only widgets, not a duplicate AI chat or shell.
- Auth owner fence before/after awaits; no background auto-send or speculative approval; test code uses real SQLite ffi + real AES.

### Source/test status and limitations (do not inflate)

**PARTIAL_IMPLEMENTATION / UNVERIFIED / DRAFT, NOT DONE.** Source committed but actual C02 screen cannot consume this code until semantic reconciliation with **draft PR #472**; C01 #468 consent/migration and C08 final routes are also unmerged. C03 realtime, push, cursor catch-up, background scheduling and network reconciliation remain other owners' deliverables. Shared session logout/account switch must call coordinator close then `ProtectedDmCache.wipeAccount` (after stopping network requests) and need actual lifecycle/e2e regression. Unknown current tenant claim must come from canonical server identity, never guessed from cached contact. Missing secure-storage key intentionally fails closed until user safely clears cache. Offline old content cannot know a server-side block until reconnection; never assume local cache grants read/send authority.

### Auth/recovery / current risks

- Cache encryption provides confidentiality of message payload at rest, **not** end-to-end encryption. SQLite row-counts, timestamps and opaque key hashes remain observable. OS backup/reinstall/Android keystore, multi-isolate concurrent open/wipe races and device key loss require adversarial review.
- C02 API can acknowledge only if the exact owner, conversation and client request match; offline retry retains the server idempotency token, but C02's current request dedupe must be verified against genuine concurrent Postgres transactions.
- If the signed-in account changes while the C02 HTTP request is in flight, cancellation cannot guarantee that the server never received the already-issued authorized request; no local delivered state is inferred. Force new pinned transport after credential rotation.
- The current `CachedDmThreadController.older` paging path requires integration review for long multi-page UI scroll and bounded-memory policy.
- C05 new direct dependencies in `apps/mobile/pubspec.yaml` are `sqflite`, `cryptography`, `crypto`, `path` and `sqflite_common_ffi` for tests. Resolve lockfile/package versions in executable Work environment and audit Flutter/Dart SDK compatibility.

### Executed vs blocked evidence

- **GitHub commit/create/branch:** executed through connected GitHub integration; code and draft PR persisted on remote.
- **Container clone:** attempted **once**; DNS `Could not resolve host: github.com`. No repeated retries.
- **Dart/Flutter tools:** `dart` and `flutter` not installed here. Neither Dart analyzer, Flutter tests, Gradle/APK nor real phone/database tests ran.
- **GitHub Actions:** issue #457 documents pre-job-step runner allocation/account budget problem; do not retry CI in each window. Work owner coordinates quota and restored executable CI.

### ChatGPT Work handoff — commands after resolving #457

1. Fetch current main and PR #474 as well as #468, #472, #435. Inspect actual diff and unique-path ownership. Reconcile C05 `pubspec.yaml` and C02 member/auth transport without overwriting either.
2. From proper Flutter SDK: `cd apps/mobile && flutter pub get && dart format lib/src/human_sync test/human_sync && flutter analyze && flutter test test/human_sync/protected_dm_cache_test.dart`. Fix compile/lints/tests before any merge. Run `flutter test --dart-define=C05_BENCHMARK=true test/human_sync/cache_benchmark_test.dart` on dev host; results are profiling only.
3. Wire C02 real inbox/thread to C05 `CachedDmThreadController` and `HumanDmOfflineStateView` under the **R17/C08 integration owner's claim**, after C01/C02 routes and real auth have been deployed. Persist queue **before** network send; restore after process kill; clear on logout, switch, server revocation and deletion; handle live session token rotation.
4. In disposable local Postgres with migrations 0015→0016→0017 and real C02 Gateway, test authenticated A/B send, 401/403, block mid-send, reconnect, duplicated request ID, server edit/delete and 3rd user denial; verify local cache is never used for auth. Do NOT use live payment or actual production DB for these tests.
5. Device: verify on named low-cost Android; cached list target warm p95 less than 1 sec and thread less than 500ms, 1k threads / 100k messages, airplane mode, app kill, A→B switch, expired token, OS keystore loss, 320dp accessibility, bytes/frame time, no key/token leaked in backup. Measure actual p95 rather than claiming host script proves performance.
6. Coordinate C03 event/catch-up/push and C04 media before declaring all C05 journeys complete, then run J03/J10/J11 with two real signed-in Android clients and deployed matching Gateway SHA. Only then consider merge and mark verified.

**No production deployments, source merges or DONE status occurred in this window.**

### Parallel-window conflict discovered after this claim (2026-10-08)

**Do not combine or merge both C05 implementations automatically.** This lane claimed and committed its exact paths first, then another independent C05 draft **#476** was opened at 11:10:32Z while #474 was active. The separate source trees do not overlap (ours `src/human_sync/**`, theirs `src/messages/cache/**`), **but both change `apps/mobile/pubspec.yaml` and provide competing caches/outboxes**. #476 uses SQLCipher; #474 uses encrypted AES-GCM rows over SQLite. Neither has executed Android/SQLCipher or Flutter tests. Compare Android keystore, actual ciphertext metadata exposure, token switch, pagination, app data backup, SQLCipher ABI/NDK and plugin compatibility, performance and page/ack semantics. The final implementation must select/reconcile **one** authoritative C05 cache with no duplicate outbox or divergent delivery truth. No forced merge or redundant package dependencies.

**C02 contract collision is real:** #472 (earlier claim) uses `GET /messages`, `clientRequestId`, migration `0017_human_dm_core.sql`; #475 instead implements `/v1/messages` with incompatible `0017_human_dm_text.sql`; #477 has marked itself superseded and must not be merged. Current #474 `PinnedHumanDmGatewayTransport` follows #472 and is **not safe to enable** until integration chooses the canonical C02 protocol. Notify R17/C08 and C03 owners; all migrations stay unapplied until sole C02 choice is reviewed.

**Latest substantive source SHA:** `de4aa6997b08f8aa9de0dd69f8dcf513e256d7de` (after tenant-principal fence, cache key serialization, in-memory revocation purge, standalone inbox/thread state, transport, real SQLite tests and opt-in 100k fixture). This is only a GitHub commit, not a successful test run. Branch remains DRAFT, unmerged; no money, production DB or deployment touched. ChatGPT Work should perform the semantic reconciliation after fixing #457, not simply favor the latest PR timestamp.
