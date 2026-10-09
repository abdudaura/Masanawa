# AF15 — fenced media tombstone cleanup (MASANAWA-01)

## Ownership and recovery

- Claim published/read back in `factory/claims:.factory/leases.json`: `masanawa-01-af15-durable-media-cleanup-20261009`; claimed UTC 2026-10-09T21:57:33.448Z.
- Owner/window: MASANAWA-01 / AF15. Base `main@f381f077c485c04261459b77a42c215d3ce3a14b`.
- Branch: `work/af15-media-cleanup-20261009-masanawa01`; PR #595.
- Source/tests checkpoint: `007beba6969f73a136b743c319f94777fe72f928`.
- Exact owned production source: `services/worker/src/durable_operations/media_cleanup.ts`.
- Exact owned test: `services/worker/src/durable_operations/media_cleanup.test.ts`.
- Exact owned handoff: `docs/workstreams/AF15-media-cleanup-20261009.md`.
- Scope boundary: preserved pre-existing stores, Gateway, worker startup, auth/finance domains, schema/migrations and owner-local APK. No production code currently calls this new runner.

## Implemented (isolated complete helper; app integration outstanding)

Typed `runMediaCleanupBatch` executes an existing durable/tombstoned media cleanup claim, with bounded batch size 1–50. Before touching storage it validates tenant-scoped object paths, immutable checksum or pinned version, lease token, revision, path traversal, cross-tenant access and forbidden URL/prefix characters. An authoritative repository must have atomically tombstoned each candidate before claiming it, preventing new references while deletion is pending. The runner performs a canonical preflight of live references/retention holds/current lease and revision. It skips lost leases and blocks held media, including financial/dispute evidence. No object deletion happens unless preflight is exact, hold-free and immutable.

An object deleter deletes only a single exact tenant key/version and treats known 404/absent as idempotent success. Provider errors/timeouts are classified **uncertain** and quarantined without automatic replays. Durable completion occurs only *after* a confirmed delete/absence and must pass a lease fence; failure is quarantined as `completed-but-unrecorded`. Draining prevents new claims. No provider credentials, images, receipts or contents are logged. It does not introduce a second media store, ACL signer, DB schema, scheduler or finance authority.

## Verification (source artifact and honest status)

- **PASS, real local compilation**: `tsc --strict --target es2022 --module nodenext --moduleResolution nodenext --noEmit services/worker/src/durable_operations/media_cleanup.ts` using local tsc/Node environment.
- **PASS_SIMULATED, actually executed**: compile same source to JS using tsc, run Node `node --input-type=module` harness: 8 state scenarios (ready, blocked, lease lost, stale/referenced preflight, unknown provider result, absent object, CAS lease loss, DB completion failure) and 3 path/identity negatives. No live provider or DB was used.
- **Exact source readback**: GitHub blob for production code `324ada41b6096b0f2fdf7643b137abb6e577e53e`, equal to `git hash-object` of the locally compiled file. Test blob `b3e859485d6153554b91cb1976351e58753c742f`, equal to local source hash.
- **NOT_RUN**: repository Vitest tests (11 authored cases), full project pnpm/Node-24 typecheck, Postgres transaction/concurrent claim, live object storage delete+readback, worker restart/lease recycling, staged DB+object restore, backups, credential checks, production runner, physical Android/media playback. Local environment has Node 22 and global tsc; no pnpm/workspace node_modules and no clone/network DNS.
- **NOT DONE**: canonical repository implementation and live worker wiring, provider timeout recovery verification, real storage lifecycle. Do not call module existence E2E/production readiness.

## AF00 & domain-owner integration handoff

AF00 owns `services/worker/src/main.ts` composition and migration SQL allocation. AF15/domain owners next implement `MediaCleanupRepository` against a single canonical durable media lifecycle table with **atomic tombstone + short fenced lease**. Claim must require grace period expiration, checked no-refs and no retention/financial holds, and permanently prohibit new links to a tombstone; the table must carry tenant, object immutable key/version, reference revision, attempts, cause, state, lease token and last uncertain outcome. `preflight`, `complete`, and `stop` must use expected lease token + revision, with readback for uncertain provider outcomes. An object adapter must map `ImmutableObjectDeleter` to an already approved private S3-compatible store and enforce tenant scope and pinned version. Verify provider request cancellation, redirect ban and idempotent 404. Financial/dispute evidence requires AF01/AF02 explicit retention clearance; account deletion stays blocked on outstanding object or payment obligations.

After executable PostgreSQL concurrency/cancellation, object access/restore, restart and security negative checks, AF00 may wire scheduled work into worker startup with draining and lag/readiness instrumentation. Do not integrate a live scheduler, purge old objects or migrate storage until these gates are proved. Dependencies: AF00 shared composition, AF05/AF06/AF09/AF10 media ownership, AF01 finance, AF14 deletion, AF13 independent evidence. Relevant tests: DB-A01/02/04/05/06/08, PF-A02, SA10–SA14, WF-A10. These IDs are **NOT verified** by this source slice.

## Integration action and status

**PARTIAL_IMPLEMENTATION / NOT VERIFIED E2E / NOT DEPLOYED.** The narrow module and regression tests are ready for AF00 exact-SHA conflict/security review and source-only, **non-deploying** integration; there is no claim the media cleanup feature is operational. Keep any main/production promotion behind the separate release/restore gate. No owner-local modifications or APK were reconciled in this isolated worker lane.
