# PresenceSession and CharacterSession bridge — Task 119

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/presence-session-bridge-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
PR: #249
Production task: 119 — canonical PresenceSession and CharacterSession bridge.

## Coordination

No active Task 119 realtime-presence claim was found at selection. Existing presence work was architecture/forensics only. PR #136 owns shared Gateway/mobile production composition; this lane did not touch it.

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

## Completed implementation

- Replaced the empty Presence service placeholder with a canonical TypeScript service shell following the repository service template.
- Added provider-neutral `PresenceSession` bound to one exact active canonical `CharacterSession`.
- Admission copies exact Tenant/User/Character/Relationship/CharacterSession identity and returns a revision-bound CharacterSession binding plan rather than mutating Agents state from Presence.
- Admission fails if the CharacterSession is expired/closed or already bound to another PresenceSession.
- Added `audio|audio-video` mode without embedding LiveKit/provider assumptions.
- Added `admitted -> active -> closed` lifecycle with monotonic Presence revision.
- Added stable PresenceSession identity across reconnect and monotonic `connectionGeneration` fencing so stale transport callbacks can be rejected later.
- Added exact bridge validation preventing a PresenceSession from moving to another User/Character/Relationship/CharacterSession scope.
- Closed sessions are terminal and cannot reconnect.
- Added health/readiness endpoints and managed service drain/start lifecycle using canonical telemetry + node runtime foundations.
- Added focused session and service-shell tests.

## Changed-file audit

PR #249 changes exactly the nine owned paths above. No Agents, Contracts, Gateway, mobile, LiveKit/provider, migration, production config or lockfile path changed.

## Verification

- Source/type audit completed against current `@masanawa/agents` CharacterSession and service implementation-template contracts.
- Foundation CI run `37455646610` on head `83c36c4b237515b1a4263a87bf195bcb029aea8d` failed before checkout: job `112242465136`, `runner_id=0`, `steps=[]`. No repository code executed.
- Final branch head after this handoff update is the documentation commit produced here.

## Remaining dependencies

1. Workspace/lockfile integration owner: reconcile the new canonical Presence service importer before frozen-install/build qualification.
2. Agents owner: apply the returned CharacterSession presence-binding plan using canonical CharacterSession revision custody.
3. Persistence owner: durable PresenceSession storage/reload and reconnect generation CAS.
4. Task 120 transport owner: map LiveKit transport/session callbacks to this PresenceSession identity and generation fencing.
5. Shared Gateway/mobile owner: admission routing and authenticated client token flow only after Task 120+ composition.
6. Executable CI and production deployment qualification when hosted runners recover.

State: ISOLATED COMPLETE / INTEGRATION READY.

Last update: 2026-10-06.
