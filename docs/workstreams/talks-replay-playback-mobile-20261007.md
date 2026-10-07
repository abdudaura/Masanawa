# Talk replay playback mobile — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-replay-playback-mobile-20261007`
- **Base:** `2426af832475b160642e6da7c8db5663a6b7c0df`
- **Lane:** native authenticated replay playback on ended Talk surfaces
- **Owned paths:**
  - replay playback model/transport/session additions under `apps/mobile/lib/src/talks/**`
  - isolated ended/replay playback wiring under `apps/mobile/lib/src/screens/talks/**`
  - focused mobile tests
  - this workstream
- **Reuses:** merged `GET /talks/:talkId/replay/playback`, existing Talk detail/library navigation, existing live-audio dependency.
- **Not owned:** bookmark/library persistence, live Talk audio ownership, AI Seat mobile, Gateway/backend, unrelated shell/theme files.
- **Rules:** replay never opens LiveKit; playback URL is short-lived and must be refreshed on retry; no permanent URL persistence; live and replay audio sessions are mutually exclusive.
- **Status:** active.
