# Talk replay playback mobile — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-replay-playback-mobile-20261007`
- **Base:** `2426af832475b160642e6da7c8db5663a6b7c0df`
- **Synced current main:** `1ec7c6d74380f83a636f67d76c89641baa9372cf`
- **PR:** #369 — Add native replay playback to ended Talks

## Implemented

- Ended Talk screens now render a compact native replay control:
  - Play/Pause;
  - seek;
  - elapsed/total time;
  - loading;
  - unavailable/retry state.
- Replay is user-initiated; there is no autoplay.
- First Play requests fresh authenticated replay credentials from:
  - `GET /talks/:talkId/replay/playback`.
- Pause/resume reuses the active loaded source.
- Replay after completion fetches a fresh signed URL.
- Retry after a failure fetches fresh credentials rather than reusing an expired URL.
- Signed playback URLs remain ephemeral inside the active player session and are not persisted.
- The player and stream subscriptions are disposed when the Talk screen closes.
- Live Talks do not instantiate replay playback and continue to use the existing LiveKit audio session only.
- Existing `just_audio ^0.10.6` dependency is reused; no dependency/lockfile change required.

## Mobile architecture

Added:
- `talk_replay_playback.dart`
  - credentials;
  - transport contract;
  - playback snapshot/status;
  - serialized playback controller.
- `talk_replay_playback_http_transport.dart`
  - authenticated Gateway playback-envelope loading.
- `talk_replay_audio_player.dart`
  - `just_audio` adapter.
- `talk_replay_playback_state.dart`
  - Riverpod transport/player/session factory seam.
- ended-Talk integration in `talk_screen.dart`.

## Safety/lifecycle rules

- Replay and LiveKit audio are mutually exclusive by Talk state.
- Ended Talks never start the live-room session.
- Live Talks never create replay player state.
- Malformed playback envelopes are rejected before reaching the audio player.
- Playback errors collapse to a safe, user-friendly retry state.
- Replay URLs are short-lived and refreshed when needed.

## Tests

Focused tests cover:
- first Play fetches signed URL;
- Pause does not refetch;
- replay-after-completion refreshes signed credentials;
- Retry refreshes after failure;
- seek uses loaded duration;
- malformed/non-OGG playback envelope rejection;
- ended Talk shows replay control;
- replay does not autoplay;
- replay mode never starts LiveKit.

## Verification

- GitHub reports PR #369 mergeable.
- Mobile Build run `37611387009`, job `112759193174`: failed before any workflow step; step list is empty.
- Foundation CI run `37611387007`, job `112759193043`: failed before any workflow step; step list is empty.
- These match the repository-wide zero-step Actions runner/service-startup failure pattern already documented on other Talks lanes.
- No successful CI execution is claimed.
- No physical-device playback qualification was performed from this window.

## Remaining qualification

After production replay S3/LiveKit configuration is deployed:
- create and end a real Talk recording;
- open the ended Talk on Android;
- confirm OGG replay is audible;
- pause/resume/seek;
- let a signed URL expire, then verify Retry obtains a fresh URL;
- confirm live Talk entry still uses only LiveKit audio.

**Implementation status:** complete for native mobile replay playback.  
**Claim status:** handoff-ready and approved for merge.
