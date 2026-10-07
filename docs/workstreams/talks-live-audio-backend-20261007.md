# Talks live-audio backend — 2026-10-07

- **Owner:** current ChatGPT Talks backend window
- **Branch:** `work/talks-live-audio-backend-20261007`
- **Stacked base:** PR #337 head `32445d182ae483527be2615afbf822aac6ffa47d`
- **PR:** #345 — Add Talk live presence and admission runtime
- **Lane:** Talk live presence, reconnect authority and real media credentials

## Implemented

- `POST /talks/:talkId/live/connect`
- `POST /talks/:talkId/live/heartbeat`
- `POST /talks/:talkId/live/disconnect`
- `GET /talks/:talkId/live/state`
- `POST /talks/:talkId/live/media-token`
- durable Host/listener live sessions;
- Host authority derived only from the persisted Talk Host user;
- Host microphone-publish permission; listeners subscribe-only;
- Live / Reconnecting / Ended lifecycle;
- bounded reconnect grace;
- stale heartbeat recovery for crashed clients;
- immediate AI-generation disable when Host presence is lost;
- Talk lifecycle synchronization in PostgreSQL;
- short-lived LiveKit-compatible HS256 room credentials;
- opaque Talk/session/user identifiers only in media room/token identity;
- production env composition via `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`;
- HTTP, persistence and media-token tests.

## Product/security invariants

- A Talk cannot remain AI-active without a connected human Host.
- No listener, AI, Twin, Expert or scheduler can mint Host authority.
- Media publish permission is derived server-side from the authenticated persisted Talk role.
- A listener token cannot publish audio/data.
- Host media token is limited to microphone publishing and room subscription.
- Session ownership is checked on heartbeat/media-token issuance.
- Host crash/loss moves the Talk to reconnecting and disables AI turns immediately.
- After reconnect grace expiry, Talk state transitions to ended.
- Existing Gemini Live foundations remain the AI-voice path; this lane does not duplicate them.

## Boundary still owned elsewhere

Human **Speaker Seats** require Host moderation/admission. This lane intentionally exposes only Host vs listener authority until the independent host-moderation lane grants a human Speaker Seat. That lane should extend the media role from an explicit server-side admission, never a client role field.

Replay recording/egress remains an independent replay lane.

## Verification

- PR #345 is mergeable.
- Foundation CI retains the repository-wide zero-step runner failure signature.
- Focused Talk live HTTP/persistence/media-token tests are committed.
- No LiveKit deployment or production migration was performed from this window; runtime credentials activate when the three LiveKit env values are configured.

**Implementation status:** complete for Host/listener live presence + media credential slice.  
**Claim status:** handoff-ready through stacked PR #345.
