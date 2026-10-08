# R02 — Host/Listener mobile audio late-token teardown and mic failure recovery

Owner: ChatGPT independent R02 mobile media lifecycle lane; branch `work/r02-mobile-audio-late-token-cleanup-20261008`, base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`. Last update 2026-10-08T06:19:01.569Z.
Owned paths: `apps/mobile/lib/src/talks/talk_live_audio_session.dart`, `apps/mobile/test/talk_live_audio_session_test.dart`, this workstream note.
No current open PR owns these mobile audio files. Preserve R02 backend lease work in #439 and existing R02 mobile recovery, do not modify shared app/router, LiveKit secrets/worker or other windows' code.
Observed: close during pending mediaToken returns without any post-close cleanup; microphone-control exception can leave stale publish authority after user requests mute. Add explicit lease/media cleanup and fail-closed microphone recovery, deterministic concurrency tests.
Status: CLAIMED. Analyzer/Flutter/Android and two-device audio not yet verified.
