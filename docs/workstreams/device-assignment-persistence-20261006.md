# Character Device assignment persistence — Task 106 continuation — 2026-10-06

Status: active reclaimed persistence slice
Owner/window: ChatGPT continuation window
Branch: `work/device-assignment-persistence-20261006`
Base: stale PR #236 head `d502fde825328f80c3e82fe3915e2183e6c04839`

PR #236 completed the Task 106 domain policy and explicitly left durable assignment
storage/revision updates unfinished. This branch implements that exact gap.

## Exact owned paths

- `packages/devices/migrations/0003_character_device_assignments.sql` (new)
- `adapters/storage/postgres/src/devices/assignments.ts` (new)
- `adapters/storage/postgres/src/devices/index.ts` (append-only export)
- `tests/integration/device-assignments.test.ts` (new)
- `docs/workstreams/device-assignment-persistence-20261006.md`

## Boundaries

- no edits to Task 104/105 migrations;
- no Task 107 Security credential files;
- no Gateway/Provider/Android/mobile/production paths;
- no shared lockfile/package dependency changes;
- no Character identity duplication: assignment stores canonical CharacterId reference only.

## Persistence rules

- assignment scope is immutable Tenant + Character + Device;
- role, capability policy and validity window are immutable for one assignment record;
- creation requires an active Device and canonical initial active/revision-1 shape;
- active <-> suspended and active/suspended -> revoked follow domain lifecycle;
- revoked is terminal;
- updates use compare-and-set revision;
- exact create/update replay returns the existing record;
- changed replay/stale revision fails closed;
- cross-Tenant read/update fails closed;
- replacement Device is a new assignment record, preserving Character identity.
