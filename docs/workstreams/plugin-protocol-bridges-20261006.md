# External MCP/A2A/protocol bridge pattern — Task 141

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/plugin-protocol-bridges-20261006`
Base SHA: `3525df54e649d2141dfef67c225299e74fa5f8e4` (Task 140 exact head / PR #269)
Implementation head: `af81e388de0a43757540135b166fc0ee1041e70e`
PR: #271

## Completed implementation
- Added declarative MCP/A2A/custom external bridge descriptors.
- Network bridges require https/wss endpoints and reject inline endpoint credentials.
- stdio bridges use opaque registered command references rather than raw executable command strings.
- A2A is restricted to network transport.
- Authentication uses opaque credential references only; bridge metadata contains no secret material.
- Exposed bridge components must already exist in the Plugin manifest.
- Required bridge capabilities must already be requested by the Plugin manifest; the bridge grants no new authority.
- Invocation envelopes may target only components explicitly exposed by that bridge.
- Added root contract tests for component/capability containment, credential safety, stdio/network rules and invocation isolation.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/plugin-protocol-bridges-20261006.md`
2. `packages/plugins/src/protocol-bridge.ts`
3. `tests/contracts/plugin-protocol-bridge.test.ts`

No live network/stdio execution, MCP/A2A SDK dependency, credentials, Gateway, Tool runtime, package manifests/lockfile, migrations or production config changed.

## Verification
Foundation CI run `37468640533`, job `112286013438` ended `failure` with `steps = null`; checkout/install/typecheck/tests never executed. This is not recorded as a pass and is not application-failure evidence.

## Remaining dependencies
- PR #269/#267 Plugin stack integrates first.
- Runtime host enforces Task 140 grant decisions before opening any bridge.
- Concrete MCP/A2A adapters, credentials and network execution remain adapter/runtime work.
- Task 144 must verify bridge/plugin isolation and no silent self-mutation.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
