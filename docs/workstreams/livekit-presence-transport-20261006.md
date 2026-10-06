# LiveKit Presence transport — Task 120

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/livekit-presence-transport-20261006`
Base: PR #248 `work/presence-character-session-bridge-20261006`
PR: #254
Production task: 120 — integrate LiveKit WebRTC transport.

## Coordination

Task 119 is owned by PR #248 and explicitly leaves LiveKit to Task 120. PR #136 owns shared Gateway/mobile/live-voice production composition. No competing Task 120 LiveKit claim was present at selection.

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

## Completed implementation

- Added canonical explicitly registered `media/livekit` adapter workspace.
- Pinned current `livekit-server-sdk` v2.19.1 in the adapter manifest.
- Exact canonical PresenceSessionId is the LiveKit room identity; adapter introduces no competing session/Character truth.
- Added short-lived join-token service with 30–600 second TTL bounds.
- Participant identity is generation-scoped (`user:gN` / `character:gN`) so downstream Presence can fence stale transport callbacks after reconnect.
- Token grants are room-join only with publish/subscribe; data publishing and participant metadata mutation are disabled. No room-admin/list/record/ingress grants are emitted.
- LiveKit server URL is required to be WSS and cannot contain embedded credentials/query/fragment.
- API secret is supplied only through injected Security-owned `CredentialSecret`; client join descriptors expose only server URL, room, participant identity and short-lived token.
- Added actual SDK token signer using async `AccessToken.toJwt()`.
- Added actual SDK webhook decoder using `WebhookReceiver.receive(rawBody, authorization)`.
- Webhook verification requires raw body + authorization before decoding and bounds the raw body to 1 MiB.
- Authenticated `participant_joined`, `participant_left`, `participant_connection_aborted` and `room_finished` events normalize into Presence transport evidence.
- Room identity is parsed back to canonical PresenceSessionId; participant identity is parsed back to role + connection generation.
- Unsupported LiveKit events return no Presence lifecycle decision rather than being treated as business/session success.
- Added focused token/grant/generation/endpoint/secret-redaction and webhook lifecycle tests.

## Current LiveKit evidence

Official LiveKit JS Server SDK documentation checked 2026-10-06:
- v2.19.1 current server SDK;
- async `AccessToken.toJwt()`;
- explicit VideoGrant room permissions;
- authenticated raw-body `WebhookReceiver.receive()`;
- participant lifecycle webhook events.

## Changed-file audit

PR #254 changes exactly the ten claimed paths above relative to PR #248. It is currently mergeable. No Presence-domain, Gateway/mobile, production-config, lockfile, STT/LLM/TTS, turn-policy or avatar file changed.

## Verification

- Source/type audit completed against repository adapter architecture and current LiveKit v2.19.1 API docs.
- Foundation CI run `37456475031` on implementation head `0cb7191bdc39b3b312c5b4280d6732073b0339eb` failed before checkout: job `112245217919`, `runner_id=0`, `steps=[]`. No repository code executed.
- Frozen-install/typecheck/test execution still needs the shared lockfile importer plus a working runner.

## Remaining dependencies

1. Workspace/lockfile owner: add the new `@masanawa/livekit-media` importer and `livekit-server-sdk@2.19.1` resolution without overwriting shared lock work.
2. Task 119/Presence owner: compose join-token issuance only after exact current PresenceSession/CharacterSession validation and apply generation fencing to normalized webhook events.
3. Security/production configuration owner: provide LiveKit API key/secret through credential custody; never mobile/app environment.
4. Shared Gateway/mobile owner (#136 or explicit successor): authenticated token endpoint + client room connection after Presence composition.
5. Task 121 owner: realtime inference/audio pipeline consumes LiveKit media without moving Presence identity or provider secrets.
6. Executable CI and real LiveKit deployment/media qualification remain required.

State: ISOLATED COMPLETE / INTEGRATION READY.

Last update: 2026-10-06.
