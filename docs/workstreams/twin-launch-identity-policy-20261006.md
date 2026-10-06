# Twin launch identity policy gate — TWIN-095

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/twin-launch-identity-policy-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/TWIN-TRANSFORMATION-TASKS.md` — **TWIN-095** minor/identity/impersonation policy gates appropriate to launch.
- `docs/TWIN-INTEGRATION-MATRIX.md` — preserve existing Twin identity/runtime and leave shared Gateway/mobile composition to PR #136.

## Owned paths
- `packages/identity/src/twin-launch-policy.ts` (new)
- `packages/identity/src/twin-launch-policy.test.ts` (new)
- `docs/workstreams/twin-launch-identity-policy-20261006.md`

## Excluded/shared paths
- No edits to `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, mobile router/chat/transport, production environment, migrations, Commerce/Event state, or PR #136-owned paths.
- No edit to `packages/identity/src/index.ts` while PR #136 currently carries an overlapping package-export change; export/composition is an integration dependency.
- No persistence schema or production policy enablement in this lane.

## Dependencies
- Existing canonical `TwinPublicProfile` discoverability remains profile truth.
- Existing authenticated Twin block/report service remains the reporting mechanism; this lane must not duplicate it.
- Shared owner later composes the policy gate into public profile/discovery/chat admission and supplies persisted/admin-configured policy.

## Current state
CLAIMED. Implement a deterministic, fail-closed launch identity gate covering age-band uncertainty, owner identity assurance, impersonation review state, discoverability, explicit reason codes and safe operator-configurable policy. Add exhaustive unit tests.