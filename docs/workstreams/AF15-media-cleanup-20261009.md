# AF15 media cleanup — exact-path ownership and work handoff

- Window: MASANAWA-01 / AF15
- Owner: MASANAWA-01 / AF15
- Claim (UTC): 2026-10-09T21:57:33.448Z
- Coordination: `factory/claims:.factory/leases.json`, claim `masanawa-01-af15-durable-media-cleanup-20261009`; published and read back.
- Branch: `work/af15-media-cleanup-20261009-masanawa01`
- Base main SHA: `f381f077c485c04261459b77a42c215d3ce3a14b`
- Current status: PLANNED (source change in progress; not verified).
- Owned exact paths:
  - `services/worker/src/durable_operations/media_cleanup.ts`
  - `services/worker/src/durable_operations/media_cleanup.test.ts`
  - `docs/workstreams/AF15-media-cleanup-20261009.md`
- Boundaries: AF00 owns worker startup, deployment and migration registry; AF01 owns escrow/financial decisions; media domain owners retain canonical DB and object permission/referencing. No existing module or local APK overwritten.
- Contracts: `docs/BACKEND-STORAGE-OPERATIONS-20261009.md`, `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md` AF v1, latest main.
- Dependencies: AF00's final worker composition and domain repositories remain separate. The job must not run against production without real PG/object/backup qualification.
- Next step: implement and test an isolated, fail-closed, idempotent media cleanup runner fed exclusively by durable repository tombstone/lease state. Publish exact-SHA handoff, AF00 composition instructions and safe integration action.

