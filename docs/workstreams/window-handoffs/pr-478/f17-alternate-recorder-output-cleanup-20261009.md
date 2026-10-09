# F17/C04 — erase alternate native voice recorder outputs on cancellation and account change

**2026-10-09 · Scoped security/privacy recovery on EXISTING draft [PR #478](https://github.com/Baatiku/masanawa/pull/478).**
**Overall status: PARTIAL_IMPLEMENTATION; DRAFT / UNMERGED / NOT DEPLOYED.**
This is one completed source/test slice inside C04/F17, *not* a claim that human voice messaging is integrated end to end.

## Claim, SHA-specific source handoff and exact ownership

- Owner: GPT-6 F17 recovery. Five-minute CAS claim `gpt6-f17-alternate-recorder-erasure-20261009` registered on the dedicated `factory/claims` branch at **2026-10-09T04:48:10Z**, refreshed at **04:49:04Z**; release once this handoff and the PR update are visible.
- Latest inspected `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`. Existing draft continuation branch: `work/c04-private-voice-notes-20261008`; immediately preceding PR head `e6ad972b3e85bcd5c9b9dceaaa40bbcc76f63b18`. Preserve its full C04 SQL, S3, Gateway, mobile and previous F17 changes; no rebase/merge/branch deletion.
- **Controller source commit:** `da92b22d5654890e0ce38ed043091702fb0f7d87`, verified Git blob `594dec05e132a03cd1e2e6677a2695bde8143e86`.
- **Test source commit:** `a3896789d64bb1b2a81300dea8e389a26de83e98`, verified Git blob `aef581bd08dec5e0cdd27e0ffe26752cd46bedab`. The final branch HEAD is the commit carrying this handoff; see PR #478 head SHA for the immutable endpoint.
- Exactly owned source/test paths:
  - `apps/mobile/lib/src/human_media/human_voice_controller.dart`
  - `apps/mobile/test/human_media_recorder_lifecycle_test.dart`
  - `docs/workstreams/f17-alternate-recorder-output-cleanup-20261009.md`
- C04, F17, M03/M04/M10 and journeys J04/J11 are relevant. Existing `docs/contracts/HUMAN-DM-MEDIA-C04.md` remains unchanged.

## Security failure and source recovery

The `HumanVoiceCapture.stop()` contract returns an optional completed native output path. In normal `stop()`, an alternate path is adopted for preview. But the `discard()` and `shutdown()` cancellation branches previously awaited `_capture.stop()` **without inspecting its result**, then deleted only the original `_localFile`. A platform encoder that finalized a different file could leave confidential recorded audio on the device after the user discarded it or switched account.

A private `_stopCaptureAndEraseAlternateOutput()` helper now stops the native capture with the original best-effort exception isolation and deletes a returned output path if different from the controller's known original. Both discard and account shutdown use it. The original path is still erased through `_dropFile()`. Existing start/stop/discard joins, 90-second limit, permission-denied text fallback, account fencing, playback cleanup, transport, financial, Firebase and LiveKit separation remain unchanged. This does **not** solve native implementations that write extra *unreported* files or errors from a file system that cannot delete a file.

Three deterministic fake-native Flutter regressions were authored: discard erases both paths, direct shutdown erases both before recorder disposal, and shutdown racing a blocked discard neither double-stops the mic nor leaves the alternate audio file.

## Verification evidence, limits and remaining responsibilities

- **PASS (readback and static source assertions ONLY):** GitHub returned exact updated controller/test blobs above; six source-structure checks asserted helper use in both cleanup paths, account-operation fencing, all three test names, fake-native alternate output model and **11 total** controller tests. This is NOT an executed Dart test result.
- **NOT RUN (toolchain):** `dart`, `flutter`, project checkout and Android SDK/device qualification unavailable in this execution container; the private GitHub repository cannot be cloned over DNS here. No Flutter analyzer/widget/Android APK execution. Actions issue #457 has a documented account quota/zero-step blocker; do not infer success/failure from its empty workflow runs.
- **NOT RUN (cross-feature):** No migrated disposable PostgreSQL, S3 private-bucket ACL/encryption, actual Native Opus/Ogg recorder output paths, two-user Chats delivery, revoked-contact readback, background restart, or app signing/install performed. Previous F17 backend 41-test evidence belongs to a **different SHA** and was not rerun.
- **External integration blockers:** C01 #468 consent/membership, canonical C02 #472 vs #475 and migration sequence 0016→0017→0018; C03/C05 reliable push/offline media, F12 #493/Work #497 five-tab human-only route composition, R12 account erasure, Firebase #461 and shared Actions #457. This PR never modifies shared Gateway composition, migrations, auth, ledger, root tabs, native manifests or production.

### Exact integrator commands and proof

```sh
git fetch origin
git checkout work/c04-private-voice-notes-20261008
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/human_media_recorder_lifecycle_test.dart test/human_media_playback_stop_test.dart test/human_media_transport_bounds_test.dart test/human_media_models_test.dart test/human_media_controls_test.dart
flutter build apk --debug
```

Test with a real Android microphone driver that reports a different output path; verify cancellation and sign-out physically remove both temporary files, test denied permission and restart, and test two authorized accounts after the Gateway C01/C02/C04 integration. Run the original C04 Vitest/Gateway strict typecheck, real disposable Postgres, S3 and API privacy-negative cases from the contract before merging. Preserve the five tabs **Talks · Chats · Assistant · Wallet · Agents**, voice/tap/text parity, financial safeguards and Firebase. No production work or release authorization is implied.

**Handoff decision: leave PR #478 open, draft and unmerged.**
