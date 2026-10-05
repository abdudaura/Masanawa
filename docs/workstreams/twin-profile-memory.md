# Twin profile and representational memory — Lane A

Owner/window label: ChatGPT Lane A / 2026-10-05
Branch: `work/twin-profile-memory-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: TWIN-010, TWIN-011, TWIN-012, TWIN-013, TWIN-014.
TWIN-015 is owned by the active My Twin/onboarding surfaces (#145/#123) and is an explicit integration dependency rather than overlapping those files.

## Exact owned paths

- `docs/workstreams/twin-profile-memory.md`
- `packages/identity/src/twin-profile.ts`
- `packages/identity/src/twin-profile.test.ts`
- `packages/memory/src/representation.ts`
- `packages/memory/src/representation.test.ts`
- `services/gateway/src/twin_profile.ts`
- `services/gateway/src/twin_profile_routes.ts`
- `services/gateway/src/twin_profile.test.ts`

No package root exports, existing Identity/Postgres repositories, migrations, Gateway app/main,
mobile router/chat, My Twin/onboarding files, Commerce, billing or crypto files are owned.

## Dependencies

- Shared integration must export/compose these additive contracts after current owners reconcile.
- Durable profile persistence/migration must be integrated only when Identity migration numbering is explicitly transferred.
- Active My Twin/onboarding owner consumes the resulting profile/customization contract for TWIN-015.
- Existing governed Memory publication remains canonical for private -> shared publication; this lane only defines the public-representation admission policy and cannot bypass approval.

## Current step

Claim published before implementation. Implementing bounded public profile/share identity,
representational-memory admission, low-risk conversational customization and explicit confirmation
requirements for consequential changes.

Last update: 2026-10-05.

Implementation: in progress.
Verification: pending.
Deployment: not claimed.
