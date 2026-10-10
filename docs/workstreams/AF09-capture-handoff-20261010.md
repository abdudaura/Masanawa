# AF09 Published Audio Talks — connected capture and private media handoff (2026-10-10)

**Existing PR:** [#609](https://github.com/Baatiku/masanawa/pull/609), branch `work/af09-published-audio-20261010-gpt6`; no new branch, helper or alternate integration target. **Main inspected:** `7c443966be97e9092cbc1fb98562c75253434326`. **PR head observed for this handoff:** `6017461d3e38f004792ad7e9aa4b3e8a3770b3b7` (shared branch, refresh before working). **Overall: PARTIAL_IMPLEMENTATION, NOT INTEGRATED, NOT DEPLOYED.**

**Claims:** `af09-609-capture-handoff-gpt6-0551`, `af09-609-capture-composer-bridge-gpt6-0554`, and `af09-609-capture-destination-gpt6-0559` on `factory/claims`; new AF09 files and existing composer only. These do not authorize edits to AF00 root/worker/Gateway/migrations, AF05 native audio, or AF15 private media.

## Newly implemented source

- `apps/mobile/lib/src/audio_posts/audio_post_capture_sheet.dart` (source commits `234ad8c`, `41f3f6c`, `0de3bcd`, `dcb4b71`, `6017461`): actual `record` microphone capture to private temporary .m4a, pause/resume, 3-minute cap, local `just_audio` preview and trim range, delete/re-record, permission denial, and explicit disabled private-upload state. No public URL or invented asset metadata.
- Same capture sheet: private upload callback requires local file, exact immutable trim, and **stable `uploadRequestId`** across outcome-uncertain retries. Trimming is locked once upload was attempted. Only an affirmative `VerifiedPostAudio` receipt returns to composer; failure leaves the temporary recording available for retry within the open sheet. Private temp files are cleaned after confirmed receipt or discard/close. **Not** a durable offline upload queue: sheet closure and app restart require new recording until AF05/15 add resumable private-media authority.
- `apps/mobile/lib/src/audio_posts/audio_post_media_contract.dart` at `99c1ffa`: extracted canonical `VerifiedPostAudio`/capture error types without a circular import.
- `apps/mobile/lib/src/audio_posts/audio_post_composer_screen.dart` at `e51df27`: optional `uploadVerifiedAudio` opens the capture sheet from the existing Record control and passes its returned receipt through the existing durable publish service. The older `acquireVerifiedAudio` contract remains source compatible. No fake success when neither binding exists.
- `apps/mobile/lib/src/audio_posts/audio_post_destination.dart` commit `3cf3b44`: feature-local Published Talks destination forwards optional private uploader into the composer, not just the legacy callback. `apps/mobile/test/audio_first/af09/destination_test.dart` commit `1fa7f74`: sixth newly authored widget regression verifies navigation-to-capture binding without a fabricated publish.
- `apps/mobile/test/audio_first/af09/capture_sheet_test.dart` commits `bb18b0e`, `924961b`: four authored widget tests for denied microphone, preview/disabled upload, uncertain same-ID retry/file cleanup, and account revocation. `apps/mobile/test/audio_first/af09/composer_test.dart` commits `e94a320`, `b5d177e`: one new composer integration case. **Tests authored, NOT RUN.**

## Finite whole-milestone closure checklist

| ID | Required item and exact paths | Owner / source state | Execution / integrated SHA |
| --- | --- | --- | --- |
| AF09-01 | `services/gateway/src/audio_posts/{contract,service,routes}.ts` post/reactions/comments/receipt | AF09, IMPLEMENTED_UNVERIFIED, not registered in live root | Node full suite NOT_RUN; NONE |
| AF09-02 | `adapters/storage/postgres/src/audio_posts/**` canonical feed/follow/comment/play/queue | AF09, IMPLEMENTED_UNVERIFIED, schema-dependent | Disposable PG tenant/race tests NOT_RUN; NONE |
| AF09-03a | `apps/mobile/lib/src/audio_posts/{audio_post_capture_sheet,audio_post_media_contract,audio_post_composer_screen,audio_post_destination}.dart`, three widget test files | AF09, **IMPLEMENTED_UNVERIFIED** recording/trim/composer/destination; source readback checks only | Flutter analyzer/widget tests NOT_RUN; NONE |
| AF09-03b | Real authenticated, private, verified `UploadVerifiedTalkAudio` (file/request ID/trim -> safe persisted asset), resumable/upload states, AF05 audio focus | **AF05 + AF15: MISSING production source/binding**, follow contract without fake IDs | Object/codec/two-account NOT_RUN; NONE |
| AF09-04 | `apps/mobile/lib/src/audio_posts/**` Discover/Following/Saved/My Talk/comments/creator/playback/reports | AF09, IMPLEMENTED_UNVERIFIED, unmounted | Flutter full tests NOT_RUN; NONE |
| AF09-05 | `services/gateway/src/{app,main}.ts` authenticated registration, AF08 actor + AF15 media/visibility/report services | **AF00/AF08/AF15: MISSING composition** | Gateway authenticated E2E NOT_RUN; NONE |
| AF09-06 | Allocated append-only social/queue/comments/follows/listen `database/migrations/**` | **AF00: MISSING migration installation** | Disposable migration/rollback NOT_RUN; NONE |
| AF09-07 | AF15 private authorized media read/ticket/revocation + one focused player, AF05 output/focus | AF05/AF15, PARTIAL source, live integration MISSING | Media device tests NOT_RUN; NONE |
| AF09-08 | `services/gateway/src/audio_posts/{processing_worker,processing_scheduler}.ts`, `services/worker/src/main.ts` startup/cursor | AF09 isolated worker SOURCE_CHECKED, **AF00 scheduler registration/restart MISSING** | Focused Node22 mocked worker 5/5 PASS_SIMULATED in prior checkpoint; real worker/PG NOT_RUN; NONE |
| AF09-09 | Canonical moderation approval/report, private publish-once worker | AF09/AF15/AF00, PARTIAL isolated, actual trusted provider binding MISSING | Real two-account/moderator NOT_RUN; NONE |
| AF09-10 | `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` Talks-centre `PublishedTalksDestination` with injected verified uploader/transport | **AF00: MISSING shared shell composition**, owns #600 | Flutter route/device NOT_RUN; NONE |
| AF09-11 | Record→trim→private upload→publish→process→feed→play/comment/follow/report/remove | AF05/09/13/00, **MISSING connected E2E journey** | Two-account/device/provider NOT_RUN; NONE |
| AF09-12 | ONE reviewed nondeploying integration target after deployment trigger audit and local APK source reconciliation | **AF00: NOT INTEGRATED, unified SHA NONE** | Do not assume branch name gates deployment |
| AF09-13 | Full workspace checks + private object/DB/restart/restore + Android qualification | **AF13 and qualified AF00/AF05: tests pending** | NOT_RUN/BLOCKED on this runner, commands below |

This checklist is **source completion first**: unavailable runners do not reclassify AF09-03b, -05, -06, -07, -08 registration, -09 or -10 as local-only. All missing source/composition must be implemented and integrated remotely before any local pull request. Owner's unseen APK/local work is not reconciled.

## Actual evidence / commands

- GitHub exact blob readbacks on the committed feature and tests: **19/19 initial source-structure checks PASS** before destination wiring; separately verify the destination change below. These are not Flutter compilation. (field/import/guard and authored test presence only, not compilation).
- Environment: Node `v22.16.0` vs required Node 24; `git` available; `pnpm`, `dart`, `flutter`, `psql` absent, no authenticated repo checkout and earlier `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed DNS `Could not resolve host github.com`. **No Dart, Flutter, real device, PostgreSQL, private object or full workspace test executed in this capture window.**
- **AF13/qualified AF09 or AF00 runner at exact source HEAD**:
  ```sh
  cd apps/mobile
  flutter pub get
  flutter analyze lib/src/audio_posts/audio_post_capture_sheet.dart lib/src/audio_posts/audio_post_media_contract.dart lib/src/audio_posts/audio_post_composer_screen.dart lib/src/audio_posts/audio_post_destination.dart test/audio_first/af09/capture_sheet_test.dart test/audio_first/af09/composer_test.dart test/audio_first/af09/destination_test.dart
  flutter test test/audio_first/af09/capture_sheet_test.dart test/audio_first/af09/composer_test.dart test/audio_first/af09/destination_test.dart
  flutter test test/audio_first/af09
  cd ../..
  pnpm install --frozen-lockfile
  pnpm -r typecheck
  pnpm --filter @masanawa/gateway-service test
  ```
  On an approved PostgreSQL/private-object test environment, apply allocated migrations, then verify upload idempotency on timeout, trim/codec bounds, actor/account-switch denial, delete/retention, restart and two real devices; repair discovered failures before safe merge or release.
- **Next implementer:** AF05 + AF15 deliver one canonical, authenticated private upload/verification adapter that can consume `UploadVerifiedTalkAudio` and return only owned-ready references; no bypass for absent signing credentials. AF00 executes bounded root/Gateway/migration/worker registration under its exact claimed paths and imports this composer binding after source review. AF13 tests qualified integrated SHA. AF09 continues its same PR after claims release; do not mark the parent milestone complete.
