# Twin block/report/discoverability controls — TWIN-094

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-block-report-controls-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
PR: #224
Task: TWIN-094 — blocking/reporting/discoverability controls.
Related active work explicitly excluded: TWIN-095 PR #219, TWIN-096 PR #221, production integration PR #136.

## Exact owned paths

- `docs/workstreams/twin-block-report-controls-20261006.md`
- `packages/identity/src/twin-safety-controls.ts`
- `packages/identity/src/twin-safety-controls.test.ts`

## Excluded/shared paths

Not owned and not changed:

- `packages/identity/src/index.ts` (currently owned by PR #217)
- existing `twin-profile.ts` and its repository/storage paths
- TWIN-095 / TWIN-096 files
- `services/gateway/src/app.ts`, `services/gateway/src/main.ts`
- shared auth/router/mobile/APK paths
- migrations, production environment, Commerce/Event/provider paths
- PR #136 owned production composition

## Completed implementation

- Added bounded block commands with stable request identity suitable for durable replay handling.
- Added bounded report commands with closed launch reason taxonomy and normalized optional detail text.
- Added fail-closed viewer-access projection: an active viewer block overrides public discoverability and denies interaction; hidden profiles remain unavailable to non-owners; owners retain access to their own hidden Twin.
- Rejects forged/out-of-scope block records rather than trusting mismatched tenant/viewer/Character state.
- Added focused tests for normalization, bounded reports, block precedence, hidden profile behavior, owner access and forged block state.
- A tentative Gateway service was removed before handoff because it would require importing the new contract through the active PR #217-owned Identity root export. No deep import or duplicate policy engine was left behind.

## Changed-file audit

PR #224 changes exactly the three owned paths above.

## Verification

- Strict source/type audit completed against the current Identity package conventions and root TypeScript settings.
- Foundation CI run `37452931847` on head `874e40837332db2f2ba635bbde5b42b4e86860e0` failed before checkout with `runner_id=0` and `steps=[]`; no repository code executed.
- Final branch head after this handoff update is the commit produced by this documentation update.

## Remaining dependencies

1. PR #217 / Identity export owner: export `twin-safety-controls.ts` through the canonical `@masanawa/identity` root surface after reconciling its current export work.
2. Canonical Identity/storage owner: implement durable request-replay-safe block/report persistence without creating a second identity store.
3. Shared Gateway owner (#136 or explicit successor): compose authenticated read/block/report routes using the exported contract and durable store.
4. Executable CI remains needed when hosted runner allocation recovers.

State: ISOLATED COMPLETE / INTEGRATION READY.
No further isolated implementation remains in this lane.

Last update: 2026-10-06.
