# AF15 — orphan grace/retention boundary (MASANAWA-01)

## Verified coordination
- UTC claim: original CAS claim `masanawa01-af15-orphan-20261010-0119` committed at `96b852b41bba719984b0ffef68bf00df83f114c2`, read back from that exact SHA before source writes. Same-path continuation was registered on the coordination branch during work.
- Main base: `f381f077c485c04261459b77a42c215d3ce3a14b`.
- Source/tests branch: `work/af15-orphan-cleanup-20261010-masanawa01`. Source/test checkpoint: `078c38a83551b1fb2473bab63e06512fc3b6729f`.
- Exact paths: `adapters/storage/object_lifecycle/orphan_cleanup.ts`, `adapters/storage/object_lifecycle/orphan_cleanup.test.mjs`, this handoff.
- Contract inputs: `docs/BACKEND-STORAGE-OPERATIONS-20261009.md`, `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md`, AF15 lane. No Gateway, worker startup, database migration/manifest, object-provider config, keys or deployment change.

## Source and actually executed proof
- `runOrphanCleanup`: no bucket-wide scan; authoritative metadata list; bounded dry-run default; min-one-hour grace and retention deadline; exact owner/service prefixes; whole-page malicious and duplicate-key rejection; conditional metadata revision/hold/reference checked purge lease; no object delete until accepted lease; idempotent deletion adapter contract; retryable failed delete and failure propagation for incomplete metadata commits.
- Native Node v22.16.0: `node --experimental-strip-types --test orphan_cleanup.test.mjs` — **12/12 PASS**, including dry run, scoped deletion, concurrent/retained denial simulation, unsafe keys, corrupt leases, bounded batch, uncertain provider error, database completion failure and nonboolean delete opt-in.
- Global TypeScript v5.8.3: `tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext orphan_cleanup.ts` — **PASS**.
- Exact pushed Git blob readback matched local `git hash-object`: source `732c244f21212cddbcea82967b8e79d46432a7f5`; test `0e88820b4878b825d76d718d64ac4b280822bf01`.
- Tests use in-memory repository/object stubs, **not real PostgreSQL/S3**; assertions are local source-level integration simulations, **not** live recovery, data retention or product E2E.
- Real PG revision leases/references, signed object revoke, object versions, two-system restore, measured capacity, restart, and actual worker wiring all **NOT_RUN / BLOCKED**. No payment, provider, device, APK, migration or production effects.

## Integration collision discovered; do not merge duplicate execution authority
- During exact-head review, recovered PR [#595](https://github.com/Baatiku/masanawa/pull/595), already merged into nonproduction `integration/af15-media-cleanup-20261009`, and [#598](https://github.com/Baatiku/masanawa/pull/598), its late-drain/corrupt-claims fix. These supply the **canonical** `services/worker/src/durable_operations/media_cleanup.ts` tombstone executor with stronger tenant/version/immutable-object checks.
- This new standalone orphan runner is a **prototype**, not a second production cleanup authority. Preserve the unique orphan-age, retention, malformed-page, explicit opt-in and pending-intent negative cases, but reconcile those checks into canonical pre-claim/tombstone PostgreSQL authority before accepting any code integration.
- Do **not** merge this branch into main or the AF15 integration target until the canonical owner explicitly rejects duplication and reviews a contract-specific integration. AF00 owns worker composition; AF15 owns durable adapters, and migrations require AF00 allocation.

**State:** PARTIAL_IMPLEMENTATION; SOURCE TESTED / NOT E2E VERIFIED / NOT DEPLOYED. Safe next step: reconcile the unique pre-claim retention cases with the canonical #595/#598 runner, implement atomic PG owner/reference/hold/lease checks with approved migration, then test with disposable PG and real object storage; keep all destructive cleanup disabled meanwhile. Current PR is a scoped evidence/handoff checkpoint, not authorization to run deletions.
