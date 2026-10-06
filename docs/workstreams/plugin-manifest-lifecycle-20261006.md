# Plugin manifest/component/capability/lifecycle model — Task 139

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/plugin-manifest-lifecycle-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Implementation head: `9b7034d1d8222465ab3a823c6246a8afdc6f536c`
PR: #267

## Completed implementation
- Added schema-versioned Plugin manifest identity/version/display metadata.
- Added typed component registrations for tools, skills, providers, event handlers and Ops UI extensions.
- Component identities are plugin-scoped and duplicate registrations fail closed.
- Entrypoints must remain plugin-relative and cannot traverse outside the plugin boundary.
- Requested capabilities are normalized declarations only; the model deliberately does not treat requests as grants.
- Added bounded plugin dependencies with self-dependency and duplicate-dependency rejection.
- Added immutable Plugin installation lifecycle: discovered -> installed -> enabled/disabled -> removed.
- Removal is terminal; lifecycle snapshots/timestamps/revisions are validated.
- Added root contract tests for manifest normalization, collisions, capability declarations, dependency safety and lifecycle invariants.

## Changed-file audit
Exactly four files:
1. `docs/workstreams/plugin-manifest-lifecycle-20261006.md`
2. `packages/plugins/src/index.ts`
3. `packages/plugins/src/model.ts`
4. `tests/contracts/plugin-manifest-lifecycle.test.ts`

No tool/skill/provider implementations, domain repositories, loader host, trust store, permission grants, MCP/A2A bridges, migrations, package manifests/lockfile or production config changed.

## Verification
Foundation CI run `37467952853`, job `112283649618` ended `failure` with `steps = null`; checkout/install/typecheck/tests never executed. This is not recorded as a pass and is not application-failure evidence.

## Remaining dependencies
- Task 140 owns trust/grant/versioning/uninstall enforcement on top of this manifest/lifecycle model.
- Runtime host/plugin loader composition remains separate ownership.
- Workspace owner activates `packages/plugins` when shared manifest/lockfile ownership is available.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
