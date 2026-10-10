# AF05 — bounded PCM platform bridge (2026-10-10)

- Window: MASANAWA-01 / AF05. Status: **IMPLEMENTED_UNVERIFIED** for isolated bridge, **PARTIAL_IMPLEMENTATION** for full AF05.
- Main base: `f381f077c485c04261459b77a42c215d3ce3a14b`.
- Branch: `work/af05-pcm-native-bridge-guard-20261010-masanawa01`.
- Ownership claim: `masanawa01-af05-pcm-bridge-guard-20261010` on `factory/claims`, published in `cf7bd3df865112cfcccbe1a76c11a38bb04d6c48`; readback blob SHA `78645a9c456e37782e5c7d9e6815ace67856c775` before edits.
- Exact owned source: `apps/mobile/lib/src/core/live_pcm_audio.dart`.
- Exact owned tests: `apps/mobile/test/audio_first/af05/live_pcm_audio_bridge_test.dart`.
- This handoff file is the only additional owned path.
- Source checkpoint: `24c35bd88d01fff2b6e573198bd7ccb5a7d3ba22`; test checkpoint: `eeab1bc0a6d18104dc4d0699e26723115b57ff38`.
- Acceptance: AF05 audio failure-stage recovery; native PCM chunk alignment and upper bounds, sample rate admission, no-op silence, missing-plugin fallback.
- Behavior: Reject rates outside 8,000–48,000 Hz and PCM16 chunks with odd byte length or length over 256 KiB without entering Android platform channel. Preserve valid native start/write and empty-chunk no-op.
- Existing #591 PCM receive validation and #589 live failure stage work remain untouched. These guards are intentionally defense in depth, not a replacement for provider payload validation.
- Negative regression source: unsupported rate, misaligned frame, oversized frame, plugin absence. Positive regression source: valid 16 kHz/24 kHz start and aligned frame write.
- Execution: Flutter/Dart SDK unavailable in this environment (`command -v flutter` and `command -v dart` returned no paths); authored widget-unit tests are **NOT_RUN**. Source readback and exact claim readback performed. No Android device, Gemini provider, playback, APK, backend, database or production test executed. No native host project or manifest was changed.
- Integrator commands: `cd apps/mobile && flutter pub get && flutter test test/audio_first/af05/live_pcm_audio_bridge_test.dart && flutter analyze`; run existing AF05 PCM tests from #591 after reconciling.
- Production release blocked until AF00 reconciles owner's local fixed source/APK, confirms actual native accepted rates and PCM chunk constraints with physical device, composes #591 safely, runs required build and rollback tests, and confirms no implicit main deployment. Merge into non-deploying integration branch after executable Dart tests and overlap review. No migration, secrets or paid provider execution.
- Source branch and PR final head should be read directly from GitHub; the source/test commits above are immutable checkpoints, not an assertion of merged or deployed code.
