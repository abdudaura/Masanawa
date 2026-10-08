# R02 mobile live-audio session recovery

Owner/window: ChatGPT R02 audio recovery window, 2026-10-08
Branch: `work/r02-live-audio-session-recovery-20261008`
Base main SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
Task: R02 — bounded mobile LiveKit session failure/retry and cleanup resilience; **not** provider qualification or shared Gateway configuration.
Owned paths: `apps/mobile/lib/src/talks/talk_live_audio_session.dart`, `docs/workstreams/talk-live-audio-session-r02-20261008.md`.
Shared dependencies: existing `TalkLiveTransport`, `TalkLiveRoom`; do not change Gateway, Android config, theme, localization, financial paths or canonical docs.
Current step: inspect and implement session recovery from failed start, preserving server disconnect authority and one active room.
Status: claim published; implementation pending. Verification pending; deployment and device acceptance not claimed.
Last repository-visible activity: 2026-10-08T00:53:00Z (initial claim; refresh on commits).
