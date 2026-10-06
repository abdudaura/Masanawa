# Device operational credential and reconnect — Task 107

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/device-operational-credential-20261006`
Base: Task 106 PR #236 @ `d502fde825328f80c3e82fe3915e2183e6c04839`
PR: #241
Production task: 107 — Device credential generation/revocation and reconnect control plane.

## Coordination

Tasks 104/105 are owned by PR #120/#121. Task 106 is isolated-complete in PR #236. Those workstreams explicitly exclude Task 107. No competing DeviceCredential/reconnect claim was found.

## Exact owned paths

- `docs/workstreams/device-operational-credential-20261006.md`
- `packages/security/src/device-credential.ts`
- `packages/security/src/device-credential.test.ts`

## Explicitly excluded/shared paths

- `packages/security/src/index.ts`
- existing Security authentication/authority/credential files
- Device package files, exports, migrations and adapters
- all Postgres migrations/adapters
- Gateway/Presence/Worker/Ops composition
- Android/OmniSIP implementation/keystore
- production environment, manifests and lockfiles

## Completed implementation

- Added canonical Tenant + Device + DeviceCredentialId operational credential with monotonic generation, revision, issuance/expiry and active/revoked state.
- Platform state carries only an opaque verification-key reference and bounded key fingerprint; private key generation/material remains outside the domain at the Device keystore edge.
- Revocation is terminal state for authentication and uses revision custody.
- Rotation revokes the current credential and creates a replacement for the same Device at generation + 1; credential ID/fingerprint reuse is rejected.
- Added one-time reconnect challenge bound to exact Tenant, Device, DeviceCredentialId, credential generation and RequestId.
- Challenge lifetime cannot outlive the credential; pending challenges can expire with revision custody; consumed challenges cannot authenticate again.
- Reconnect requires a current active credential generation and an injected cryptographic verifier over the exact credential/challenge binding.
- Successful reconnect emits the existing canonical strong `device-key` AuthenticationEvidence; it contains no Character, Tool or Operation authority.
- Revoked/stale-generation credentials, scope substitution, expired challenges, invalid proof and consumed challenge replay fail closed before authentication.
- Added focused tests for creation, rotation, revocation, challenge binding/expiry, valid authentication, stale/revoked credentials, scope substitution, invalid proof and replay.

## Changed-file audit

PR #241 changes exactly the three owned paths above relative to Task 106 PR #236. No Security barrel/existing auth file, Device source, migration/adapter, Gateway, Presence, Worker, Ops, Android/OmniSIP or production config changed.

## Verification

- Source/type audit completed against current strict TypeScript settings, canonical DeviceCredentialId/DeviceId/RequestId/TenantId contracts, and the existing Security `device-key` AuthenticationEvidence contract.
- Foundation CI run `37454758567` on implementation/handoff head `f4d7e7a7cfc40fe1228d4d04a0eec6916dcd3c7a` remains queued with job `112239527386`, no runner allocated and `steps=[]` at handoff inspection. No repository code has executed; no pass/fail is claimed.
- Final branch head after this handoff update is the documentation commit produced here.

## Remaining dependencies

1. Security export owner: append-only export through `@masanawa/security` when `packages/security/src/index.ts` ownership is available.
2. Security/Postgres persistence owner: durable credential generation/revocation and challenge revision/one-time-consumption state with transactional current-generation enforcement.
3. Android Device owner: generate/protect private key material in device keystore and implement the concrete proof signer; never upload the private key.
4. Gateway/Presence control-plane owner: issue challenge material, verify through the exported Security contract, mint the normal bounded Device session/control-plane authority, and recheck Device/assignment/capability policy separately.
5. Task 108 acceptance must prove revoked/replaced Devices cannot reconnect or execute and that channel continuity remains bound to canonical User/Relationship state.
6. Executable CI/PostgreSQL/device acceptance remains required.

State: ISOLATED COMPLETE / INTEGRATION READY.

Last update: 2026-10-06.
