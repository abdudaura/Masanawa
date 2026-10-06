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
- Dependencies: Lane G exact head PR #214. Durable Group Room storage and group-memory scope still require separately coordinated persistence/migration ownership.

## Handoff

State: **INTEGRATION READY**.

Completed:
- exported the canonical Lane G Group Room contracts/repository through the `@masanawa/identity` package root;
- added a regression test that consumes the contract only through the package root and verifies group-only memory/privacy flags;
- preserved all shared Gateway/mobile/Commerce/Event/migration boundaries.

Changed-file audit:
- `docs/workstreams/group-room-identity-export-20261006.md`
- `packages/identity/src/group-room-export.test.ts`
- `packages/identity/src/index.ts`

Verification:
- branch diff against Lane G exact head contains only the three owned paths above;
- GitHub reported no workflow runs or combined status checks for implementation head `a2828a85f680079a78deaaa2e9797ff75c1b2fee` when inspected; no CI pass is claimed.

PR: #217, stacked on #214.

Remaining dependencies:
- durable Group Room repository storage requires canonical persistence plus coordinated migration ownership;
- a true group-memory scope requires Memory/persistence schema work and must not be emulated with private Relationship memory;
- Gateway/router/chat/transport/APK composition remains #136-owned.

**No further isolated implementation remains in this workstream.**
