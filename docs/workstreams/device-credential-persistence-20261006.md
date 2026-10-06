# Device operational credential persistence — Task 107 continuation — 2026-10-06

Status: active reclaimed persistence slice
Owner/window: ChatGPT continuation window
Branch: `work/device-credential-persistence-20261006`
Base: stale PR #241 head `e2a8dd3f6ad612399ae6eeb8833e2e91985ab0c9`

PR #241 completed Task 107 credential/reconnect domain rules and explicitly left Security
export + PostgreSQL persistence unfinished. This branch implements those gaps.

## Migration coordination

- Device 0001: registration/pairing (#120)
- Device 0002: capabilities (#121)
- Device 0003: Character assignment (active PR #319)
- **Device 0004: operational credentials/reconnect (this branch)**

This branch predates #319 in ancestry, so 0003 is intentionally absent here but reserved;
do not renumber 0004.

## Exact owned paths
- `packages/devices/migrations/0004_device_operational_credentials.sql` (new)
- `packages/security/src/index.ts` (append-only device-credential export)
- `adapters/storage/postgres/src/security/device-credentials.ts` (new)
- `adapters/storage/postgres/src/security/index.ts` (append-only export)
- `tests/integration/device-credentials.test.ts` (new)
- `docs/workstreams/device-credential-persistence-20261006.md`

## Boundaries
- no private signing keys or proof material persisted;
- only opaque verification-key reference + fingerprint are stored;
- no edits to Security credential core, Gateway/Presence/Android/mobile/production;
- no shared lockfile/package dependencies;
- no Task 104-106 migration edits.

## Acceptance
- one current active credential generation per Tenant+Device;
- exact create/revoke/rotation replay; changed replay fails closed;
- rotation atomically revokes current generation and inserts generation+1;
- revoked credential is terminal;
- reconnect challenge bound to exact current active credential generation;
- exact challenge replay;
- pending -> consumed/expired revision CAS, terminal afterward;
- challenge cannot outlive credential;
- cross-Tenant/cross-Device substitution fails closed;
- durable state contains no private key or reconnect proof.
