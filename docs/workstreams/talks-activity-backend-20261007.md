# Talk Activity backend — 2026-10-07

- **Owner/window:** current ChatGPT Talks backend window
- **Branch:** `work/talks-activity-backend-20261007`
- **Stacked base:** PR #337 head `32445d182ae483527be2615afbf822aac6ffa47d`
- **PR:** #340 — Add durable Talk Activity backend projection
- **Lane:** authenticated Talk-network Activity projection + durable persistence

## Implemented

- `GET /activity?filter=all|talks|money|social&limit=60`.
- Existing platform customer session is the only read authority.
- Every read is scoped by both tenant and authenticated user.
- Durable `talks.activity` storage for:
  - Talk invitations;
  - Raise Hand outcomes;
  - sponsored/accepted/declined AI Seat events;
  - follows;
  - gifts;
  - Twin hires;
  - earnings;
  - replay milestones;
  - platform notices.
- Compact category filtering matching the active mobile Activity contract.
- Safe display-only amount labels and public transaction references without exposing ledger internals.
- Idempotent append boundary for future Talk/Seat/social/Commerce producers.
- Gateway production composition.
- HTTP contract tests and PostgreSQL repository-boundary tests.

## Owned paths

- `services/gateway/src/talk_activity/**`
- `services/gateway/src/talk_activity_routes.ts`
- `services/gateway/src/talk_activity_routes.test.ts`
- `packages/talks/migrations/0002_talk_activity.sql`
- isolated inherited Talk-Gateway composition additions
- this handoff

No mobile, AI Seat Commerce, profile/follow backend, push-delivery, unrelated Twin/Commerce/channel files were edited.

## Verification

- PR #340 is mergeable.
- Foundation CI run `37600418018` failed before any workflow step was created.
- This matches the already-documented baseline zero-step CI failure on PR #337/current main, so there is no honest branch-specific CI result to attribute to this code.
- Focused tests are committed and ready once the repository runner/service startup issue is repaired.
- No production migration/deployment executed.

## Follow-on producers

Future Talk invitation/Seat moderation, AI Seat Commerce, follow, gift/earning and replay lanes should append safe Activity records through this repository boundary instead of creating separate notification dashboards.

**Implementation status:** complete for the claimed Activity backend slice.  
**Claim status:** handoff-ready through stacked PR #340.
