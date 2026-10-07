# Speaker self-mute — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-speaker-self-mute-20261007`
- Base SHA: `614ad27f27ad639ba97c8cfa1effeae5e4c88308`
- Task: let admitted human Speakers mute/unmute their own live microphone without exposing publish controls to listeners.
- Exact owned paths:
  - `apps/mobile/lib/src/screens/talks/talk_screen.dart`
  - `apps/mobile/test/talk_screen_test.dart`
  - this claim file
- Contract:
  - Host self-mute remains unchanged;
  - Speaker can mute/unmute their own local live audio publisher;
  - Listener never receives a mic toggle;
  - no backend moderation/Seat authority changes.
- Current step: extend local live mic control to Host or Speaker and add role-gated widget regressions.
- Last update: 2026-10-07T15:00Z
- Status: active
