# PresenceSession / CharacterSession bridge — Task 119

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/presence-character-session-bridge-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **119** Implement canonical PresenceSession and CharacterSession bridge.
- `docs/DOMAIN-MODEL.md` — PresenceSession is ephemeral/live and references CharacterSession without owning durable business truth.
- `packages/agents/src/session.ts` already exposes nullable `bindings.presenceSessionId`.

## Owned paths
- `services/presence/src/presence-session.ts` (new)
- `services/presence/src/character-session-bridge.ts` (new)
- `services/presence/src/index.ts` (new)
- `tests/contracts/presence-character-session-bridge.test.ts` (new)
- `docs/workstreams/presence-character-session-bridge-20261006.md`

## Excluded/shared paths
- No LiveKit transport, Gateway, CharacterSession repository, Agents package, migrations, package manifests/lockfile or production config.
- No duplicate Relationship/Character/Task/Workflow business state in Presence.

## Dependencies
- Canonical CharacterSession remains owned by `packages/agents`.
- Task 120 transport owner later binds LiveKit room/session references behind PresenceSession.
- Shared integration owner later persists/hosts Presence lifecycle.

## Current state
CLAIMED. Implement normalized ephemeral PresenceSession lifecycle plus strict scope/identity bridge to CharacterSession and binding-patch helper that cannot overwrite a conflicting Presence binding.