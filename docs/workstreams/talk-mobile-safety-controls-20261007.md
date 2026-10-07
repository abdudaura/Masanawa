# Mobile Talk safety controls — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-mobile-safety-controls-main-20261007`
- Base SHA: `e06138db3898fc5f1dbf5111ccae633d0d4b4eed`
- Latest main checked: `e06138db3898fc5f1dbf5111ccae633d0d4b4eed`
- Task: expose launch-critical Talk safety controls in the mobile Talk experience using the canonical safety backend.
- Exact owned paths:
  - `services/gateway/src/talk_safety/service.ts`
  - `services/gateway/src/talk_safety/repository.ts`
  - `services/gateway/src/talk_safety_routes.ts`
  - focused Talk safety route/service/repository tests
  - `services/gateway/src/talks/postgres_repository.ts`
  - focused Talk repository preference-enforcement tests
  - `apps/mobile/lib/src/talks/talk_safety.dart`
  - `apps/mobile/lib/src/talks/talk_safety_http_transport.dart`
  - `apps/mobile/lib/src/state/talk_safety_state.dart`
  - `apps/mobile/lib/src/screens/talks/talk_more_sheet.dart`
  - focused Talk-screen wiring/tests in `apps/mobile/lib/src/screens/talks/talk_screen.dart`
  - this claim file
- Last repository-visible update: 2026-10-07T12:04Z

## Implemented

Backend safety:
- Added verified user-ID addressing to the existing canonical safety preference service.
- New authenticated GET/PUT `/safety/users/:userId/preference` routes.
- User-ID targets are resolved through `talks.public_profiles`; arbitrary/non-profile IDs do not create preferences.
- Existing handle-based safety preference contract remains intact.
- Existing platform enforcement authority remains separate and unchanged.

Viewer enforcement:
- Explore and Live Talk repository reads now exclude a Host whose viewer preference is blocked or muted.
- Direct Talk detail enforces the same preference for non-Hosts while preserving Host self-access.
- Comment writes are rejected after that viewer blocks or mutes the Host.
- Platform restricted/blocked enforcement remains layered above viewer preference.

Mobile:
- Added typed safety transport/state for report and Host block/mute preference.
- Added compact **More** app-bar action without expanding the live Talk action row.
- **View participants** shows explicit identity labels: Human Host/Speaker, Masanawa Expert AI, Twin AI.
- **Report Talk / Report replay** opens a reason picker and submits privately to canonical safety reporting.
- **Mute Host** clearly means hide this Host's Talks from the viewer's feeds.
- **Block Host** hides their Talks and prevents Talk interaction.
- Block/mute are reversible and use the same canonical `talks.safety_preferences` records.
- Post-Share resync preserves the merged Talk **Share · More · Save** app-bar composition.

## Verification coverage added

Gateway:
- user-ID preference route read/update;
- service verifies public-profile user ID and rejects missing targets;
- repository user-ID profile resolution;
- Explore/Live feed SQL includes viewer block/mute guard;
- direct Talk detail includes viewer preference guard;
- comment writes include viewer preference guard.

Mobile:
- More sheet participant labels;
- live Talk private safety report and exact target/reason;
- Host mute and block preference mutations;
- replay report uses replay target;
- existing Share tests remain composed in the same Talk-screen harness.

## Integration audit

- The original safety lane was implemented from poll-era main, then intentionally resynchronized onto post-Share main `e06138db3898fc5f1dbf5111ccae633d0d4b4eed`.
- Share was merged first to avoid overlapping `talk_screen.dart` / `talk_screen_test.dart`; safety changes were then reapplied surgically.
- Pre-PR comparison: branch is ahead of main and 0 behind; no competing Talk-safety mobile PR exists.
- No new migration is required; all preference persistence uses the already-merged safety schema.

## Status

- Implementation status: complete pending PR/CI evidence.
- Verification status: focused backend/mobile tests written; GitHub execution evidence pending.
- Deployment status: not deployed.
- Handoff: open clean current-main PR, inspect mergeability and workflow job-step evidence, then merge if safe.
