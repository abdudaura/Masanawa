# Device operational credential and reconnect control — Task 107

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/device-operational-credentials-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
PR: #243
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

## Completed implementation

- Generates a cryptographically random one-time Device secret (minimum 32 bytes).
- Persists only a SHA-256 verifier in the canonical Device credential record; plaintext stays inside the existing redacted `CredentialSecret` wrapper.
- Binds each credential to canonical Tenant + DeviceCredential + Device identity and a positive monotonic generation.
- Supports bounded optional expiry and active/revoked lifecycle.
- Rotation returns an atomic persistence plan: previous generation revoked, replacement generation incremented, replacement secret issued once.
- Reconnect verification uses constant-length SHA-256 digests and `timingSafeEqual`.
- Fails closed for wrong Tenant/Device scope, wrong secret, stale generation, revocation and expiry.
- Successful reconnect returns only the canonical `device` Principal plus current `device-key` AuthenticationEvidence; it does not contain Character or Operation authority.
- Added focused tests for hash-only persistence/redaction, successful reconnect, all failure modes, rotation and stale lifecycle requests.

## Changed-file audit

PR #243 changes exactly the three owned paths above. No Device package, Gateway, migration, adapter, Android, production-config or shared Security file changed.

## Verification

- Source/type audit completed against current Security credential/authentication/principal contracts and strict TypeScript settings.
- Foundation CI run `37454973642` on head `fc0eff08a145e62a2cc1ebee31b3850a6b6635a8` failed before checkout: job `112240239040`, `runner_id=0`, `steps=[]`. No repository code executed.
- Final branch head after this handoff update is the documentation commit produced here.

## Remaining dependencies

1. Security export owner: append-only root export when `packages/security/src/index.ts` ownership is available.
2. Device/Security persistence owner: durable current-generation credential storage with atomic revoke+replace and no plaintext secret column.
3. Gateway/Presence owner: reconnect admission must resolve only the current credential generation and then separately evaluate CharacterDeviceAssignment/current authority.
4. Android Device runtime owner: store the issued secret in the local encrypted vault and never logs/model context; rotation must replace it atomically.
5. Executable CI/PostgreSQL acceptance when runner/persistence ownership is available.

State: ISOLATED COMPLETE / INTEGRATION READY.

Last update: 2026-10-06.
