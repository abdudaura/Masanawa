# Renderer-neutral AvatarProvider workstream

Owner/window: current ChatGPT continuation window — Task 123
Branch: `work/avatar-provider-contract-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 123.
Architecture reference: `docs/migration/PRESENCE-ADOPTION-BOUNDARY.md`.

## Exact owned paths

- `services/presence/src/avatar-provider.ts` (new)
- `tests/contracts/avatar-provider.test.ts` (new)
- `docs/workstreams/avatar-provider-20261006.md`

## Excluded/shared paths

- Task 119 PresenceSession service-shell owned paths;
- LiveKit/WebRTC and realtime pipeline tasks 120–122;
- Identity Character/CharacterVersion/appearance-reference implementation;
- mobile renderer/UI code;
- Gateway, PR #136, migrations, package manifests, lockfile and production environment.

## Implementation boundary

- renderer-neutral AvatarProvider capability/readiness contract;
- exact Character/CharacterVersion + appearance-reference binding;
- renderer kinds remain presentation choices, never Character identity;
- provider output is an ephemeral presentation lease, never durable business truth;
- fail closed on scope/version/reference mismatch or unready renderer;
- explicit audio-only fallback when no compatible renderer is ready;
- no LiveKit/AIRI/vendor-specific authority or persistence.

## Current state

CLAIMED. Implement Task 123 as a Presence-owned presentation boundary only.
