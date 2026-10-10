# AF15 — orphan grace/retention boundary (MASANAWA-01)

## Verified coordination
- UTC claim: original CAS claim `masanawa01-af15-orphan-20261010-0119` committed at `96b852b41bba719984b0ffef68bf00df83f114c2`, read back from that exact SHA before source writes. Same-path continuation was registered on the coordination branch during work.
- Main base: `f381f077c485c04261459b77a42c215d3ce3a14b`.
- PR: https://github.com/Baatiku/masanawa/pull/599 (DRAFT, targets non-production AF15 integration; **do not merge without canonical reconciliation**).
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


## 2026-10-10 continuation — canonical consolidation checklist

The separate `orphan_cleanup.ts` and `.test.mjs` prototype is **removed from the PR tree** (preserved in Git history) so #599 does not add a second runtime cleanup authority. This PR now merges the latest reviewed AF15 non-production integration parent and modifies **only** its canonical `services/worker/src/durable_operations/media_cleanup.ts` and tests. Original #595/#598 late-drain, immutable-key, lease and corruption protections remain intact.

| Required source item / exact paths | Current state | Owner / next action |
| --- | --- | --- |
| Single media cleanup executor; retention/grace and exact opt-in `services/worker/src/durable_operations/media_cleanup.ts` | IMPLEMENTED_UNVERIFIED in this #599 commit; no implicit provider delete | AF15; run exact-head native/Vitest/typecheck |
| Negative regression coverage `services/worker/src/durable_operations/media_cleanup.test.ts` | Authored, NOT_RUN until toolchain checkout | AF13 runner: `pnpm exec vitest run services/worker/src/durable_operations/media_cleanup.test.ts services/worker/src/durable_operations/media_cleanup_s3.test.ts`, `pnpm --filter @masanawa/worker-service typecheck` |
| Atomic PostgreSQL claim/preflight/holds with protected linked-resource invariant; migrations in `database/**` | **MISSING SOURCE**; canonical repository interface is not a concrete adapter | AF15 implement bounded repository, AF00 allocate append-only migration with schema contract and review |
| Exact-version object adapter `services/worker/src/durable_operations/media_cleanup_s3.ts` (+ `.test.ts`) | IMPLEMENTED_UNVERIFIED on PR #599; SigV4 explicit versionId or immutable sha256 key; NOT_COMPOSED / provider NOT_RUN | AF15 source complete; AF13 execute Vitest/real versioned-object denial; AF00 authorize/configure only with canonical DB claim and disabled-by-default worker |
| Worker durable schedule/restart and startup binding `services/worker/src/**` | **MISSING COMPOSITION** | AF00 bounded shared-file transfer: register only after real repository/object adapters, named config and stop/drain handling |
| Cross-domain holds/references and retention policy for avatar, DM/room/audio-post and escrow evidence | **MISSING SOURCE/CONTRACT WIRING** | AF15 + AF01/AF09/AF06, confirm canonical owners; deny deletion by default |
| Real PostgreSQL 18 / S3 versioned-object / restart/restore, device/provider checks | **NOT_RUN** | AF13 operations runner executes isolated tests; AF00 signs safe baseline and production rollout separately |
| One unified reviewed source SHA, main deployment trigger audit, owner's unseen local-source reconciliation | **NOT INTEGRATED** | AF00; never request local pull before required remote source closure |

The canonical runner now defaults to a true dry-run before any claim, demands explicit `allowDelete: true`, validates authoritative creation/retention timestamps (minimum 1h age), and rejects whole-page duplicate claims before any object deletion. A real DB adapter must still enforce atomic race-safe holds/references and prevent new links during a purge lease. No new migration or storage credentials are introduced, and this change does not activate deletion.

Status: **PARTIAL_IMPLEMENTATION; source changes authored, runtime/real adapter/worker binding missing, no production qualification**. Do not merge this PR to main or activate deletion. Preserve #595/#598 non-production source; AF00 must elect the single reviewed safe baseline and assign actual source integration.

### Exact-version provider adapter continuation
The adapter never enumerates buckets and refuses cross-tenant/mutable keys before signing. DELETE pins VersionId when provided; provider 404 without explicit absence code remains **uncertain** rather than confirming a purge. Fake HTTP/response-based Vitest cases are authored, NOT_RUN in full worker checkout. The adapter has **no runtime registration**; this does not activate background deletes. Run `pnpm --filter @masanawa/worker-service typecheck` and `pnpm exec vitest run services/worker/src/durable_operations/media_cleanup.test.ts services/worker/src/durable_operations/media_cleanup_s3.test.ts` against the exact head on a capable source runner. AF00 must revalidate versioned object-store support and access rights before any activation.

## 2026-10-10 continuation — real PostgreSQL cleanup authority source, same PR #599

**Window:** AF15-GPT6-0444; live exact-path CAS claim `af15-599-postgres-adapter-gpt6-20261010-0444`. This continuation edits only AF15-owned adapter/test/schema-proposal files and this handoff. It does **not** add a second executor, call S3, edit the migration registry/startup, change financial authority or enable any cleanup job. The code runs behind the existing `MediaCleanupRepository` contract consumed by `runMediaCleanupBatch`.

