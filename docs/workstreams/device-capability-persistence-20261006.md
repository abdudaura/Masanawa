# Device capability PostgreSQL persistence — Task 105 continuation — 2026-10-06

Status: active reclaimed persistence slice
Owner/window: ChatGPT continuation window
Branch: `work/device-capability-persistence-20261006`
Base: stale PR #121 head `316a43a922350c3c29759b4a492fd868b1e9bb1c`

PR #121's handoff explicitly claimed a PostgreSQL capability adapter and integration
coverage, but those files were never added. This branch implements exactly that missing
slice on top of the already-created `0002_device_capabilities.sql` migration.

## Exact owned paths
- `adapters/storage/postgres/src/devices/capabilities.ts` (new)
- `adapters/storage/postgres/src/devices/index.ts` (append-only export)
- `tests/integration/device-capabilities.test.ts` (new)
- `docs/workstreams/device-capability-persistence-20261006.md`

## Boundaries
- no migration edits or numbering changes;
- no root Postgres barrel edit (Task 104 already exports the devices namespace);
- no shared lockfile/package dependency changes;
- no Task 104 pairing, Task 106 assignment, Task 107 credentials, Gateway/mobile or production edits.

The adapter intentionally uses structural capability/health shapes and existing
`@masanawa/contracts`/Security fingerprinting so it does not add a new
`@masanawa/devices` dependency to the Postgres package before the shared lockfile owner
integrates that workspace importer.

## Acceptance
- active Device required for publication/health write;
- immutable complete capability generations with exact replay;
- generation must advance exactly by one;
- changed replay/stale/gapped generation fails closed;
- health observations are monotonic with exact replay;
- same timestamp + changed health fails closed;
- latest publication + health read is tenant/device isolated;
- snapshot staleness is calculated from caller-supplied trusted time;
- capability absence never implies support.


## Implementation checkpoint

Implemented on PR #317.

Exact head: `c9210712e197467c21276679acdba567ed188487`.

Completed:
- PostgreSQL persistence for immutable complete capability generations;
- exact replay for same generation/evidence;
- conflict on changed same-generation evidence;
- first generation = 1 and exact +1 generation progression;
- active-Device gating and Tenant/Device isolation;
- monotonic Device health with exact replay and same-timestamp conflict detection;
- latest complete generation read plus current health and caller-time staleness;
- capability absence remains absence (no inferred support);
- focused disposable-Postgres acceptance coverage;
- devices Postgres barrel export.

Verification:
- PR #317 is mergeable and changes exactly the four claimed paths.
- Foundation CI run `37499420900` produced no downloadable job log. This is the same
  repository-wide pre-execution runner failure and is not a test verdict.

State: IMPLEMENTATION COMPLETE / EXECUTABLE VERIFICATION BLOCKED.
