# Talk live-audio mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-live-audio-mobile-20261007`
Base: `025666690e41c8cde69ba67451591b0690fa220f`

## Scope

Wire the Talk screen to the active live-presence/media contract from PR #345 using
LiveKit audio on mobile.

Owned:
- mobile Talk live-session models/HTTP transport;
- LiveKit room adapter and lifecycle/heartbeat session;
- Talk screen live connection/mute/speaker status UI;
- mobile dependency/permission configuration strictly required for LiveKit audio;
- focused mobile tests;
- this handoff.

Not owned:
- Gateway live routes/service/migrations (#345);
- agent human-presence runtime (#344);
- Host moderation backend;
- Talk persistence;
- AI Seat Commerce;
- replay recording/storage;
- production deployment.

## Locked runtime contract

Use PR #345 exactly:
- POST `/talks/:talkId/live/connect`
- POST `/talks/:talkId/live/heartbeat` with `{sessionId}`
- POST `/talks/:talkId/live/disconnect` with `{sessionId}`
- POST `/talks/:talkId/live/media-token` with `{sessionId}`
- GET `/talks/:talkId/live/state`

Media credentials are LiveKit:
`server_url, participant_token, room_name, participant_identity, expires_at`.

Listeners subscribe to audio but never receive publish authority.
Only the real Host may publish microphone audio when `canPublishAudio=true`.
Host reconnect state must be explicit; AI generation is never kept alive by a listener.

Status: active.