**Connected source increment:** `services/worker/src/durable_operations/media_cleanup_pg.ts` uses atomic `UPDATE ... FROM (SELECT FOR UPDATE SKIP LOCKED)`, PostgreSQL-generated unpredictable lease tokens and DB-clock retention/age checks; it excludes live reference and hold rows, requires explicit `delete_approved`, `link_guard_installed`, `domain_refs_reconciled` and immutable-version or SHA-256-key evidence. It retains lease fencing through preflight/completion, checks provider uncertainty by quarantining rather than automatically retrying, and refuses destructive writes for malformed client identities. `media_cleanup_pg.test.mjs` contains 10 Node assertions for eligibility, malformed claims, two-account/tenant-bound parameters, blocked/expired leases, holds, ref counts, completion and database failures. **These tests are authored, not executed against the exact private GitHub source in this window.**

`services/worker/src/durable_operations/media_cleanup_pg_schema.sql` provides **unallocated, unapplied** append-only DDL for AF00 migration review. It creates `ops.media_cleanup_objects`, `ops.media_cleanup_references`, `ops.media_cleanup_holds`, and a parent-row locking link/hold trigger. The table's approval and full-domain-reconciliation booleans default **false** and no SQL sets them true. **The schema alone is not safe activation:** all current and historical avatar/chat/Room/Talk/financial-evidence references must be reconciled into the canonical tables, app producers must atomically register/unlink refs and holds, and only restricted audited roles may attest coverage. AF01 must approve financial holds. A request to link to non-active/tombstoned media must fail before a durable external reference is recorded.

| Required source item (exact paths) | Closure state / commit | Owner and next action |
| --- | --- | --- |
| Canonical executor and S3 version adapter `services/worker/src/durable_operations/media_cleanup.ts`, `media_cleanup_s3.ts` | IMPLEMENTED_UNVERIFIED; prior existing #599 commits, unchanged here | AF15/AF13 execute existing negative and provider tests; deletion disabled |
| PostgreSQL claim/preflight/complete/stop `services/worker/src/durable_operations/media_cleanup_pg.ts` | IMPLEMENTED_UNVERIFIED; current #599 head contains source | AF15 authored, AF13 executable Node24/PG verification |
| DB guard DDL `services/worker/src/durable_operations/media_cleanup_pg_schema.sql` | IMPLEMENTED_UNVERIFIED as **proposal**, NOT migrated | AF00 review and allocate append-only migration under canonical `database/**` authority; test fresh and upgraded PG18 |
| Claim/lease regression `services/worker/src/durable_operations/media_cleanup_pg.test.mjs` | AUTHORED_NOT_RUN; current #599 head contains 10 cases | AF13/AF00 run on exact commit with emitted JS and disposable PostgreSQL |
| Account and domain references; escrow/legal holds; permission/revocation; deletion attestation | **MISSING SOURCE/BINDINGS** | AF01 financial, AF06 private chat, AF09 published Talks, AF14 avatars, AF15 media; AF00 coordinate DB/API transfers; keep `domain_refs_reconciled=false` |
| Shared worker startup/scheduler/drain, dependency/config/readiness validation in `services/worker/src/main.ts` | **MISSING COMPOSITION** | AF00 bounded protected-path handoff; register disabled-by-default only after DB/hold/media authority |
| Qualified unified reviewed non-deploying integration SHA, owner-local fixes | **NOT INTEGRATED / owner-local source unseen** | AF00 verify deploy triggers and compose once after exact-head executable checks; do not request owner local pull |

**Actual environment:** git remote checkout attempt `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` failed `Could not resolve host: github.com`. Node `v22.16.0` and globally installed TypeScript are available, but this does not provide a private repository checkout. No `pnpm`, `psql`, Flutter or Dart was installed; source unit/Vitest/typecheck, migration race/restore and real S3/versioned-object checks **BLOCKED/NOT_RUN**, not PASS. GitHub file readback checks integrity/structure only.

**Exact replayable test commands, execution owner AF13 with AF00 migration coordination:** checkout PR #599 at its final exact HEAD using a capable authenticated runner, then:
```bash
corepack pnpm install --frozen-lockfile
pnpm --filter @masanawa/worker-service typecheck
pnpm exec vitest run services/worker/src/durable_operations/media_cleanup.test.ts services/worker/src/durable_operations/media_cleanup_s3.test.ts
# For authored .mjs tests, compile the source files to JS first and run at the emitted path.
node --test <emitted-path>/media_cleanup_pg.test.mjs
# AF00: apply reviewed numbered copy of media_cleanup_pg_schema.sql to disposable PG18;
# test concurrent claim/lease, reference insert/hold race, uncertain delete, crash/restart,
# the false-default attestation and an existing-data migration rehearsal.
```
Do not infer a PG/Vitest PASS from the 10 authored test cases, or count S3 mock behavior as real object-store proof. The actual PR head and source blob SHAs must be re-read after concurrent changes. **Milestone remains PARTIAL_IMPLEMENTATION; next critical executable source is AF00 schema allocation + AF15/domain reference bindings, not another cleanup helper.**
