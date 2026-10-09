# F02 — Fail-closed Live Talk response model recovery (2026-10-09)

- **Window:** independent ChatGPT F02 foundation recovery; scope R02 live audio contract safety.
- **Base/main SHA:** `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Branch:** `work/f02-live-response-fail-closed-20261009`; **PR:** draft pending code checkpoint.
- **Status:** CLAIMED / PARTIAL_IMPLEMENTATION; NOT VERIFIED / NOT DEPLOYED.
- **Exact owned paths:** `apps/mobile/lib/src/talks/talk_live.dart`, `apps/mobile/test/talk_live_response_safety_test.dart`, this claim/handoff file. No edits to shared router, Android, Firebase, Gateway, SQL, ledger, existing R02 room/audio-session files, or production.
- **Collision check:** Recovered R02 drafts #439 (server sessions/token issuer), #448/#449 (AI worker), #456 and #408 (mobile audio session), none own the exact paths above. Existing Draft #497 owns integrated shell and is untouched. Five-minute lease applies; source is subordinate to actual LiveKit, authenticated Host/Speaker/Listener, device and reconnect acceptance.
- **Problem observed on main:** unknown or absent `state` defaults to `live` and absent `canHearAudio` defaults to true. A partial/stale/malformed response could present microphone/live state before authority is confirmed.
- **Implementation intent:** require server-authoritative live/reconnecting/ended and explicit hearing grant; gate publication and AI on a fully authorized active session; validate model response conservatively; retain valid Gateway response schema. Add fail-closed tests for malformed states, role and grants, session IDs and media expiry. Any alternate Gateway C/R contract remains authoritative; do not invent client permission.
- **Test plan:** `cd apps/mobile && flutter test test/talk_live_response_safety_test.dart test/talk_live_http_transport_test.dart test/talk_live_audio_session_test.dart`; `flutter analyze lib/src/talks/talk_live.dart`. Flutter SDK, LiveKit credentials and a second Android device are not present in this connector environment; do not claim tests ran until executed.
- **Dependencies:** later F02 integrator must reconcile these DTO guards with #456/#408 audio-session branches, actual Gateway/LiveKit speaker and host controls, two devices, reconnect and native audio focus. Production and merge excluded.
- **Last repository-visible step:** initial lease claim commit, 2026-10-09; refreshed after implementation below.
