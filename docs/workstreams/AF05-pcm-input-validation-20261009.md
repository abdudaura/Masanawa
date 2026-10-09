# AF05 — PCM playback validation and recovery claim (2026-10-09)

- Window: MASANAWA-01 / AF05-PCMRX
- Claim owner: MASANAWA-01
- Claim timestamp UTC: 2026-10-09T21:40:57.914Z
- Lease: five minutes since last concrete repository-visible work; renew with substantive commits/checkpoints, not empty heartbeats.
- Base main SHA: `f381f077c485c04261459b77a42c215d3ce3a14b`
- Branch: `work/af05-pcm-frame-recovery-20261009-masanawa01`
- Exact owned paths (no broad directory locks):
  - `apps/mobile/lib/src/core/live_voice_session.dart`
  - `apps/mobile/lib/src/audio_focus/live_pcm_frame.dart`
  - `apps/mobile/test/audio_first/af05/live_pcm_frame_test.dart`
  - `docs/workstreams/AF05-pcm-input-validation-20261009.md`
- Lane: AF05 audio reliability, recovery of native streamed PCM output validation and actionable output-stage errors. No ownership of manifest, native code, shared router, Gateway composition, migrations, audio recorder used by chats or AF00 files.
- Dependencies: AF00 owns audio screen/manifest wiring. AF05 reads the existing `LiveVoiceSession` and `LivePcmAudio` contracts on main. Related historical branches #534, #456 and #497 are inputs, not proof of merged functionality.
- State at claim: PLANNED. Native handset/other-app audio, provider and APK/device proof NOT_RUN. Owner-local APK/diff unavailable; do not overwrite its work.
- Next concrete action: read claim back, implement a bounded, validated streamed PCM frame contract (sample-rate, payload alignment/limits), propagate stage-specific output failures, add executable unit tests, publish SHA-specific source handoff and open PR for AF00 integration.


## Implementation checkpoint — 2026-10-09

**State: PARTIAL_IMPLEMENTATION** for AF05 as a whole. This PR implements one directly wired PCM receive/output reliability slice; capture, local voice-note preview/upload, shared focus, Bluetooth device and actual handset qualification remain open. No merge, Android binary, provider session, database or production deployment is claimed.

- Pull request: https://github.com/Baatiku/masanawa/pull/591 (draft until source can be executed and dependency-safe integration reviewed)
- Base main: `f381f077c485c04261459b77a42c215d3ce3a14b`
- Latest substantive source/test checkpoint: `5721ac00c251de9c5f5f969b16486ea19277a0ae` (before this document update)
- Changed source: `apps/mobile/lib/src/audio_focus/live_pcm_frame.dart` and `apps/mobile/lib/src/core/live_voice_session.dart`
- Added tests: `apps/mobile/test/audio_first/af05/live_pcm_frame_test.dart`
- No migration, provider, native manifest, secret/config, localization, root composition or deployment file changed.
- AF contract: `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md` AF v1 (audio/media); public `LiveVoiceSession` constructor/streams unchanged.

### Connected behavior

1. Gemini model inline audio is validated as mono PCM16; advertised `audio/pcm;rate=...` is preserved instead of always forcing 24 kHz. Bare `audio/pcm` retains backward-compatible 24 kHz default.
2. Rejects wrong MIME, invalid/out-of-range sampling metadata, malformed Base64, missing/odd-length audio and >256 KiB payload before native playback. Live server events are limited to 1 MiB before JSON parsing.
3. Plays the validated bytes through the existing native method channel and reports actual native start/write/routing errors as the **output** stage rather than a generic invalid-event message. The payload is not copied into the failure message.
4. An AF05 Flutter test suite covers valid PCM rates, format/size failures, input redaction and method-channel forwarding of the actual rate and bytes.
5. No new audio recorder, phonebook permission, alternate voice provider or storage authority was created.

### Evidence, exact commands and limits

- **PASS static source-contract inspection only:** 10/10 read-back assertions against committed GitHub blobs for import wiring, validation-before-playback, advertised sample rate, bounded decode, stage-specific messages, constructor continuity and presence of focused test coverage. This is *not* a Dart test result or runtime proof.
- **BLOCKED Flutter unit/analyze/build:** the available execution container does not have `flutter` or `dart`. Required commands when the qualified Flutter 3/Dart >=3.12.2 checkout is available:
  - `cd apps/mobile && flutter pub get`
  - `flutter analyze lib/src/core/live_voice_session.dart lib/src/audio_focus/live_pcm_frame.dart test/audio_first/af05/live_pcm_frame_test.dart`
  - `flutter test test/audio_first/af05/live_pcm_frame_test.dart test/live_pcm_audio_test.dart test/live_voice_session_test.dart`
  - `flutter build apk --debug` (not a signed release artifact).
- **BLOCKED GitHub Actions:** at source commit `5721ac00c251de9c5f5f969b16486ea19277a0ae`, Foundation CI run `37995128894` and Mobile Build run `37995128866` reported failures with **zero executed job steps**. This supplies no compilation or test verdict; do not mislabel as a code failure or success.
- **BLOCKED provider/device journeys:** UX-A05 audio send/recovery, PF-A04 low-end/permission/interruption (and AF05 playback/route-change) require a handset, test accounts, running Gateway/provider and final APK. No actual voice interaction, Bluetooth switch or microphone recovery was performed.
- **Production merge gate:** GitHub commit status includes an unrelated Vercel build-rate-limit failure. Auto-deploy triggers and local-only owner changes have not been fully reconciled. Do **not** merge this PR into production-triggering main without AF00 evidence.

### AF00 / integrator handoff

- Preserve the source in #591; do not merge blindly into the owner's unavailable local APK. Verify that the live provider actually sends `audio/pcm;rate=...` and revise bounds only with measured evidence.
- Run the focused Flutter tests, analyze, and handset PCM receive/playback using headset/speaker plus interrupt/restart; check audio-focus interop with calls and voice notes. Capture exact SHA/device/provider evidence.
- Review migration/deploy triggers before integration. If main can deploy production automatically, use a **non-deploying integration branch**; after executable code checks, merge compatible tested code there promptly.
- Continue AF05's separately owned local microphone capture/preview, upload/readback and permission/device qualification; #591 does **not** close the full lane or certify a working voice note.
- The five-minute claim expires by inactivity but prior source remains protected against silent replacement. Any transfer must cite this PR and preserve its unique changes.

### Unchanged and unresolved boundaries

AF00 still owns shared router, Android manifest/release, native integrations not allocated here, and integration with the locally fixed APK. AF06 owns the human DM composer/voice-note UI. AF09/AF10/AF11 own playback/rooms/calls consumer surfaces. AF05 requires their explicit composition handoffs; do not import their authority into this parser.
