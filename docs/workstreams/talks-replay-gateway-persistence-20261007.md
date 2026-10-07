# Talk replay Gateway + persistence integration — 2026-10-07

- **Owner:** current ChatGPT Talks backend window
- **Branch:** `work/talks-replay-gateway-persistence-20261007`
- **Base:** `9531f01323fc399c1762ae6141fd30698c7a80cb`
- **PR:** #358 — Add durable Talk replay Gateway and persistence
- **Lane:** durable replay persistence, Host controls, public replay visibility, opaque segment custody

## Implemented

- `POST /talks/:talkId/replay/recording`
  - requires explicit Host consent;
  - Host chooses publish/private preference;
  - only the real authenticated Talk Host can start/read/control replay state.
- `GET /talks/:talkId/replay`
- `POST /talks/:talkId/replay/publication`
  - publish;
  - unpublish;
  - discard.
- `GET /me/talks`
  - owned live/reconnecting Talks;
  - owned finalized replays;
  - owned cards project `viewerIsHost: true`.

## Durable replay state

- Reuses merged `@masanawa/agents` replay state machine from PR #349.
- Persists replay session JSON + revision with revision CAS.
- Persists opaque media-segment custody metadata separately.
- Segment row + replay revision/session update are committed through one SQL CTE.
- Duplicate segment identity is replay-safe.
- Host discard removes segment custody in the same replay-state mutation.
- Host End invokes replay finalization only after durable Talk end succeeds.
- Replay finalization + Talk duration projection are committed atomically.
- Platform-block repository boundary is available for safety enforcement.
- Media references remain opaque and are never exposed as public storage URLs.

## Visibility/security

- Explore shows ended Talks only when replay is:
  - finalized; and
  - published.
- Non-Hosts cannot resolve private/blocked ended Talk details.
- Non-Hosts cannot comment on private/blocked ended Talks by guessing a Talk ID.
- The Host retains access to their own private/finalized replay through My Talks.
- Replay never creates or extends live state.
- Empty finalized recordings remain non-public according to the canonical replay runtime.

## Tests

Focused tests cover:
- Host-consented replay start;
- My Talks contract;
- atomic segment/revision custody;
- private replay Host library projection;
- ended-Talk Explore visibility;
- ended private detail authorization;
- ended private comment authorization;
- Host-end replay finalization callback.

## Verification

- PR #358 is reported **mergeable** by GitHub.
- Foundation CI run `37607603543` is queued at handoff time; no green-CI claim is made.
- The repository has an existing documented zero-step Foundation CI runner/service-startup failure pattern on recent Talk lanes.
- No production migration, object-storage mutation, LiveKit Egress deployment, or production environment change was performed from this window.

## Remaining media-delivery boundary

This lane deliberately does not invent public media URLs. The next lane should connect real LiveKit Egress/object-storage custody to `appendSegment`, then issue authenticated/signed playback delivery from opaque `mediaRef` values. Public replay visibility must continue to depend on the durable replay state above.

**Implementation status:** complete for replay Gateway/persistence/public-visibility integration.  
**Claim status:** handoff-ready and approved for merge.
