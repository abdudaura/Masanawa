# Speaker self-mute — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-speaker-self-mute-20261007`
- Base SHA: `614ad27f27ad639ba97c8cfa1effeae5e4c88308`
- Task: let admitted human Speakers mute/unmute their own live microphone without exposing publish controls to listeners.
- Last repository-visible update: 2026-10-07T15:02Z

## Implemented

- Existing live microphone toggle now appears for:
  - human Host;
  - admitted human Speaker.
- Listener role remains subscribe-only and never receives the microphone toggle.
- Existing connection-state guards remain:
  - hidden while connecting;
  - hidden after ended/failed state.
- `_toggleLiveMute` now accepts only Host or Speaker controller roles.
- Toggle still uses the existing live-audio controller `setMuted` path; no new media or moderation authority.
- Host behavior is unchanged.

## Verification coverage

- Existing live-listener test verifies no `talk-live-mic-toggle`.
- Existing Host test verifies Host can mute and reaches **Muted** state.
- New Speaker test uses a real Speaker-role fake controller and accepted participation state:
  - **On mic** status is visible;
  - mic toggle is visible;
  - tapping it calls the same local mute path;
  - state becomes **Muted**;
  - no widget exception.

## Status

- Implementation status: complete pending PR/CI evidence.
- No backend, migration, Seat policy, or LiveKit server changes required.
- Handoff: compare against latest main/open claims, open PR if 0 behind, inspect workflow job-step evidence, merge if safe.
