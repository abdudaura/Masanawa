# F13 / R18 — Avatar content-addressed staging recovery (2026-10-09)

## Five-minute exact-file ownership claim (before edits)

- Selected scope: **F13**, recovery of existing R18 avatar implementation; **not** a new competing avatar implementation.
- Canonical main inspected before claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Existing draft PR: **#435**, branch `work/r18-avatar-end-to-end-20261008`, head before claim `145da2fedeee7c9492dbf7040830d9ded7fd1faa`. Prior PR updated 2026-10-08T10:11:24Z, stale by well over five minutes as of 2026-10-09 ~01:25Z. Continue existing branch/PR; no parallel duplicate avatar code.
- Exact exclusive source files for this bounded recovery: `services/gateway/src/profile_avatar/repository.ts`, `services/gateway/src/profile_avatar/repository.test.ts`; this handoff file. **No** shared Gateway composer, router, native Firebase, migrations, wallets, media storage adapter, production systems or provider configs.
- Reviewed the 2026-10-08 reconciliation, F13 assignment, R18 #435 owner handoff, canonical main profile routes, currently open U01–U30/F implementation PR list, branch/main source and existing cleanup SQL tests.
- Root-cause candidate: `stage` reactivates a previously orphaned content-addressed row but leaves stale `created_at` unchanged. The garbage sweeper currently filters staged objects using `created_at`, permitting immediate reclaim of an object whose new upload has just begun.
- Change boundary: make staged timeout use current staging/activity age, retain durability across crashes, add focused regression tests for orphan restaging, dormant new stages and still-reclaimable orphaned/deleting objects. Avoid changing the durable storage schema/contract.
- Full R18/F13 remains **PARTIAL / NOT END-TO-END ACCEPTED**. Do not merge #435, deploy or modify production. Need independent PostgreSQL test, Vitest/TypeScript, Flutter camera/CDN and device checks before acceptance.

## Work ledger
- Claim committed before modifying the above source paths.
- Pending: source fix, regression tests, executable attempts, SHA-specific handoff, PR update.
