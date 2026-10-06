# LiveKit Presence transport — Task 120

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/livekit-presence-transport-20261006`
Base: PR #248 `work/presence-character-session-bridge-20261006` @ `a818eb034c768c0b18604a652c68b28d881cd813`
Production task: 120 — integrate LiveKit WebRTC transport.

## Coordination

Task 119 is owned by PR #248 and explicitly leaves LiveKit to Task 120. PR #136 owns shared Gateway/mobile/live-voice production composition. No competing Task 120 LiveKit claim was found at selection.

## Exact owned paths

- `docs/workstreams/livekit-presence-transport-20261006.md`
- `adapters/media/livekit/adapter.json`
- `adapters/media/livekit/package.json`
- `adapters/media/livekit/tsconfig.json`
- `adapters/media/livekit/tsconfig.build.json`
- `adapters/media/livekit/src/index.ts`
- `adapters/media/livekit/src/token.ts`
- `adapters/media/livekit/src/token.test.ts`
- `adapters/media/livekit/src/webhook.ts`
- `adapters/media/livekit/src/webhook.test.ts`

## Explicitly excluded/shared paths

- PR #248 PresenceSession/bridge files
- Gateway/mobile/live voice and PR #136 paths
- root lockfile/workspace manifests
- production environment/deployment secrets
- STT/LLM/TTS (Task 121)
- turn detection/interruption (Task 122)
- avatar renderer (Task 123)
- persistence/migrations

## Current LiveKit contract

Verified against official LiveKit JS Server SDK v2.19.1 on 2026-10-06:
- backend token minting uses `AccessToken` and async `toJwt()`;
- room join permissions are explicit VideoGrant fields;
- webhook verification uses `WebhookReceiver.receive(rawBody, authorization)`;
- API secrets stay server-side.

## Acceptance target

- exact PresenceSessionId becomes the room identity; LiveKit never becomes CharacterSession truth;
- short-lived participant join tokens only, no room-admin/list/record/ingress privileges;
- no participant metadata mutation or data publishing by default;
- API secret comes from injected Security-owned credential source, never output/logged;
- connection-generation-scoped participant identities support stale transport fencing;
- authenticated raw-body webhook normalization for participant joined/left/connection-aborted and room-finished events;
- webhook room/participant identity is parsed back to PresenceSession + generation/role evidence;
- unsupported LiveKit events are ignored as transport evidence, never domain success;
- adapter follows canonical media adapter topology and explicit registration.

State: CLAIMED. No implementation changes beyond this claim.

Last update: 2026-10-06.
