# Talk live-audio mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-live-audio-mobile-20261007`
Base: `025666690e41c8cde69ba67451591b0690fa220f`

## Scope

Wire the Talk screen to the canonical live-presence/media contract now merged from PR #345 using
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


## Implementation checkpoint

Implemented:
- canonical mobile models for PR #345 live session/state/media envelopes;
- exact Gateway transport for connect / heartbeat / disconnect / media-token / state;
- LiveKit Flutter audio dependency (`livekit_client ^2.13.0`);
- auto-subscribe LiveKit room connection for listeners;
- microphone publication is enabled only when the backend returns both:
  - `role=host`, and
  - `canPublishAudio=true`;
- listeners never request microphone publication;
- Talk audio prefers the phone speaker while respecting wired/Bluetooth routes and restores
  the system preference on room close;
- 10-second server heartbeat, safely inside the 30-second default Host grace window;
- reconnecting state is visible on the Talk screen;
- Host microphone is stopped while the server reports reconnecting;
- ended state closes LiveKit media instead of allowing synthetic continuation;
- explicit server disconnect is attempted on Talk-screen disposal;
- Talk screen automatically connects when entering a live Talk;
- listeners see **Listening** and receive remote LiveKit audio;
- Hosts see **On mic / Muted** with a real microphone toggle;
- failed audio shows a friendly **Audio unavailable** retry affordance;
- replay Talks never start a live media session;
- iOS microphone usage copy now explicitly covers live Talks;
- focused model, HTTP route, session lifecycle and Talk-screen tests.

## Media authority

The client does not decide who can publish. It consumes PR #345's short-lived LiveKit
credential grant. The backend-generated token remains authoritative for room membership,
subscription and microphone publication. A listener-side UI change cannot elevate a
listener into a publisher.

## Lifecycle

1. Enter live Talk.
2. `POST /talks/:id/live/connect`.
3. Receive role/capabilities and a server-issued session id.
4. `POST /talks/:id/live/media-token`.
5. Join LiveKit room with auto-subscribe enabled.
6. Publish microphone only for an authorized Host.
7. Heartbeat every 10 seconds.
8. If Host presence is reconnecting, project that state and stop Host microphone media.
9. If Talk is ended, tear down media.
10. On route disposal, close LiveKit and best-effort `/live/disconnect`.

## Verification boundaries

Unit/widget coverage uses an in-memory media-room seam, so tests prove that listeners
cannot receive client-side publish authority and that Host/reconnect/end lifecycle behavior
is deterministic without requiring a physical microphone.

Final qualification still requires:
- the merged live backend deployed with `LIVEKIT_URL`, `LIVEKIT_API_KEY`,
  `LIVEKIT_API_SECRET`;
- a real LiveKit room connection from Android;
- two physical/logical clients confirming remote audio is audible;
- Host microphone mute/unmute;
- Host disconnect/reconnect grace;
- listener never receiving microphone publication rights.

The repository Mobile Build workflow currently has a known zero-step GitHub Actions failure
pattern on main; branch qualification must distinguish that infrastructure failure from an
actual Flutter analyze/test/build failure.

Status: mobile live-audio implementation complete against the merged backend contract; physical media
qualification and production LiveKit deployment remain integration work.
