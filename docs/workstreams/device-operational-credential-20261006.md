# Device operational credential and reconnect — Task 107

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/device-operational-credential-20261006`
Base: Task 106 PR #236 @ `d502fde825328f80c3e82fe3915e2183e6c04839`
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

## Design boundary

This extends the existing canonical Security system: a Device credential is an operational authentication credential, not Device identity, Character assignment, Tool authority or a new secret store. The platform stores an opaque verification-key reference + fingerprint; private key generation/custody stays at the Device/keystore edge. Reconnect uses a one-time bounded challenge and an injected cryptographic verifier, then emits existing canonical strong `device-key` AuthenticationEvidence.

## Acceptance target

- Tenant + Device + canonical DeviceCredentialId + monotonic generation;
- active/revoked lifecycle with revocation terminal;
- validity/expiry and current-generation checks;
- rotation produces a new generation while retiring the old credential;
- one-time reconnect challenge bound to exact Device/credential/generation;
- challenge expiry/consumption/replay protection;
- verification via injected key verifier without importing Android/crypto-provider implementation;
- successful reconnect returns canonical strong Device authentication evidence only;
- no Character/Tool/Operation authority is implied.

State: IMPLEMENTING. Operational Device credential lifecycle, rotation, one-time reconnect challenge and proof-verification contract are committed with focused tests. Persistence/export/Gateway/device-keystore composition remain excluded shared seams.

Implementation head before handoff: `a56990246712247b898417aa4a0045a0f8b39c40`.

Last update: 2026-10-06.
