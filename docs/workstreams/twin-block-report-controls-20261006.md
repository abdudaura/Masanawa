# Twin block/report/discoverability controls — TWIN-094

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-block-report-controls-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task: TWIN-094 — blocking/reporting/discoverability controls.
Related active work explicitly excluded: TWIN-095 PR #219, TWIN-096 PR #221, production integration PR #136.

## Exact owned paths

- `docs/workstreams/twin-block-report-controls-20261006.md`
- `packages/identity/src/twin-safety-controls.ts`
- `packages/identity/src/twin-safety-controls.test.ts`
- `services/gateway/src/twin_safety_controls.ts`
- `services/gateway/src/twin_safety_controls.test.ts`

## Excluded/shared paths

- `packages/identity/src/index.ts`
- existing `twin-profile.ts` and its repository/storage paths
- TWIN-095 / TWIN-096 files
- `services/gateway/src/app.ts`, `services/gateway/src/main.ts`
- shared auth/router/mobile/APK paths
- migrations, production environment, Commerce/Event/provider paths
- PR #136 owned production composition

## Dependencies

- Existing public Twin profile discoverability is canonical profile truth.
- Durable block/report storage and migration must be composed later by the canonical Identity/storage owner.
- Shared Gateway route registration remains with #136 or an explicit successor.

## Current state

CLAIMED. Implementation will add bounded canonical block/report command contracts, access projection semantics, idempotency/replay requirements at the store boundary, and an isolated authenticated Gateway service that cannot grant interaction when a viewer block is active.

Last update: 2026-10-06.
