# AF15 — media cleanup late-drain and corrupt-claim guards

## Coordination and immutable source

- Owner/window: MASANAWA-01 / AF15; work date UTC 2026-10-10.
- Fresh primary repository baseline: `main@f381f077c485c04261459b77a42c215d3ce3a14b`.
- Target/source dependency: `integration/af15-media-cleanup-20261009@a0fddc155c98e427f2952e2c044ca2225e42dc63`, previously reviewed #595 media-cleanup runner, **not** live worker composition.
- Isolated branch: `work/af15-media-batch-guards-20261010-masanawa01`.
- Pull request: https://github.com/Baatiku/masanawa/pull/598 (targets non-deploying AF15 integration, not main).
- Source/test checkpoint before this handoff: `65a1758f608bdff02d0810a2842546b32bc743fe`.
- GitHub runner blob SHA: `2b4659032c1d3856b314b8e2c016476e5d9eb609`, exactly matched by `git hash-object` of locally compiled file.
- GitHub Vitest authored test blob SHA: `8b0ad2c52ae563e7ebe71bfd0690099035662146`.
- CAS coordination record: `factory/claims:.factory/leases.json`, ID `masanawa-01-af15-media-batch-guards-20261010`; published and read back at `02f321e21c2212a3d0e69f19f141f027749f3c43` before modifying source.
- Exact owned paths:
  - `services/worker/src/durable_operations/media_cleanup.ts`
  - `services/worker/src/durable_operations/media_cleanup.test.ts`
  - `docs/workstreams/AF15-media-batch-guards-20261010.md`
- No transfer of worker `main.ts`, schema, migration, package export, finance, Android, Gateway, storage credentials or production environment.

## Delivered behavior and threat boundary

This is a continuation of the existing **single** tombstone cleanup runner from #595; no second media store or scheduler is introduced. It now rechecks stop/drain after awaited DB preflight but before irreversible `deleteExact`. Preflight-started shutdown leaves a durable claim for lease-based recovery; already-started deletion still commits its outcome. A structurally corrupt claim array/null candidate is rejected before deleting any candidate. Null preflight readback is quarantined. Any object key carrying a second tenant namespace is rejected. Existing fenced lease, hold, reference revision, immutable version, idempotent absence, uncertain provider status and completion semantics are preserved.

AF15 authored four new regression cases (plus a cross-tenant negative assertion) within the allocated Vitest file. These check corrupt-claim all-or-none admission, corrupt preflight quarantine, drain during preflight, and completion after deletion began.

## Executed verification versus unavailable checks

- **PASS, real exact-source check**: local `git hash-object media_cleanup.ts` == `2b4659032c1d3856b314b8e2c016476e5d9eb609` from the GitHub branch.
- **PASS, real TypeScript compiler**: `tsc --strict --target es2022 --module nodenext --moduleResolution nodenext --noEmit media_cleanup.ts` (TypeScript 5.8.3, Node 22.16.0); emitted JS using same options and `--outDir out`.
- **PASS_SIMULATED, actually executed**: `node probe.cjs` against that compiled JS; **21/21 assertions passed**, including all changed state branches, provider uncertainty, durable completion exceptions, lease loss, path validation and duplicate key. The temporary probe lived outside the repo, not committed; it exercised the exact byte-matched production module with fake adapters. This is not live I/O proof.
- **NOT_RUN**: repository Vitest suite (Vitest/pnpm/workspace dependencies absent); complete project typecheck, PostgreSQL 18 concurrency, real object provider, lease-reclamation on crash, coupled DB+object restore, mobile/audio playback, production startup/worker scheduling, deployment and rollback.
- **Known inherent limit**: a DB preflight alone cannot prove references will remain absent until deletion unless the existing real repository atomically tombstones/fences link creation; that repository + provider adapter do not yet exist in live composition.
- Test/acceptance scope: DB-A05/A07/A08 and PF-A02 safety regressions, **not** verified E2E.

## Handoff and integration

Review PR #598 at its exact head, check that only these three paths are touched, and merge to `integration/af15-media-cleanup-20261009` after confirming no divergent active path ownership or auto deploy triggers. It is a non-production, isolated helper; it is NOT ready for live orphan sweeps or escrow-evidence deletion. AF00 exclusively owns worker startup/migrations and must join canonical persistent repository, external object provider and retention hold authority only after executable database/object/restart checks. AF13 independently qualifies recovery evidence. Domain financial holds require AF01/AF02 clearance.

**Status:** PARTIAL_IMPLEMENTATION for overall media lifecycle; isolated runner hardening compiled and simulated-source-tested. Not VERIFIED_E2E and not DEPLOYED_VERIFIED.
