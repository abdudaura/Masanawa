# Plugin trust/permissions/versioning/uninstall — Task 140

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/plugin-trust-permissions-20261006`
Base SHA: `bf408aff1ca9adedd947023c2297a7c744284c96` (Task 139 exact head / PR #267)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **140** Implement plugin trust/permissions/versioning/uninstall behavior.
- Depends on Task 139 manifest/component/lifecycle model.

## Owned paths
- `packages/plugins/src/security.ts` (new)
- `tests/contracts/plugin-trust-permissions.test.ts` (new)
- `docs/workstreams/plugin-trust-permissions-20261006.md`

## Excluded/shared paths
- No plugin loader execution, credential storage, domain repositories, security package authority model, package manifests/lockfile, migrations, MCP/A2A bridge or production config.
- No requested capability becomes authority without an explicit grant.

## Current state
CLAIMED. Implement trust-classification inputs, explicit capability-grant intersection, grant expiry/version binding, fail-closed update policy, and uninstall revocation plan that disables registrations before removal.