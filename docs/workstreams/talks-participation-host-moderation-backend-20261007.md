# Talk participation + Host moderation backend — 2026-10-07

- **Owner:** current ChatGPT Talks backend window
- **Branch:** `work/talks-participation-host-moderation-backend-20261007`
- **Base at claim:** `e4537500e10222cc8b76c15af543eae9180f6b26`
- **Synced main:** `8a4b4a472f64a5ffbd6e4b03854f3e4f12d21144`
- **PR:** #353 — Add Talk participation and Host moderation backend

## Implemented

- `GET /talks/:talkId/participation`
- `POST /talks/:talkId/reactions`
- `POST /talks/:talkId/raise-hand`
- `GET /talks/:talkId/host-controls`
- `POST /talks/:talkId/host-requests/:requestId`
- `POST /talks/:talkId/host-participants/:participantId`
- `POST /talks/:talkId/end`

### Listener participation

- reaction allowlist: ❤️ 👏 😂 💯 🤔 🔥;
- reaction mutation is authenticated and rate-limited;
- Raise Hand is free and idempotent;
- raising a hand never grants a Speaker Seat;
- lowering a pending hand withdraws the Host request;
- accepted Speaker state is preserved rather than silently reverting to raised/idle.

### Host moderation

- Host identity is derived from the authenticated platform session and persisted Talk Host;
- Host request queue supports human Speaker and sponsored AI request projections;
- human Speaker acceptance is free;
- sponsored AI acceptance is blocked with `talks.ai_commerce_required` until canonical AI Seat Commerce authorization exists;
- Host cannot mute/remove itself;
- mute/unmute/remove/end are durable and retry-safe;
- explicit End coordinates Talk, live-runtime, canonical runtime and connected media sessions.

### Canonical runtime integration

- reuses merged `@masanawa/agents` Talk live state machine from PR #344;
- persists canonical Talk live snapshot + revision;
- human Speaker admission uses `human_seat_admitted`;
- remove uses `seat_removed`;
- Host end uses canonical `ended`;
- all canonical writes use revision CAS;
- live Host disconnect/reconnect/grace-expiry now synchronize into the canonical snapshot;
- late Host reconnect after grace is evaluated before heartbeat can restore Live state.

### Live media enforcement

- live roles are now Host / Speaker / Listener;
- only Host and admitted, unmuted Speaker sessions receive microphone publish authority;
- listeners remain subscribe-only;
- accepted Speaker sessions are promoted server-side;
- mute/unmute calls LiveKit RoomService `UpdateParticipant` to revoke/restore publish permission;
- revoking `can_publish` causes published tracks to be unpublished by LiveKit;
- remove/end call LiveKit `RemoveParticipant`;
- short-lived Talk media tokens default to 30 seconds to bound stale permission reuse on self-hosted LiveKit;
- failed SFU calls can be retried after the durable database mutation without losing the media action.

## Persistence

Migration `0005_talk_moderation.sql` adds:
- participation state;
- Host request queue;
- durable Talk Seat projection;
- canonical live snapshot/revision;
- Speaker role + mute state on live sessions.

## Verification

Focused tests cover:
- Raise Hand/lower hand route behavior;
- reaction allowlisting;
- canonical free-human Speaker admission;
- Host immutability;
- LiveKit permission revocation and participant removal;
- Speaker media-token permissions.

PR #353 is mergeable. Foundation CI run `37604530276`, job `112736676889`, failed before creating any workflow steps; the returned step list is empty. This matches the previously documented repository-wide CI runner/service-startup failure and provides no branch-specific test failure.

No production migration, LiveKit deployment, or production environment mutation was performed from this window.

**Implementation status:** complete for listener participation + Host moderation + human Speaker media admission.  
**Claim status:** handoff-ready and approved for merge by the user.
