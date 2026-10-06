# Character Device assignment and capability policy — Task 106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/device-character-assignment-20261006`
Base: PR #121 `work/device-capabilities-20261004` @ `316a43a922350c3c29759b4a492fd868b1e9bb1c`
Production task: 106 — CharacterDeviceAssignment and capability policy.

## Coordination

PR #120 owns Task 104 Device registration/pairing. PR #121 owns Task 105 capability publication/readiness/health and explicitly excludes/releases CharacterDeviceAssignment (Task 106). No active PR/claim for CharacterDeviceAssignment was found.

## Exact owned paths

- `docs/workstreams/device-character-assignment-20261006.md`
- `packages/devices/src/assignment-model.ts`
- `packages/devices/src/assignment.ts`
- `packages/devices/src/assignment.test.ts`

## Explicitly excluded/shared paths

- `packages/devices/src/index.ts` (PR #121 coordinated export seam)
- Device registration/pairing and capability files owned by #120/#121
- all Device/Postgres migrations/adapters
- Security/device credentials (Task 107)
- Gateway/Worker/Presence/Ops composition
- Android/OmniSIP adapter/runtime
- Tool/Provider selection
- production environment and shared manifests/lockfiles

## Acceptance target

- canonical Tenant + Character + Device assignment;
- role `primary|secondary|pooled`;
- bounded explicit capability policy, never inferred from Device class/app version;
- revision-bound suspend/reactivate/revoke lifecycle with terminal revocation;
- validity window;
- authorization evaluation against current active Device + dynamic capability snapshot;
- fail closed on tenant/device mismatch, stale health, missing/unready capability, policy denial, inactive Device/assignment or expired/not-yet-valid assignment;
- Device replacement never changes Character identity.

State: CLAIMED. No implementation changes beyond this claim.

Last update: 2026-10-06.
