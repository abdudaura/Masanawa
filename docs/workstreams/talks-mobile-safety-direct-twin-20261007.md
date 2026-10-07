# Talk mobile safety + Direct Twin — 2026-10-07

- Owner/window: current ChatGPT integration window
- Branch: `work/talks-mobile-safety-direct-twin-20261007`
- Base SHA: `e06138db3898fc5f1dbf5111ccae633d0d4b4eed`
- Reclaims stale mobile-safety claim after confirming its branch contains no implementation beyond the claim.
- Task: complete the two remaining customer-facing Talk controls required before integrated APK qualification.

Owned paths:
- `apps/mobile/lib/src/talks/talk_safety.dart`
- `apps/mobile/lib/src/talks/talk_safety_http_transport.dart`
- `apps/mobile/lib/src/state/talk_safety_state.dart`
- isolated safety additions in Talk/profile screens
- `apps/mobile/lib/src/talks/talk_direct_twin.dart`
- `apps/mobile/lib/src/talks/talk_direct_twin_http_transport.dart`
- `apps/mobile/lib/src/state/talk_direct_twin_state.dart`
- isolated Direct Twin additions in Talk screen
- focused mobile tests
- this workstream file

Rules:
- use already-merged Gateway safety and Direct Twin routes; no second backend authority;
- Report identity is server-derived;
- Block/Mute preferences are server-backed, not local-only;
- Direct Twin is visible only for active owned Twin Seats and remains private;
- preserve current LiveKit, replay, Gift, poll, question, Host moderation and Share behavior.

Status: active.
