# Workstream claim — device-capabilities

Status: active
Owner: this isolated stacked workstream
Started: 2026-10-04 20:28 Africa/Lagos
Base: work/device-registration-pairing-20261004 @ 81d3c006aeff83dbe9c53d32dee1b72b66e1e1d0
Production task: 105 — DeviceCapability publication/readiness/health

## Purpose

Implement canonical dynamically published DeviceCapability facts and Device health/last-seen readiness without inferring capabilities from app version, Device class or platform metadata.

## Exact owned paths

- `docs/workstreams/device-capabilities.md`
- `docs/DEVICE-CAPABILITIES.md`
- `packages/devices/src/capability-model.ts`
- `packages/devices/src/capability.ts`
- `packages/devices/src/capability.test.ts`
- `packages/devices/migrations/0002_device_capabilities.sql`
- `adapters/storage/postgres/src/devices/capabilities.ts`
- `tests/integration/device-capabilities.test.ts`

## Coordinated shared seams

- `packages/devices/src/index.ts` — append-only exports.
- `adapters/storage/postgres/src/devices/index.ts` — append-only export.

## Explicit non-ownership

This workstream does not modify Task 104 registration/pairing behavior, CharacterDeviceAssignment (106), Device operational credentials/reconnect control (107), Android/OmniSIP implementation, Provider selection, Tool definitions, root configs, manifests/lockfiles or canonical production task docs.

## Acceptance target

- stable bounded capability keys;
- capability publication only for active Devices;
- publication generation/revision semantics with exact replay;
- dynamic readiness state `ready|degraded|unavailable`;
- bounded readiness reason and observed-at timestamp;
- Device heartbeat/last-seen health facts;
- stale health/readiness calculation without inventing capability support;
- replacement publication can add/remove capabilities explicitly;
- stale publication generation rejected;
- cross-Tenant publication/read rejected;
- no capability inferred from Device class/platform/app version.

Task 105 remains open until focused checks/PostgreSQL acceptance execute and canonical task evidence advances.
