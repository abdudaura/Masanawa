# R02 mobile live-audio session recovery

Owner/window: ChatGPT R02 audio recovery window, 2026-10-08
Branch: `work/r02-live-audio-session-recovery-20261008`
Base main SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
Task: R02 — bounded mobile LiveKit session failure/retry and cleanup resilience; **not** provider qualification or shared Gateway configuration.
Owned paths: `apps/mobile/lib/src/talks/talk_live_audio_session.dart`, `apps/mobile/test/talk_live_audio_session_test.dart`, `docs/workstreams/talk-live-audio-session-r02-20261008.md`.
Shared dependencies: existing `TalkLiveTransport`, `TalkLiveRoom`; do not change Gateway, Android config, theme, localization, financial paths or canonical docs.
Current step: recovery implementation and expanded focused regression tests committed; review pending.
Status: IMPLEMENTED on branch (commits `bfe6295`, `f72566b`, `7450f33`, `ede9724`, `99949b2`). Failed media connection releases server session (best effort), closes room, clears stale local ID/role/capability and allows explicit retry; regression test asserts retry and one disconnect per attempt. Dart/Flutter test execution not available in this GitHub-connector session: test NOT RUN. Deployment and real handset acceptance NOT verified. The user-reported audio outage may additionally involve credentials, Gateway/provider, Android permission or other causes; this fixes one independently evidenced failure-recovery defect, not the overall R02 gate.
Next: run `cd apps/mobile && flutter test test/talk_live_audio_session_test.dart`, then diagnose real device/provider logs; reconcile if necessary before merging.
Last repository-visible activity: 2026-10-08T00:53:00Z (last branch work during this window; commit `f72566b`).

## Continuation evidence

- Failed LiveKit connection and failed media-token issuance now both reset local state; successful retry clears prior `errorMessage`.
- Server-reported ended/ineligible session releases its session lease without opening media.
- Tests added for room connect failure/retry, media-token failure/retry and ended-session cleanup. Tests are committed but have **not run**; no Dart/Flutter runtime or handset tested in this connector session.
- PR #408 is draft and not merged; no production change. Authentication/provider audio unavailability requires independent evidence and configuration qualification.
- Last update: 2026-10-08 00:55 UTC (repository commit recorded above).

## Further lifecycle race coverage

- `0ca9a0a`: if close completes before delayed authenticated `transport.connect`, the late session is explicitly disconnected rather than leaked.
- A late `room.connect` after close triggers another best-effort room cleanup so a microphone cannot remain open due to teardown ordering.
- `32c61a9`: added asynchronous shutdown-before-connect regression test. This test is **not run** in the connector environment; runtime/device qualification remains open.
- R02 still requires authenticated LiveKit/Gateway failure diagnosis and production-device evidence. Keep this PR draft pending CI, review and integration.

## Expanded readiness hardening

- Race-free deterministic test synchronization on entering the pending LiveKit room connection; closing during connection must not leave a room or issue a second server disconnect.
- Reject malformed non-WebSocket URLs, missing participant tokens and already expired media credentials before attempting LiveKit/media publication. On these failures the ordinary cleanup and retry path applies.
- Added token expiry and endpoint rejection regression cases. These tests are source-level only; no Flutter/Dart executable is available in this connector window.
- Inspected latest PR Actions: Mobile Build and Foundation CI are marked failed while job metadata exposes zero steps, and GitHub job log fetch returned 404 BlobNotFound. Do **not** misreport these runs as passing or as a demonstrated Dart/test failure.
- Latest implementation commits: `41d4ce7`, `3f5b970`, `af6b431`, `d6192f8`. No deploy/device verification. Future R02 work requires an executable Flutter job, Gateway/LiveKit readiness probe and authenticated Android audio diagnostics.
