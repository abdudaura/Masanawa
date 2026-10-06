# Plugin isolation / no-silent-self-mutation acceptance — Task 144

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/plugin-isolation-acceptance-20261006`
Base SHA: `d68990a9c0f0c4ec22e9ff307cdac0362c3a4cd5` (Task 141 Plugin stack / PR #271)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **144** Pass plugin isolation and no-silent-self-mutation acceptance tests.
- Exercises Tasks 139-141.

## Owned paths
- `tests/integration/plugin-isolation-acceptance.test.ts` (new)
- `docs/workstreams/plugin-isolation-acceptance-20261006.md`

## Excluded/shared paths
- No runtime plugin host/loader, package manifests/lockfile, credentials, network execution, migrations or production config.
- This harness cannot claim deployed-runtime pass until CI and runtime composition execute.

## Current state
CLAIMED. Add integrated acceptance proving capability-request != grant, exact-version grants, bridge component/capability containment, denied self-upgrade paths, immutable decision APIs, explicit uninstall revocation ordering and terminal removal.