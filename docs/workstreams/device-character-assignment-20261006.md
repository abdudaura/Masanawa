# Character Device assignment and capability policy — Task 106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/device-character-assignment-20261006`
Base: PR #121 `work/device-capabilities-20261004` @ `316a43a922350c3c29759b4a492fd868b1e9bb1c`
PR: #236
Production task: 106 — CharacterDeviceAssignment and capability policy.

## Coordination

PR #120 owns Task 104 Device registration/pairing. PR #121 owns Task 105 capability publication/readiness/health and explicitly excludes/releases CharacterDeviceAssignment (Task 106). No active competing CharacterDeviceAssignment claim was found.

## Exact owned paths

- `docs/workstreams/device-character-assignment-20261006.md`
- `packages/devices/src/assignment-model.ts`
- `packages/devices/src/assignment.ts`
- `packages/devices/src/assignment.test.ts`

## Explicitly excluded/shared paths

- `packages/devices/src/index.ts` (PR #121 coordinated export seam)
- Device registration/pairing and capability files owned by #120/#121
- all Device/Postgres migrations/adapters
- Security/device credentials (Task 107)
- Gateway/Worker/Presence/Ops composition
- Android/OmniSIP adapter/runtime
- Tool/Provider selection
- production environment and shared manifests/lockfiles

## Completed implementation

- Added canonical Tenant + Character + Device assignment with primary/secondary/pooled roles.
- Added explicit bounded capability allowlist; assignment never infers authority from Device class/platform/app version.
- Added revision-bound active/suspended/revoked lifecycle; suspended may reactivate, revoked is terminal.
- Added validity windows with fail-closed not-yet-valid/expired behavior.
- Added capability authorization evaluation against the exact current active Device and Task-105 dynamic capability snapshot.
- Fail closed on Character/Tenant/Device scope mismatch, inactive assignment/Device, missing/stale/unavailable health, policy-disallowed degradation, ungranted/unpublished/unavailable/degraded capability.
- Device replacement is represented as a new assignment to the same Character, so replacing hardware never changes Character identity.
- Added focused tests for policy grant, no metadata inference, readiness/health gates, stale health, lifecycle custody, scope/validity and replacement semantics.

## Changed-file audit

PR #236 changes exactly the four owned paths above relative to PR #121. No #120/#121 source, export, migration or adapter path changed.

## Verification

- Source/type audit completed against Task-104 Device and Task-105 capability contracts on PR #121 plus strict TypeScript conventions.
- Foundation CI run `37454194719` on head `83de4e3576f16b60192679f174c1be34d95c1a2f` failed before checkout: job `112237659037`, `runner_id=0`, `steps=[]`. No code executed.
- Final branch head after this handoff update is the documentation commit produced here.

## Remaining dependencies

1. PR #121 export owner: export assignment model/functions through `@masanawa/devices` after reconciling its active package barrel.
2. Device persistence owner: durable assignment storage and revision-checked updates; migration numbering remains coordinated.
3. Task 107 Security owner: operational Device credential/revocation/reconnect must remain separate from assignment.
4. Provider/Gateway owner: use this evaluator before choosing/dispatching an assigned Device Provider; assignment is not itself Tool/Operation authority.
5. Executable CI/PostgreSQL acceptance when runner/persistence ownership is available.

State: ISOLATED COMPLETE / INTEGRATION READY.

Last update: 2026-10-06.
