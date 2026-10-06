# Device operational credential and reconnect control — Task 107

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/device-operational-credentials-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 107 — Device credential generation/revocation and reconnect control plane.

## Coordination

Tasks 104/105 are active in PR #120/#121. Task 106 is isolated in PR #236. All of those explicitly leave operational Device credentials to Task 107. This slice reuses canonical Security authentication + device Principal semantics and canonical `DeviceCredentialId`; it does not create another auth system.

## Exact owned paths

- `docs/workstreams/device-operational-credentials-20261006.md`
- `packages/security/src/device-credential.ts`
- `packages/security/src/device-credential.test.ts`

## Explicitly excluded/shared paths

- `packages/security/src/index.ts`
- existing generic credential/service-auth files
- `packages/devices/**`
- Device/Postgres migrations/adapters
- Gateway/Presence/Worker/Ops composition
- Android/OmniSIP/local vault
- production env/manifests/lockfiles

## Acceptance target

- high-entropy one-time Device secret;
- persist only SHA-256 verifier, never plaintext;
- canonical Tenant + Device + DeviceCredential identity;
- monotonic credential generation;
- active/revoked lifecycle and bounded optional expiry;
- timing-safe secret verification;
- stale generation, revoked/expired credential, tenant/device mismatch fail closed;
- successful reconnect yields canonical `device` Principal plus current `device-key` authentication evidence;
- rotation revokes old generation before replacement becomes current;
- no Device credential grants Character/Tool/Operation authority by itself.

State: IMPLEMENTING. Device operational credential issuance/rotation/revocation/reconnect verification and focused tests are committed. Persistence/export/Gateway/Android composition remain excluded shared seams.

Implementation head before handoff: `1296d259240476030f5717ca39739c71494fdcc2`.

Last update: 2026-10-06.
