# Masanawa Talk AI Presence Runtime

This service is the server-side LiveKit participant for paid Expert/Twin Seats.

It is explicitly dispatched by the Gateway after canonical Seat admission. The dispatch
metadata contains only tenant/Talk/Seat/persona IDs and the persona kind. On every human
turn the runtime re-reads PostgreSQL and refuses generation unless:

- the AI Seat is still active and unmuted;
- the Talk live runtime is still live;
- a recently connected human Host still exists;
- the commercial AI Seat authorization is still admitted.

Twin owner direction is read fresh for each turn, is applied only to that response, and
is never added permanently to public conversation context.

## Required environment

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- Gemini credentials: `GOOGLE_API_KEY`, `MASANAWA_GEMINI_API_KEY`, or the existing `MASANAWA_GEMINI_CREDENTIALS_JSON` pool
- `DATABASE_URL` (or `MASANAWA_DATABASE_URL`)
- `LIVEKIT_AGENT_NAME=masanawa-talk-ai`

Optional:
- `MASANAWA_TALK_GEMINI_LIVE_MODEL`
- `MASANAWA_TALK_GWANI_VOICE`
- `MASANAWA_TALK_GWANA_VOICE`
- `MASANAWA_TALK_DEFAULT_AI_VOICE`

The runtime follows the current active Host/Speaker in the room while retaining one
Gemini Live session for the Seat, so context survives normal speaker changes.

When a credential pool is provided, each AI Seat deterministically selects one key by Seat ID so concurrent Seats are distributed across the configured pool without exposing keys in dispatch metadata.
