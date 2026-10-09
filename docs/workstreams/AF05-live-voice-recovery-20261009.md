# AF05 — Live voice stage-specific recovery (2026-10-09)

**Window:** MASANAWA-01 / AF05. **State:** PARTIAL_IMPLEMENTATION, source committed; runtime/device/provider NOT_RUN. **Base:** `main@f381f077c485c04261459b77a42c215d3ce3a14b`. **Source checkpoint:** `c5d31297d8293a484baec68972754e565ce09847`. **Latest targeted test source:** `e3a6b8b6bf381eabc2d57b4b857ec0235c17301e`. Branch: `work/af05-live-voice-recovery-20261009-masanawa01`.

## Ownership and dependency

Claim acquired with GitHub blob-SHA CAS on `factory/claims` and independently read back at claim branch commit `79b808c1ea736d264413eaaa638438f21df28a0b` before any source edits. Claim ID: `masanawa-01-af05-live-voice-recovery-20261009`. Exact paths:
- `apps/mobile/lib/src/core/live_voice_session.dart`
- `apps/mobile/test/audio_first/af05/live_voice_stage_recovery_test.dart`
- `docs/workstreams/AF05-live-voice-recovery-20261009.md`

Canonical input: AF v1 media contract, current owner screen and audio-first specs, AF05 lane prompt, and main implementation. Existing #497 C04 media and native path, #534 U09 operator voice, #456 R02 live Talk audio are **not replaced**. AF00 owns shared shell and platform composition. Owner-reported unpushed local app/APK remains unavailable: AF00 must reconcile before shipping.

## Connected source changes

1. Existing `LiveVoiceSession` now publishes a typed `failures` stream with stages permission, focus, signaling, capture, playback, transport and interruption, while retaining the prior human-readable `errors` stream as compatibility.
2. Permission check errors differ from denial and from network failure; Android/iOS audio session configuration/activation and concurrent-call focus failure now surface as focus.
3. PCM capture plugin failure, microphone-stream errors, audio routing/player failure, WebSocket/setup timeout/closure and incoming invalid events have distinct recovery messages/stages. Unexpected socket close also reports a failure rather than silently ending.
4. Cancellation/close path closes the new typed stream alongside the existing streams. Start remains single-flight; no new provider, auth bypass, new recorder, storage or channel authority has been introduced.

## Executable checks added and status

`apps/mobile/test/audio_first/af05/live_voice_stage_recovery_test.dart` contains three Flutter/mocktail cases: denied permission → typed+legacy error and ready failure, permission-probe plugin failure ≠ network failure, and concurrent pending start → single recorder permission lookup and cleanup.

Requested commands from `apps/mobile` after exact SHA checkout:
```bash
dart format --output=none --set-exit-if-changed lib/src/core/live_voice_session.dart test/audio_first/af05/live_voice_stage_recovery_test.dart
flutter analyze lib/src/core/live_voice_session.dart test/audio_first/af05/live_voice_stage_recovery_test.dart
flutter test test/live_voice_session_test.dart test/audio_first/af05/live_voice_stage_recovery_test.dart
flutter test test/live_pcm_audio_test.dart
```
**NOT_RUN**: current execution container has no `dart` or `flutter` executable. This is not a reported pass. Read back source and test exact blobs on GitHub; manually checked compatibility and branch file paths, not compiler correctness.

## Acceptance and handoff

- Covers an isolated failure-diagnostic and retry-guidance portion of UX-A05 / AF05 audio reliability; **does not** qualify actual voice recording, transport, playback, device interruptions, Bluetooth, background/foreground use, or subsequent recording after a call.
- No migration, native manifest, provider credential, deployment configuration, audio-model or UI composition change.
- AF00/AF05 next: run formatter/analyzer/Flutter tests on an environment with SDK, exercise actual microphone/capture/playback failures on representative physical devices, use the new typed stream for an explicit retry/settings-facing UI, and integrate #497 C04 independent record/preview/upload/readback without losing unique changes.
- **Merge gate:** hold while executable Dart tests are unavailable and AF00 contract baseline/composition is in flight; run tests on the exact head SHA, audit auto-deploy and merge to safe non-deploying target if approved. **Release gate:** independent handset/provider/restore evidence required; production not authorized.
- No live service, money, user data, job or production environment was touched.

## Branch verification addendum

PR #589 created against exact main base `f381f077c485c04261459b77a42c215d3ce3a14b`; GitHub reports `mergeable=true` and three claimed changed paths after diff inspection. GitHub combined status currently includes a failing Vercel build-rate-limit status, which is infrastructure evidence, **not** a successful source check and is a main-merge/deployment hazard. Latest source/tests remain UNVERIFIED without Dart/Flutter execution. No main merge performed.
