# Talk replay Egress + playback delivery — 2026-10-07

- **Owner:** current ChatGPT Talks backend window
- **Branch:** `work/talks-replay-egress-playback-20261007`
- **Synced base:** `7344a0d5de7134c7360b0137487285c1ecc0a873`
- **PR:** #363 — Add real Talk replay Egress and private playback

## Implemented

### Real recording
- Uses LiveKit's current unified `StartEgress` API.
- Captures the whole Talk as audio-only mixed room audio.
- Writes one OGG file to private S3-compatible object storage.
- Uses LiveKit `roomRecord` server authorization.
- Supports custom S3-compatible endpoints and `force_path_style`, suitable for providers such as DigitalOcean Spaces/R2-compatible storage.
- Durable media-job states:
  - `recording`
  - `stopped`
  - `ready`
  - `aborted`.
- Egress/object identity is persisted before replay publication can succeed.
- If Egress starts but media-job persistence fails:
  - Egress is stopped;
  - deterministic private object cleanup is attempted;
  - recording start fails instead of pretending success.

### Finalization and retries
- Explicit Host End finalizes replay recording.
- Host reconnect-grace expiry also finalizes replay recording through the live terminal callback.
- Platform terminal reason remains supported by the coordinator.
- Egress stop is durably recorded before object hashing.
- A retry from `stopped` never issues a second StopEgress.
- Private object availability is bounded-retry after Egress stop to tolerate short storage propagation/upload delay.
- The stored object is SHA-256 hashed before it becomes a replay segment.
- Replay segment append + replay runtime rules remain authoritative.
- A ready media object is not re-recorded or re-stopped on retry.

### Discard
- Host discard stops an active Egress.
- Private replay object is deleted.
- Media job becomes `aborted`.
- Discard is retry-safe through the replay persistence layer.
- Aborted media never satisfies playback authorization.

### Playback
Authenticated endpoint:

`GET /talks/:talkId/replay/playback`

Returns:
- short-lived signed playback URL;
- expiry time;
- `audio/ogg` content type.

Authorization:
- Host may play their own finalized private replay.
- Other viewers require a finalized **published** replay.
- Media job must be `ready`.
- Permanent object URLs and storage credentials are never returned.

Playback URLs use S3 SigV4 and are bounded to 30–900 seconds.

## Production configuration

Required as a complete set to activate recording/playback:
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `MASANAWA_TALK_REPLAY_S3_ENDPOINT`
- `MASANAWA_TALK_REPLAY_S3_REGION`
- `MASANAWA_TALK_REPLAY_S3_BUCKET`
- `MASANAWA_TALK_REPLAY_S3_ACCESS_KEY`
- `MASANAWA_TALK_REPLAY_S3_SECRET`

Optional:
- `MASANAWA_TALK_REPLAY_PLAYBACK_TTL_SECONDS`
  - default: 300
  - range: 30–900.

Partial replay S3 configuration fails startup explicitly.

If replay storage is entirely unconfigured, Talk recording/playback returns an explicit unavailable response rather than creating metadata-only recordings.

## Persistence

Migration:
`packages/talks/migrations/0007_talk_replay_media.sql`

Adds durable Egress/object custody without exposing provider URLs in canonical replay state.

## Tests

Focused tests cover:
- current LiveKit StartEgress audio-only OGG payload;
- LiveKit `roomRecord` JWT signature;
- StopEgress request;
- S3-compatible signed object GET;
- SHA-256 verification;
- signed DELETE;
- SigV4 short-lived playback URL;
- object-availability retry after Egress stop;
- cleanup when media-job persistence fails;
- stopped-Egress finalization retry;
- authenticated playback route;
- Host reconnect-grace expiry replay-finalization callback.

## Verification

- PR #363 is GitHub-mergeable.
- Foundation CI run `37609675365`, job `112753603320`, failed before creating any workflow step.
- GitHub returned an empty step list for the failed job, matching the repository-wide zero-step Foundation CI runner/service-startup failure already documented on prior Talks lanes.
- No branch-specific compile/test failure was surfaced by CI.
- No production S3 bucket, LiveKit Egress service, migration, or environment variable was modified/deployed from this window.

## Remaining product integration

The backend now has real recording and authenticated replay delivery. A consumer mobile lane can call the playback endpoint for ended/replay Talks and render native audio controls without receiving bucket credentials or permanent storage URLs.

**Implementation status:** complete for real replay Egress + private storage + authenticated playback delivery.  
**Claim status:** handoff-ready and approved for merge by the user.
