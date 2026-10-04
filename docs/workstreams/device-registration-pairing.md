# Workstream claim — device-registration-pairing

Status: implementation complete; shared integration/PostgreSQL verification pending
Owner: this isolated workstream
Started: 2026-10-04 20:28 Africa/Lagos
Base: main @ 3906419669203844018b6687ad06ab2af48654eb
Production task: 104 — Device registration and secure pairing

## Purpose

Implement canonical Device identity/registration and one-time secure pairing without taking ownership of DeviceCapability publication (105), CharacterDeviceAssignment (106), operational Device credentials/reconnect control (107), Android runtime implementation, OmniSIP, Provider selection or DeviceOperation execution.

## Exact owned paths

- `docs/workstreams/device-registration-pairing.md`
- `docs/DEVICE-REGISTRATION-PAIRING.md`
- `packages/devices/package.json`
- `packages/devices/tsconfig.json`
- `packages/devices/tsconfig.build.json`
- `packages/devices/src/device-model.ts`
- `packages/devices/src/pairing.ts`
- `packages/devices/src/pairing.test.ts`
- `packages/devices/src/index.ts`
- `packages/devices/migrations/0001_device_pairing.sql`
- `adapters/storage/postgres/src/devices/registration.ts`
- `adapters/storage/postgres/src/devices/index.ts`
- `tests/integration/device-registration-pairing.test.ts`

## Coordinated shared seam

- `adapters/storage/postgres/src/index.ts` — append-only export of the devices adapter namespace.

## Explicit non-ownership

This workstream does not modify:
- `packages/contracts/**`;
- Security approval/credential core;
- `packages/providers/**`;
- `packages/tools/**`;
- Android/mobile implementation;
- DeviceCapability or CharacterDeviceAssignment;
- Device operational credential generation/revocation;
- root configs, lockfiles or package manifests outside `packages/devices/package.json`;
- canonical production task docs;
- any active workstream-owned file other than the explicit PostgreSQL barrel seam.

## Acceptance target

- tenant-scoped canonical Device registration;
- immutable device enrollment fingerprint and bounded platform metadata;
- one active high-entropy pairing challenge per unpaired Device;
- only challenge hashes persisted, never raw pairing secrets;
- bounded expiry and one-time consumption;
- constant-time secret verification;
- exact replay/idempotent completion after a lost response;
- expired/wrong/reused challenge rejection;
- pairing activates the Device but does not issue an operational Device credential;
- cross-Tenant pairing rejection;
- no capability/Character assignment inferred from successful pairing.

Task 104 remains open until focused checks/PostgreSQL acceptance execute and canonical task evidence advances.


## Implementation handoff

Implemented in draft PR #120.

Delivered:

- canonical tenant-scoped Device registration;
- server-generated DeviceId;
- enrollment replay fingerprint/conflict protection;
- bounded immutable Device metadata/lifecycle contracts;
- high-entropy one-time pairing secrets;
- hash-only durable secret custody;
- constant-time secret verification;
- one active challenge per unpaired Device;
- 1-15 minute challenge lifetime;
- durable five-attempt invalid-secret lockout;
- atomic challenge consume + Device activation;
- exact completion replay after response loss;
- cross-Tenant not-found behavior;
- focused unit and PostgreSQL acceptance coverage.

Task 105-107 remain explicitly excluded.

Shared integration dependency: the new `packages/devices/package.json`
workspace importer must be added to `pnpm-lock.yaml` by the lockfile owner.
This branch intentionally does not edit the shared lockfile.
