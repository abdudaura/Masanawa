# Follow Host from Talk More — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-follow-host-more-main-20261007`
- Base SHA: `8a173d8336115efae95d109bc0103e69c42e04a7`
- Task: expose canonical Host follow/unfollow directly from a Talk without guessing a public handle.
- Last repository-visible update: 2026-10-07T13:00Z

## Implemented

Backend/social graph:
- Extended the existing Talk social-profile repository/service; no parallel social graph.
- Added authenticated `GET /profiles/by-user/:userId`.
- Added authenticated `POST /profiles/by-user/:userId/follow` with `{ following }`.
- User IDs resolve only through the existing tenant-scoped `talks.public_profiles` projection.
- Follow/unfollow still writes the same durable `talks.follows` table.
- Existing idempotent insert/delete semantics are preserved.
- Existing profile safety enforcement remains in the resolution query.
- Self-follow still raises `profiles.cannot_follow_self`.
- Existing handle-based profile/follow endpoints remain unchanged.

Mobile:
- Extended `TalkSocialProfileTransport` with user-ID profile/follow operations.
- Added `humanProfileByUserIdProvider`.
- Listener Talk More now shows **Follow Host** or **Following** using the canonical Host user ID already carried in the Talk participant projection.
- Follow state refreshes in-place after mutation.
- Hosts never see a self-follow action.
- If no verified public profile exists for the Host, no fake/guessed follow action is shown.
- Existing Edit, participants, report, block/mute, Share/Save, Direct Twin and live controls remain unchanged.

## Verification coverage added

Gateway:
- user-ID profile read route;
- user-ID follow route;
- PostgreSQL user-ID profile resolution with viewer-scoped follow state;
- user-ID follow reuses the idempotent `talks.follows` path.

Mobile:
- dedicated profile transport fake supports user-ID reads/follows;
- Talk-screen harness overrides social transport so tests never hit real HTTP;
- listener follows, sees **Following**, then unfollows in the same More sheet;
- Host does not see the self-follow action.

## Integration audit

- Original implementation branch started from `bc6c09f...`.
- While it was active, live AI Seat runtime work advanced main to `8a173d8...`.
- Upstream file audit showed zero overlap with this lane.
- The lane was therefore cleanly retransplanted onto `8a173d8336115efae95d109bc0103e69c42e04a7`.
- No database migration is required.

## Status

- Implementation status: complete pending PR/CI evidence.
- Verification status: focused backend/mobile regression coverage committed.
- Deployment status: not deployed.
- Handoff: confirm branch is 0 behind latest main, open PR, inspect mergeability and workflow job-step evidence, then merge if safe.
