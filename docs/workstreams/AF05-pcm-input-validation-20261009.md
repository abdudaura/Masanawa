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
