# F13 / R18 — Avatar content-addressed staging recovery (2026-10-09)

## Five-minute exact-file ownership claim (before edits)

- Selected scope: **F13**, recovery of existing R18 avatar implementation; **not** a new competing avatar implementation.
- Canonical main inspected before claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Existing draft PR: **#435**, branch `work/r18-avatar-end-to-end-20261008`, head before claim `145da2fedeee7c9492dbf7040830d9ded7fd1faa`. Prior PR updated 2026-10-08T10:11:24Z, stale by well over five minutes as of 2026-10-09 ~01:25Z. Continue existing branch/PR; no parallel duplicate avatar code.
- Exact exclusive source files for this bounded recovery: `services/gateway/src/profile_avatar/repository.ts`, `services/gateway/src/profile_avatar/repository.test.ts`, `services/gateway/src/profile_avatar/service.ts`, `services/gateway/src/profile_avatar/service.test.ts`; this handoff file. **No** shared Gateway composer, router, native Firebase, migrations, wallets, media storage adapter, production systems or provider configs.
- Reviewed the 2026-10-08 reconciliation, F13 assignment, R18 #435 owner handoff, canonical main profile routes, currently open U01–U30/F implementation PR list, branch/main source and existing cleanup SQL tests.
- Root-cause candidate: `stage` reactivates a previously orphaned content-addressed row but leaves stale `created_at` unchanged. The garbage sweeper currently filters staged objects using `created_at`, permitting immediate reclaim of an object whose new upload has just begun.
- Change boundary: make staged timeout use current staging/activity age; atomically refuse active/deleting/foreign-key restages before touching S3, while allowing fresh staged/orphaned restages; retain durability across crashes; add focused regression tests for orphan restaging, dormant new stages, refused restage, and still-reclaimable orphaned/deleting objects. Avoid changing the durable storage schema/contract.
- Full R18/F13 remains **PARTIAL / NOT END-TO-END ACCEPTED**. Do not merge #435, deploy or modify production. Need independent PostgreSQL test, Vitest/TypeScript, Flutter camera/CDN and device checks before acceptance.

## SHA-specific changes and source coverage

- First claim SHA: `93e6b3c9d1604ccd16e3c3d3ffd851f00016133b`.
- Expanded claim (before touching service/test source): `d8e89d2755e975a1711331c484ad51275b346a3f`.
- Repository fix commit: `b7bb37395817d6a10d0fdbadddebc034737ad2f9`.
- Service fail-closed commit: `82d63de9593af33eb12935a3c86853116def263f`.
- SQL/repository regression test commit: `12280c1353a08cc1a85a135d1424093eb708f96f`.
- Service regression test commit: `990af05f101a6d0086be994418022523bc861ac3` (**last application/test source SHA**, before this handoff documentation commit).
- Existing draft PR: https://github.com/Baatiku/masanawa/pull/435 — append this F13 recovery to the existing PR; preserve its original R18 avatar implementation and other owners' pending branches.

**Concrete fix:** `createPostgresAvatarRepository.stage` now returns whether PostgreSQL actually acquired a valid staged lease, including both new and retried-staged/orphaned SHA objects, with tenant/user/public URL identity equality, and refuses active/deleting/foreign records. The service declines external S3 PUT on a failed stage (typed 409). `claimGarbage` uses last-staged `updated_at` instead of historic insertion `created_at` for timed-out uploads. Concurrent row locks on `INSERT ... ON CONFLICT DO UPDATE` versus garbage claim preserve one authoritative row state. Previously, restaging a days-old orphan retained its old creation time and the sweeper could select it immediately; the corrected lease requires a fresh one-hour inactivity interval. Unchanged: account authorizer, avatar CAS, normalized Sharp WebP, S3 signer, active/orphaned/deleting retention, background sweeper, existing migration schema, five-tab navigation and Firebase.

**Added regression assertions:** fake SQL pool verifies successful lease acquisition, owner/public-URL fencing, refused conflict `rowCount=0`, and time-based stage reclaim conditional on `updated_at`. Service fake repository verifies that refusal raises `profiles.avatar.stage_conflict` **before** any object-store write or profile mutation. Existing happy-path and failure tests are retained.

## Actual verification — distinguish structural readback from runnable suites

- **PASS — six source-readback structural checks** performed by independently fetching all four modified files from pushed PR head `990af05f101a6d0086be994418022523bc861ac3`. Checked fresh lease update, staged GC age source, owner/URL fencing, pre-S3 guard, repository negative tests, and service negative tests. These are structural assertions only; **they are not Vitest or PostgreSQL execution**.
- **BLOCKED — executable Vitest/typecheck:** this environment lacks a checkout/node_modules and cannot resolve `github.com` through git. Local Node is `v22.16.0`, while repository package engines demand Node 24 and pnpm 12. No claim of successful compilation or test execution.
- **FAILURE BEFORE TEST EXECUTION — remote GitHub Actions** for source head `990af05f101a6d0086be994418022523bc861ac3`: run `37869599946` build job `113624381644` and run `37869599947` check job `113624381629` both concluded failure around `2026-10-09T01:24:15Z`; the jobs expose **zero steps**. These failures do not establish whether changed source would pass/fail. Also a Vercel status is failure; no production deployment attempted.
- **NOT RUN:** disposable PG18/pgvector migration and two-worker GC-versus-restage race test, S3/CDN live content, Flutter widget/Android camera/gallery, authenticated two-device profile reload, release/signed build.

Commands for a properly provisioned isolated checkout of **this PR head** with Node 24 / pnpm 12:
```sh
corepack pnpm install --frozen-lockfile
corepack pnpm exec vitest run services/gateway/src/profile_avatar/repository.test.ts services/gateway/src/profile_avatar/service.test.ts services/gateway/src/profile_avatar/routes.test.ts
corepack pnpm --filter @masanawa/gateway-service typecheck
corepack pnpm test:ci
corepack pnpm build
cd apps/mobile && flutter analyze && flutter test
```
Then exercise real owner A/B sessions on **disposable** PG18 with migration 0015, aged orphan restage versus sweeper, expired stage deletion, simulated S3 5xx and crash-recovery, and real authenticated Android gallery/camera + public CDN signed/immutable URL readback. Never use production customer DB or credentials to validate this.

## Remaining integration and ownership blockers

- R18/F13 as a whole stays **PARTIAL_IMPLEMENTATION / NOT VERIFIED_E2E**, not DONE: safe handle renaming still needs alias-reservation/migration and all enforcement/invitation/Twin references updated atomically; no irreversible rename shortcut. Auth/legal name is separate from public display name.
- Preserve #435's existing unmerged avatar migration and shared `app.ts`/`main.ts` edits. Compose semantically with C01 #468 (and the Work #497 integration) under designated Gateway/migration owner; no second 0015/0016 migration or in-place main/router edit from this recovery.
- F11/CI owner must repair zero-step Actions failures and run full TypeScript/Vitest, SQL concurrency, Flutter and device suite. Avatar S3 private/public origin and CDN configuration must be validated in a nonproduction environment before a reviewed merge. No provider, DB, Firebase, signing, deployment, production secrets or billing changes were made.
- Do **not** merge this PR or mark R18/F13 complete based on source or static assertions alone.

## Work ledger
- Ownership claim was repository-visible before all source changes, with expansion before touching additional paths.
- Source fixes and written tests committed/pushed on the existing PR branch; structural source readback checked.
- PR #435 remains draft/unmerged with blockers and safe integration dependencies explicitly recorded.
