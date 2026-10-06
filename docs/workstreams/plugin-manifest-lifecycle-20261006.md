# Plugin manifest/component/capability/lifecycle model — Task 139

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/plugin-manifest-lifecycle-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **139** Implement Plugin manifest/component/capability/lifecycle model.
- `docs/PACKAGE-BOUNDARIES.md` — plugins package registrations only and must not become a second service locator.
- `docs/SOURCE-OWNERSHIP.md` — `packages/plugins` owns manifests/components/capabilities/lifecycle.

## Owned paths
- `packages/plugins/src/model.ts` (new)
- `packages/plugins/src/index.ts` (new)
- `tests/contracts/plugin-manifest-lifecycle.test.ts` (new)
- `docs/workstreams/plugin-manifest-lifecycle-20261006.md`

## Excluded/shared paths
- No tool/skill/provider implementations, domain repositories, plugin loader host, trust store, permission grants, MCP/A2A bridges, migrations, package manifests/lockfile or production config.
- Task 140 remains authoritative for trust/grant/versioning/uninstall enforcement.

## Current state
CLAIMED. Implement normalized Plugin manifest identity/version/dependencies, typed component registrations, requested capabilities, immutable lifecycle transitions and collision-safe component keys.