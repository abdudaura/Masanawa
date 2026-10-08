# R02 — Mobile LiveKit microphone failure and late-token safety

Owner/window: ChatGPT independent R02 mobile lifecycle lane; branch `work/r02-mobile-audio-late-token-cleanup-20261008`, PR #456 draft. Canonical base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`; latest repository-visible work 2026-10-08T06:20:40.288Z.

Owned paths: `apps/mobile/lib/src/talks/talk_live_audio_session.dart`, `apps/mobile/test/talk_live_audio_session_test.dart`, this handoff. Other R02 backend PR #439 and R02/19 AI worker/dispatcher paths untouched; no LiveKit secrets, shared app/router, Gemini voice or device deployment affected.

## Recovery changes

- **Fail-closed microphone controls:** when the local LiveKit microphone enable/disable throws, revoke `_canPublishAudio` and the local user role, cancel heartbeat, mark muted, close media room, and best-effort disconnect the server session. Show an actionable Rejoin error and permit explicit new admission rather than continuing to trust an unsafely publishing microphone.
- **Heartbeat reconnect safety:** a server reconnect instruction that cannot physically disable microphone now takes the same media/session revocation path, instead of displaying a misleading reconnecting state while a track may still publish.
- **Stale heartbeat fencing:** once disconnect/revoke clears `_sessionId`, an older HTTP heartbeat response or failure cannot restore publishing privileges, update status or reopen a microphone; async microphone update also rechecks identity.
- **Close/media-token race:** reviewed the preexisting close implementation. It already disconnects the captured session before returning from a late media-token request, so **no new cleanup logic was needed** at that boundary. Added explicit regression coverage to prevent future regressions rather than falsely claiming an existing leak was fixed.
- No automatic microphone rejoin. New admission and permission are explicitly requested on user retry.

## Commits and evidence

- `a4b20209c4d09d8c3346c53604274696a289f89f`: revocation helper, stale heartbeat fence, fail-safe reconnect/mute handling.
- `2780ee1a0369fa1a5a210a3a738a75922ea53bb0`: fake LiveKit heartbeat/token gates and four lifecycle regression tests.
- `363a3991238fc69b39c9b5e630cd6c1e2d41062f`: verify hardware attempted mute, never pretend the failing fake returned success.
- Existing Flutter tests preserved; total **18 test cases authored in file**, not executed in this environment.
- Latest branch-head GitHub Actions workflow metadata was not available when inspected; prior repo runs consistently failed with zero job steps. **No analyzer/test/build/device acceptance is claimed.** Do not merge this draft without real Flutter tests.
- No two-phone Host/Speaker listening/muting/audio audible result, Android permission matrix, provider credentials, headset/route testing, or real network fault injection.

## Handoff and remaining R02

Run `cd apps/mobile && flutter analyze && flutter test test/talk_live_audio_session_test.dart`, full suite and Android APK build on equipped checkout. Exercise back-navigation while LiveKit token is delayed, microphone hardware denial during mute, failed server heartbeat, concurrent close, recovery/rejoin and listener never-publish on two devices. Real LiveKit credentials/production readiness and Gemini AI-seat audio must be tested separately. Session revocation falls back to server lease expiry when disconnect is unavailable.

**State:** CODE IMPLEMENTED / REGRESSION TESTS AUTHORED / NO EXECUTED FLUTTER OR DEVICE TEST / NOT MERGED OR DEPLOYED. Lease released.
