# Plugin isolation / no-silent-self-mutation acceptance — Task 144

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/plugin-isolation-acceptance-20261006`
Base SHA: `d68990a9c0f0c4ec22e9ff307cdac0362c3a4cd5` (Task 141 Plugin stack / PR #271)
Acceptance head: `e5ece0b4a161c51b8b12af61b5fdf6536966a11c`
PR: #275

## Completed acceptance harness
- Proves Plugin capability requests do not become grants.
- Proves bridge descriptors cannot expose undeclared components or require undeclared capabilities.
- Proves untrusted major-version self-upgrade is denied when policy requires verification.
- Proves grant authority is bound to the exact installed Plugin version.
- Proves update decisions do not mutate installation version/revision.
- Proves uninstall planning returns explicit component-disable/capability-revoke instructions without silently changing lifecycle state.
- Proves lifecycle removal requires an explicit transition and is terminal.
- Proves expired grants collapse to zero authority even against an already-normalized manifest.

## Changed-file audit
Exactly two files:
1. `docs/workstreams/plugin-isolation-acceptance-20261006.md`
2. `tests/integration/plugin-isolation-acceptance.test.ts`

No runtime plugin host/loader, package manifests/lockfile, credentials, live bridge execution, migrations or production config changed.

## Verification
Foundation CI run `37469311843`, job `112288325089` ended `failure` with `steps = null`. Checkout/install/typecheck/tests never executed. Therefore Task 144 is **not** recorded as production-passed from this branch; this is not application-failure evidence.

## Remaining dependencies
- PR #271/#269/#267 Plugin stack integrates first.
- Runtime plugin host must enforce the same boundaries around actual loading/execution/unload.
- CI runner allocation must execute the acceptance harness.
- Production qualification must prove isolation against real plugin code/process/network adapters.

## Current state
**ISOLATED ACCEPTANCE HARNESS COMPLETE / EXECUTION BLOCKED BY CI + RUNTIME HOST INTEGRATION.**

No further isolated implementation remains in this lane.
