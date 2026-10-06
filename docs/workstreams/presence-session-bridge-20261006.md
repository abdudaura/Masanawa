# PresenceSession and CharacterSession bridge — Task 119

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/presence-session-bridge-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 119 — canonical PresenceSession and CharacterSession bridge.

## Coordination

No active Task 119 realtime-presence claim was found. Existing presence work is architecture/forensics only. PR #136 owns shared Gateway/mobile production composition; this lane does not touch it.

## Exact owned paths

- `docs/workstreams/presence-session-bridge-20261006.md`
- `services/presence/package.json`
- `services/presence/tsconfig.json`
- `services/presence/tsconfig.build.json`
- `services/presence/src/session.ts`
- `services/presence/src/session.test.ts`
- `services/presence/src/app.ts`
- `services/presence/src/app.test.ts`
- `services/presence/src/main.ts`

## Explicitly excluded/shared paths

- `packages/agents/**`
- `packages/contracts/**`
- Gateway/mobile/live-voice code and PR #136 paths
- LiveKit/transport provider implementation (Task 120)
- STT/LLM/TTS provider seams (Task 121)
- turn detection/interruption (Task 122)
- avatar rendering (Task 123)
- persistence migrations/adapters
- production environment/lockfile/shared deployment manifests

## Acceptance target

- provider-neutral canonical PresenceSession bound to one exact active CharacterSession;
- exact Tenant/User/Character/Relationship identity match;
- mode `audio|audio-video`;
- lifecycle `admitted -> active -> closed` with monotonic revision;
- one PresenceSession cannot silently move across CharacterSession or identity scope;
- CharacterSession expiry/closure blocks admission;
- optional pre-existing CharacterSession presence binding must be null or this exact PresenceSession;
- reconnect can reuse the same active PresenceSession identity, never create authority;
- close is terminal;
- service shell follows canonical implementation template;
- no transport/vendor assumptions.

State: CLAIMED. No implementation changes beyond this claim.

Last update: 2026-10-06.
