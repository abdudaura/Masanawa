# F17 / C04 — private playback cleanup recovery (2026-10-09)

**Status: PARTIAL_IMPLEMENTATION overall; DRAFT / UNMERGED / NOT DEPLOYED.**
Continue [existing C04 draft PR #478](https://github.com/Baatiku/masanawa/pull/478) on `work/c04-private-voice-notes-20261008`, never a new C04 implementation. PR baseline before recovery: `9f220758e15d28dc71ea53de9f68de7f7648c07f`. Refreshed PR base `main@5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762` (live at review). Code and authored-test checkpoint: **`a2364a52e6a8791a72fa733462b25d6285261913`**. Handoff-document commit and final PR head are recorded in PR conversation, not fabricated as this document's own commit SHA.

## Exact-path ownership and preserved work

Five-minute repository-visible lease: [PR #478 claim comment](https://github.com/Baatiku/masanawa/pull/478#issuecomment-6072684002), registered before edits. The earlier F17 handoff and edits were >5 minutes old; search revealed no separate F17 issue or branch. Commits on this same existing PR renew this narrow lease. Exclusive changed paths:

- `apps/mobile/lib/src/human_media/human_voice_controller.dart`
- `apps/mobile/test/human_media_playback_stop_test.dart`
- `docs/workstreams/f17-playback-temp-file-recovery-20261009.md` (new)

Do **not** touch existing C04 SQL/authorization/service/storage, C01/C02 integration, Gateway `app.ts`/`main.ts`, Flutter root/router, Firebase, real finance, CI workflows, release credentials or production. Preserve prior F17 backend testing/results (independently documented in `f17-private-media-backend-20261009.md`) without re-labeling them as fresh validation.

## Source implemented

1. **Late allocated playback path is erased on Stop/logout:** after asynchronous `_privatePath()` returns, compare the playback generation and `closed`. If the player has been stopped or account session ended, erase the returned path before returning; previously early return could leave a path-factory-created private audio file behind. The guard is intentionally in the human-DM-only controller, not LiveKit or Gwani/Gwana audio.
2. **Deletion interrupts playback:** deleting the signed-in sender's own voice note stops and erases its local downloaded private audio *before* the server DELETE. It does not alter sender permissions or claim server deletion succeeded. If server DELETE fails, the existing recoverable error path still reports failure.
3. **Three extra Flutter regression tests authored:** deliberate path-factory deferral then Stop; deferred path after `shutdown()`/signout (tests erasure even after player disposal); deleting own currently-playing note erases downloaded temp and prevents stale player completion from reactivating playback. Existing long playback Stop, late network response, preview and widget controls remain unchanged.

The original C04 auth/tenant/membership checks, opaque request id, upload storage/SQL, private S3 controls and five-tab architecture are unchanged. No fake server receipts or financial features introduced.

## Verification and precise limitations

**GitHub write/readback performed:** controller blob `ae99211a463fae1eefdbaf0ce0854bee2018a11e`, playback test blob `4ec4e785d37a322fbc9e5840ee5f11fe21617ecc` at code checkpoint; both changes present. Static text inspection confirms new generation guard, deletion cleanup, all three test cases and no global tab/router edit. This is **source readback, NOT executed Flutter tests or real device proof**.

**Executable checks NOT RUN:** environment has Node but neither `flutter` nor `dart` installed; private Git repository cannot be cloned from local container due DNS `Could not resolve host: github.com`. GitHub connector supports repository edits/readback, not Flutter/Dart test execution. Do not claim the 3 new tests pass; CI issue #457 remains a separate Actions quota/runner incident and was not retried.

Commands for an integrated checked-out worktree with Flutter SDK and build deps:

```sh
cd apps/mobile
flutter pub get
flutter analyze lib/src/human_media/human_voice_controller.dart test/human_media_playback_stop_test.dart
flutter test test/human_media_playback_stop_test.dart
flutter test test/human_media_recorder_lifecycle_test.dart test/human_media_controls_test.dart test/human_media_models_test.dart
flutter build apk --debug
```

Still unverified: two-account Android mic, file erasure on physical Android after logout/delete/kill, real Opus decoder/LiveKit focus, C01/C02/C03/C05 composed human Chats thread, durable encrypted pending media outbox, 0016→0017→0018 disposable PostgreSQL migration and concurrent reads, private S3 ACL/SSE/provider erasure, production Gateway composition, CI #457, network timeouts, replay/paid-client cross-feature tests. Do not deploy, merge or call C04/F17 complete.

## Exact integrator handoff

- F12/C02 owner mounts existing `HumanVoiceNotesPanel` under the human-only Chats thread (not public Talks/Assistant); retain exact five tabs **Talks · Chats · Assistant · Wallet · Agents**.
- C03/C05 owns restart-safe per-account encrypted media outbox. F08/R12 + S3 ops own account-deletion object erasure evidence.
- CI/device integrator runs commands above, particularly Stop/logout after native temp-path acquisition and DELETE while audio is playing; report actual results, investigate failures and keep this PR draft until all feature gates are met.
