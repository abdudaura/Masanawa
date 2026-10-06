# Renderer-neutral AvatarProvider workstream

Owner/window: current ChatGPT continuation window — Task 123
Branch: `work/avatar-provider-contract-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 123.
Architecture reference: `docs/migration/PRESENCE-ADOPTION-BOUNDARY.md`.
PR: #250
Implementation commit: `f5ff72a510ee1772584a1ff96f226325740572cc`

## Exact owned paths

- `services/presence/src/avatar-provider.ts`
- `tests/contracts/avatar-provider.test.ts`
- `docs/workstreams/avatar-provider-20261006.md`

## Excluded/shared paths

- Task 119 PresenceSession service-shell owned paths;
- LiveKit/WebRTC and realtime pipeline tasks 120–122;
- Identity Character/CharacterVersion/appearance-reference implementation;
- mobile renderer/UI code;
- Gateway, PR #136, migrations, package manifests, lockfile and production environment.

## Completed implementation

- renderer-neutral AvatarProvider descriptor/port with bounded provider readiness/capability evidence;
- exact Tenant/Character/CharacterVersion + appearance-reference presentation plan;
- deterministic preferred-renderer selection and stable provider-key ordering;
- media-type compatibility filtering before renderer selection;
- explicit audio-only fallback when no compatible renderer is ready;
- no arbitrary provider state becomes Character identity or durable business truth;
- appearance references must be current and non-expired;
- ephemeral presentation leases must match the exact selected provider, renderer, CharacterVersion and appearance reference;
- cross-scope/provider/reference substitution and already-expired leases fail closed.

## Changed-file audit

Compare against current `main` reports this branch 3 commits ahead, 0 behind, with exactly:
1. `docs/workstreams/avatar-provider-20261006.md`
2. `services/presence/src/avatar-provider.ts`
3. `tests/contracts/avatar-provider.test.ts`

No shared or foreign-owner files changed.

## Verification

Foundation CI run `37455799230` completed as `failure`, but its only job `112242969872` has `steps = null`. Checkout/install/typecheck/tests never executed. This is runner-allocation/non-execution evidence, not an application failure and not a test pass.

No executable local checkout is available in this connector-only window, so no fabricated local test result is claimed.

## Remaining dependencies

- Task 119 must supply the canonical PresenceSession service shell and session lifecycle;
- Tasks 120–122 supply realtime transport/media pipeline behavior;
- client renderer implementations and actual asset loading remain mobile/presentation-owner work;
- service/package activation and lockfile changes remain shared package/composition ownership;
- physical avatar/audio-only degradation must be verified on exact release/device hardware.

## Current state

**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
