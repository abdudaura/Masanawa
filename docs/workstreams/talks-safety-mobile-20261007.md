# Talk safety mobile — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-safety-mobile-20261007`
- **Base:** `c21ca39aa52fee6c4b99975231c454693a217674`
- **Lane:** customer-facing Report + profile Block/Mute controls backed by canonical Talk safety API
- **Owned paths:**
  - `apps/mobile/lib/src/talks/talk_safety.dart`
  - `apps/mobile/lib/src/talks/talk_safety_http_transport.dart`
  - `apps/mobile/lib/src/state/talk_safety_state.dart`
  - isolated Talk/replay safety UI additions under `apps/mobile/lib/src/screens/talks/**`
  - isolated profile safety UI additions in `apps/mobile/lib/src/screens/profile/person_profile_screen.dart` and `persona_profile_screen.dart`
  - focused mobile tests
  - this workstream
- **Reuses:** merged `/safety/reports` and `/safety/profiles/:handle/preference` routes.
- **Not owned:** admin safety UI, backend enforcement, unrelated Talk/live/replay/audio files outside isolated UI wiring.
- **Rules:** Report uses server-generated reporter identity; Block/Mute are viewer-local backend preferences; no local-only moderation state; admin enforcement is never exposed through customer UI.
- **Status:** active.
