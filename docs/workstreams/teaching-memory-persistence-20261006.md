# Core Teaching durable Memory persistence

Status: ISOLATED PERSISTENCE COMPLETE — Gateway/runtime composition remains
Branch: `work/teaching-memory-persistence-20261006`
Base: `work/integration-core-teaching-20261004` / PR #96
PR: #215

## Ownership

Changed paths only:
- `adapters/storage/postgres/src/teaching/progress.ts`
- `adapters/storage/postgres/src/teaching/progress.test.ts`
- `docs/workstreams/teaching-memory-persistence-20261006.md`

No Gateway/router/mobile/channel/shared export/migration/production-environment file is edited.

## Completed

- Concrete `TeachingProgressPort` backed by canonical PostgreSQL Memory storage.
- Relationship-private `state` MemoryRecord scope.
- Exact SkillVersion binding in persisted payload.
- Atomic selection/free-response attempt + resulting-progress persistence.
- RequestId replay ledger preserving old replay identities after later attempts.
- Exact replay returns `replay` without creating a new Memory revision.
- Changed payload/kind under the same RequestId fails closed.
- Pedagogical `planHash` drift fails closed.
- Progress Relationship/Skill scope mismatch fails closed.
- Attempt hash validation fails before persistence.
- Bounded 4,096 replay receipts per active Teaching progress record.
- Transaction-scoped PostgreSQL advisory lock keyed by Tenant + Relationship + SkillVersion, preventing concurrent duplicate first-write records.
- Serializable transactions in the production factory.
- Canonical MemoryRecord/MemoryRevision UUIDv7 IDs and Memory provenance evidence.
- No Teaching-specific table or migration.
- Focused fake-repository tests cover store/resume, replay, changed-payload conflict, free-response continuity, plan drift, scope mismatch and malformed hashes.

## Integration contract

Runtime composition should create the port with:

`createPostgresTeachingProgressPort({ pool, tenantId })`

and inject it into PR #96's `TeachingRuntimeCoordinator`.

The adapter deliberately does not solve pending multi-select stage custody because the `TeachingMultiSelectStagePort` contract lacks Relationship/session scope. That stage must remain with the authenticated pending-action/session or Workflow owner, as already specified by PR #96, rather than being incorrectly written into Relationship Memory.

## Verification

Foundation CI run `37450713699` failed before checkout; job `112226332761` exposes `steps = null`. No CI code verdict is claimed.

Static contract audit was performed against the current stacked PR #96 Teaching interfaces, current Memory repository/invariants, canonical ID helpers and PostgreSQL transaction helper.

## Remaining owner work

- runtime/Gateway owner: instantiate and inject this port using the authenticated tenant;
- shared export owner: export the adapter when reconciling PostgreSQL package exports;
- #91/#92/#136 owners: retain pending Teaching action/stage custody and route app/channel actions;
- #136: Study Center navigation/transport/device acceptance.

**No further isolated implementation remains in this persistence slice.**
