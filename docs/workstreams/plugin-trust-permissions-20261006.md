# Plugin trust/permissions/versioning/uninstall — Task 140

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/plugin-trust-permissions-20261006`
Base SHA: `bf408aff1ca9adedd947023c2297a7c744284c96` (Task 139 exact head / PR #267)
Implementation head: `4b8fdc62b4811cf6750acc039a26956a3ce736a4`
PR: #269

## Completed implementation
- Added explicit Plugin trust classes: untrusted, verified and platform.
- Added capability grants bound to exact Plugin ID/version with issue/expiry timestamps.
- Effective authority is only the intersection of manifest requests and explicitly allowed, non-denied capabilities.
- Expired grants resolve to zero granted authority.
- Contradictory allow/deny grants fail closed.
- Added version-update policy that rejects downgrades, stale grants and optionally unverified major upgrades.
- Added uninstall plan requiring component disablement and capability revocation before lifecycle removal.
- Uninstall manifest/grant identity/version mismatches fail closed.
- Added root contract tests for grant intersection/expiry/version binding, update policy and uninstall ordering.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/plugin-trust-permissions-20261006.md`
2. `packages/plugins/src/security.ts`
3. `tests/contracts/plugin-trust-permissions.test.ts`

No plugin loader execution, credential storage, domain repositories, Security package authority model, package manifests/lockfile, migrations, MCP/A2A bridge or production config changed.

## Verification
Foundation CI run `37468253485`, job `112284670610` ended `failure` with `steps = null`; checkout/install/typecheck/tests never executed. This is not recorded as a pass and is not application-failure evidence.

## Remaining dependencies
- PR #267 / Task 139 integrates first.
- Runtime host must enforce these grant/update/uninstall decisions around actual plugin loading.
- Task 141 may add external protocol bridge registrations without bypassing this capability gate.
- Task 144 must prove isolation/no-silent-self-mutation end to end.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
