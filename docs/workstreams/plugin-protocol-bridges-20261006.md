# External MCP/A2A/protocol bridge pattern — Task 141

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/plugin-protocol-bridges-20261006`
Base SHA: `3525df54e649d2141dfef67c225299e74fa5f8e4` (Task 140 exact head / PR #269)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **141** Implement external MCP/A2A/protocol bridge pattern where justified.
- Tasks 139-140 remain canonical for Plugin registrations and capability grants.

## Owned paths
- `packages/plugins/src/protocol-bridge.ts` (new)
- `tests/contracts/plugin-protocol-bridge.test.ts` (new)
- `docs/workstreams/plugin-protocol-bridges-20261006.md`

## Excluded/shared paths
- No live network/stdio execution, MCP/A2A SDK dependency, credentials, Gateway, Tool runtime, package manifests/lockfile, migrations or production config.
- Protocol descriptors never become platform authority.

## Current state
CLAIMED. Implement declarative bridge descriptors for MCP/A2A/custom transports, opaque credential references, exposed-component validation against the Plugin manifest, required-capability subset validation, and invocation envelopes that remain scoped to declared components.