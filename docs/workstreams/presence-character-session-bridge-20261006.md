# PresenceSession / CharacterSession bridge — Task 119

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/presence-character-session-bridge-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Implementation head: `a818eb034c768c0b18604a652c68b28d881cd813`
PR: #248

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **119** Implement canonical PresenceSession and CharacterSession bridge.
- `docs/DOMAIN-MODEL.md` — PresenceSession is ephemeral/live and references CharacterSession without owning durable business truth.
- `packages/agents/src/session.ts` already exposes nullable `bindings.presenceSessionId`.

## Owned paths
- `services/presence/src/presence-session.ts`
- `services/presence/src/character-session-bridge.ts`
- `services/presence/src/index.ts`
- `tests/contracts/presence-character-session-bridge.test.ts`
- `docs/workstreams/presence-character-session-bridge-20261006.md`

## Completed implementation
- Added schema-versioned ephemeral PresenceSession lifecycle: connecting, active, ended and failed.
- Presence binds exact Tenant/User/Relationship/Character/CharacterSession identity while carrying only an opaque transport-session reference.
- Lifecycle timestamps and terminal evidence are normalized and fail closed; terminal sessions cannot transition again.
- Added strict CharacterSession bridge validation requiring an active exact-scope CharacterSession.
- Existing CharacterSession Presence binding cannot be overwritten by a different PresenceSession.
- Added a minimal binding-patch helper rather than writing CharacterSession state from Presence.
- Root contract tests cover scope isolation, conflicting bindings, closed sessions, lifecycle revisions and failure evidence.
- Presence carries no Workflow/Ledger/Memory state and therefore does not become durable business truth.

## Changed-file audit
Exactly five files:
1. `docs/workstreams/presence-character-session-bridge-20261006.md`
2. `services/presence/src/character-session-bridge.ts`
3. `services/presence/src/index.ts`
4. `services/presence/src/presence-session.ts`
5. `tests/contracts/presence-character-session-bridge.test.ts`

No LiveKit, Gateway, Agents package/repository, migrations, package manifests/lockfile or production configuration changed.

## Verification
Foundation CI run `37455704210`, job `112242661053` ended `failure` with `steps = null`; checkout/install/typecheck/tests never executed. This is not recorded as a pass and is not application-failure evidence.

## Remaining dependencies
- Task 120 transport owner binds LiveKit/WebRTC transport to the opaque Presence transport reference.
- CharacterSession/shared integration owner persists the binding using existing canonical Agents state.
- Presence hosting/persistence and Gateway composition remain shared integration work.
- Production/realtime acceptance must prove reconnect, transport replacement and session teardown on the exact deployed runtime.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
