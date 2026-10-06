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


## Implementation checkpoint — 2026-10-06

Implemented in this isolated lane:
- strict published Series/Episode mobile contracts;
- HTTPS-only audio/artwork references;
- deterministic episode ordering and cross-series binding rejection;
- bounded authenticated-listening progress contract;
- bounded reaction vocabulary: Like, Love, Funny, Thoughtful;
- transport seam with no Gateway authority in the client;
- Riverpod loading/caching/progress/reaction state;
- Story Radio landing screen with Continue Listening, Featured and Series sections;
- Series screen with ordered episodes, Play entry and lightweight reactions;
- focused model regressions for ordering, insecure media, cross-series leakage,
  progress overflow and invalid reaction values.

Still intentionally owned elsewhere:
- persistent admin Story Radio publication model and storage — Lane A;
- authenticated Gateway endpoints and real transport composition — PR #136/shared owner;
- router/Home entry — PR #136/shared owner;
- actual audio playback session binding, progress timers and next-episode autoplay —
  shared mobile integration after transport endpoints exist;
- physical APK verification.

Flutter/Dart is not installed in this execution environment, so no local analyzer/test
pass is claimed. The code is isolated to new paths and adds no dependency or lockfile
change.
