# Talk participant projection — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-participant-projection-20261007`
- Base SHA: `7f77a50481ac46142ac170e3a60ea80837780811`
- Task: project the real Talk table into canonical feed/detail participant metadata.
- Last repository-visible update: 2026-10-07T15:12Z

## Implemented

Repository projection:
- Feed and direct-detail queries now project durable Talk Seat identity from `talks.talk_seats`.
- Live/Reconnecting Talks include active non-Host Seats.
- Ended/replay Talks include durable Seat history so participant labels do not collapse to Host-only after the live session ends.
- Human Speaker ID = canonical platform `user_id`.
- Expert/Twin ID = canonical `persona_id`.
- Display name, kind and avatar are projected from the durable Seat row.
- Rows without the required canonical human/persona identity are not serialized.
- Host rows are explicitly excluded from the Seat subquery.

Canonical serialization:
- The human Host remains synthesized first from `talks.talks.host_user_id/host_name`.
- Repository participant rows follow in admission order.
- Any duplicate human participant whose ID equals the canonical Host user ID is filtered defensively.
- Human / Expert / Twin labels remain explicit.
- Existing mobile `TalkParticipantPreview` JSON contract already accepts these fields; no mobile model migration is required.

Why this matters:
- The real Talk screen and Participants sheet now receive the actual table rather than only the Host.
- Human Speaker identities are trustworthy enough for existing user-ID profile/follow lookup.
- Expert/Twin identities remain persona IDs rather than being confused with human users.
- Replay participant identity survives end-of-live state through durable Seat history.

## Verification coverage

PostgreSQL:
- feed query asserts `talks.talk_seats` projection;
- verifies human user ID, Expert persona ID and Twin persona ID mapping;
- verifies active-live vs ended-history predicate;
- verifies Host Seat exclusion;
- direct Talk detail uses the same projection.

Service serialization:
- Host is always first and marked Human · Host;
- a duplicate Host Seat is removed;
- human Speaker, Expert and Twin remain in order with canonical IDs.

## Invariants

- No Seat lifecycle, capacity, moderation or Commerce authority changed.
- No new migration is required.
- Host remains the only Host.
- AI identities are never routed through human user IDs.
- Feed and detail share one participant representation.

## Status

- Implementation status: complete pending PR/CI evidence.
- Verification status: focused repository/service regressions committed; repository CI execution evidence pending.
- Deployment status: not deployed.
- Handoff: compare against latest main/open claims, resync if behind, then open PR and inspect mergeability + workflow job-step evidence before merge.
