# Group Room Identity Export Workstream

- Owner/window: ChatGPT continuation window — Group Room identity export
- Branch: `work/group-room-identity-export-20261006`
- Base SHA: `0a5b7722eacc920c135d951b7acd47ff5ef0938c`
- Task/lane references: Home/Rooms Lane G; `docs/HOME-ROOMS-STATUS.md` remaining Identity export dependency; `docs/HOME-ROOMS-INTEGRATION-QUEUE.md` Group Rooms composition prerequisite.
- Exact owned paths:
  - `packages/identity/src/index.ts`
  - `packages/identity/src/group-room-export.test.ts`
  - `docs/workstreams/group-room-identity-export-20261006.md`
- Excluded/shared paths:
  - all `services/gateway/**`, `apps/mobile/lib/src/router/**`, chat/transport/APK paths owned by PR #136;
  - all migrations and production environment files;
  - Commerce/Event files;
  - existing Lane G contract/UI files except read-only dependency on `packages/identity/src/group-room.ts`.
- Dependencies: Lane G exact head PR #214; durable Group Room storage and group-memory scope require separately coordinated persistence/migration ownership.
- Current state: CLAIMED — exporting the completed Group Room Identity contract through the canonical package surface and adding regression coverage.
- Last update: 2026-10-06.
