# Speaker return-to-Audience — 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-speaker-leave-seat-20261007`
- Base SHA: `64406eea4e39834ca6003afb442c9c347c20db44`
- Task: complete the product success path where an admitted human Speaker voluntarily leaves their Seat and remains in the Talk Audience.
- Last repository-visible update: 2026-10-07T14:58Z

## Implemented

Backend:
- Added authenticated `POST /talks/:talkId/leave-seat`.
- Authenticated user can only leave their own active non-Host human Seat.
- Host cannot use this path.
- AI Seats cannot use this path.
- Ended/non-live Talks reject the mutation.
- The existing canonical `seat_removed` transition is reused.
- Canonical revision update is gated on the same active eligible relational Seat to avoid divergence on races.
- Durable Talk Seat becomes inactive and `removed_at` is set.
- Participation returns to `idle` while preserving the current reaction.
- Connected live sessions stay in the room:
  - role becomes `listener`;
  - mute state resets;
  - LiveKit publish permission is revoked via the existing media-admin `publish:false` action.
- No participant disconnect is issued for voluntary self-leave.

Re-entry:
- An accepted human Raise Hand request is moved to `withdrawn`, allowing the same deterministic `hand_<user>` request to become pending again later.
- Added migration `0014_human_invitation_left.sql`.
- Human invitation status now includes `left`.
- An accepted invitation is marked `left` when that Speaker voluntarily returns to Audience.
- The existing Host invite upsert can therefore invite them again later.
- No Commerce state is involved.

Mobile:
- `TalkParticipationTransport` now exposes `leaveSeat(talkId)`.
- Gateway transport calls `POST /talks/:talkId/leave-seat`.
- Accepted human Speaker action is now labeled **Leave seat** instead of the inert **Speaker** label.
- Tapping **Leave seat** invokes the dedicated self-leave mutation rather than Raise Hand.
- Participation provider is refreshed.
- Live audio is restarted after successful leave so the client immediately obtains fresh listener role/credentials rather than showing stale Speaker state.
- Success message: **You’re back in the Audience.**
- Once refreshed, the action returns to **Raise hand**.

## Verification coverage added

Gateway:
- route test covers authenticated Speaker leave-seat response;
- PostgreSQL regression admits the Speaker through the canonical `human_seat_admitted` transition first;
- self-leave regression verifies:
  - participation becomes idle;
  - existing reaction survives;
  - media action revokes publish rather than removing the participant;
  - live session role becomes listener;
  - accepted hand request becomes withdrawn;
  - accepted invitation becomes left;
  - canonical session is updated through the seat-gated CTE.

Mobile:
- participation fake records self-leave calls and returns idle;
- accepted Speaker sees **Leave seat**;
- tapping it calls self-leave once;
- UI returns to **Raise hand** and shows the Audience confirmation.

## Product invariants

- Human Seats remain free.
- Host and AI Seat authority are unchanged.
- Self-leave does not end or disconnect the Talk.
- User stays eligible to listen, comment, react and raise a hand again.
- No parallel live-role authority is introduced.
- No existing Host moderation/remove path is replaced.

## Status

- Implementation status: complete pending current-main/PR evidence.
- Verification status: focused backend/mobile regressions committed; repository CI execution evidence pending.
- Deployment status: not deployed.
- Handoff: compare against latest main/open claims, resync if behind, then open PR and inspect mergeability + workflow job-step evidence before merge.
