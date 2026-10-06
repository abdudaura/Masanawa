# Story Radio workstream

Status: active
Owner branch: `work/story-radio-20261006`
Lane: S — Story Radio
Claimed: 2026-10-06

## Owned paths

- `docs/workstreams/story-radio.md`
- `apps/mobile/lib/src/story_radio/**`
- `apps/mobile/lib/src/state/story_radio_state.dart`
- `apps/mobile/lib/src/screens/story_radio/**`
- `apps/mobile/test/story_radio/**`

No shared Gateway/router/chat/environment/Commerce/Event migration files are owned.

## Product boundary

Story Radio is an admin-published serialized audio listening surface.

Consumer users may browse published series, continue listening, inspect episodes, play
an episode, continue to the next episode, persist listening progress and submit bounded
reactions.

Consumer users may not create/publish stories, upload episodes, create video/storyboard
projects or comment publicly.

Admin publishing/domain persistence is a coordinated follow-up with Lane A. This lane
defines the mobile-facing contracts and isolated presentation/state needed for production
integration without creating another runtime authority.

## Integration handoff

The shared production owner should later supply a real `StoryRadioTransport`, add routes
to Home/router, and bind playback to authorized episode audio URLs. This workstream does
not claim those shared files.
