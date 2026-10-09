# R03 — Interrupted Gwani/Gwana default support bootstrap recovery (2026-10-08)

- **Owner/window:** ChatGPT, isolated R03 support bootstrap lane.
- **Branch:** `work/r03-support-seed-recovery-20261008`, draft PR #441.
- **Base main:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Last repository-visible activity:** 2026-10-08T06:01:25.393Z.
- **Exact owned paths:** `services/gateway/src/platform_agent_bootstrap.ts`, `services/gateway/src/platform_agent_bootstrap.test.ts`, this note.
- **No shared changes:** migrations, Gateway composition, Talk AI Seat eligibility, pricing, runtime voice, package contracts, canonical ledger and mobile code unchanged.
- **Status:** CODE IMPLEMENTED / TEST CASES AUTHORED / RUN NOT VERIFIED / DEPLOYMENT AND AUDIO NOT QUALIFIED. Lease released; R03 remains PARTIAL.

## Discovered and corrected

Existing startup returned immediately when it found any support profile, even after partial provisioning: a recovered Gwani profile meant Gwana was permanently omitted. New bootstrap conservatively resolves existing profile IDs against visible canonical presentations and repairs only the absent canonical identity. It refuses to convert a noncanonical admin roster, duplicate/ambiguous support profile, hidden presentation or same-name admin specialist. Existing voice selections, presentation content, revisions and chosen default remain unchanged; if Gwana is already the admin default the newly completed Gwani is not made a second default. A matching canonical presentation left before profile creation is reused instead of creating a duplicate Character.

The original full Gwani+Gwana empty-tenant bootstrap behavior remains; new recovery never alters the other 15 planned experts or creates unqualified paid Talk AI Seats.

## Authored tests and verification state

- `00503bcf3d5bd3b77e0024bc2fd81e02b4c4daa8` — conservative interrupted-seed algorithm.
- `9a9f73f6af279a36ecd8d1d6d796aa1637b708e7` — partial support, admin default/voice, hidden presentation cases.
- `d95e96b9c86c0844e520bae6699ee7d9303ab5fd` — missing-profile presentation reuse and same-name admin specialist regression tests.
- Readback checked modified source and **7 authored Vitest cases** total in the existing suite. This is source inspection, not successful unit or integration execution.
- Foundation CI workflow #37735371016 completed **failure**, with job steps empty and log fetch returning a 404 BlobNotFound. This did not execute tests or reveal a code failure. The earlier run #37735324997 was also observed with zero steps. The remote workflows consistently fail before job steps, and this environment has no checked-out repository or installed Node 24/pnpm 12 dependencies. **Do not claim passing typecheck/test/build.**

## Required follow-on work

1. Recheck current main/PR conflicts; run `pnpm exec vitest run services/gateway/src/platform_agent_bootstrap.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, repository tests/build and a PostgreSQL tenant bootstrap integration test in an executable environment.
2. Prove concurrent duplicate-startup safety under a durable tenant-scoped lock; this small recovery patch does not add a distributed provisioning lock, so do **not** mark initialization fully production-qualified.
3. Add the remaining **15** canonical AI Experts with stable seed keys, profile/voice suitability and readiness; preserve admin customizations, verify supported provider audio/role on devices, and gate paid public AI Seat admission on real provider/worker availability.
4. Qualify Gwani Bodi / Gwana Sulafat voices against actual Gemini Live backend and multilingual interruptions; no assumed availability or model credentials are supplied.
5. Leave R03 PARTIAL until complete staged/live acceptance. Keep PR #441 draft and unmerged pending executable test/production qualification.

## Reclaim — 2026-10-08T11:38:00Z (UTC)

Previous window's last repository activity was 06:01Z and its handoff explicitly released the lease. Reclaim only its existing draft PR #441 and preserve its Gwani/Gwana recovery changes. New exact owned paths: `services/gateway/src/platform_agent_bootstrap_lock.ts`, `services/gateway/src/platform_agent_bootstrap_lock.test.ts`, additive bootstrap-lock seams in `services/gateway/src/main.ts`, and this handoff. The `main.ts` edit is a tiny additive producer/caller change and must be semantically reconciled with C01 #468, R18 #435 and any newer shared Gateway composer edits before merging. No other window's source will be overwritten. New base remains original PR base; current main at inspection `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. Priority: prove cross-replica mutual exclusion around current persisted identity/assignment/profile sequence and failure recovery. Status: **PARTIAL_IMPLEMENTATION** pending source and executable integration proof.



## 2026-10-08 11:45 UTC — Atomic R03 Gwani/Gwana bootstrap checkpoint (reclaimed PR #441)

**Status:** Narrow `R03/Gwani-Gwana bootstrap atomicity` source slice = **IMPLEMENTED_UNVERIFIED** (proposed, **not** verified); full **R03 = PARTIAL_IMPLEMENTATION**, NOT DONE. Owner: this ChatGPT repository window. Five-minute claim reclaimed from the prior 06:01 UTC explicit release; lease released upon this checkpoint and PR remains draft/unmerged.

### Baseline / ownership / compatibility

- Main HEAD observed at claim: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3` (2026-10-08T11:22:07Z). Existing PR #441 originally based on `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`; do not infer it is rebased onto main.
- Branch: `work/r03-support-seed-recovery-20261008`; PR: https://github.com/Baatiku/masanawa/pull/441; final pushed branch HEAD **must be read from the PR/branch after this handoff commit**, and every tested/rebased SHA recorded by Work.
- Exact changed/new paths in this window:
  - `services/gateway/src/platform_agent_bootstrap_postgres.ts`: tenant-scoped PostgreSQL transaction/advisory lock; all canonical identity creation, ownership, version activation, presentations, skills and support profile writes share the **same** DB transaction client; authoritative readback before commit.
  - `services/gateway/src/platform_agent_bootstrap_postgres.test.ts`: lock timeout/scoping/failure unit assertions and disposable PostgreSQL integration tests for concurrent replicas, rollback after injected late failure, restart replay, tenant isolation.
  - `services/gateway/src/main.ts`: default DB bootstrap capability, fail-closed configuration and startup, no unprotected fallback; removed obsolete unprotected identity writer; close DB on bootstrap failure.
  - `services/gateway/src/main.test.ts`: fail-closed startup prerequisite regression.
  - `docs/workstreams/r03-support-seed-recovery-20261008.md`: this durable checkpoint.
- Prior unchanged #441 source: `platform_agent_bootstrap.ts` and `platform_agent_bootstrap.test.ts` preserve conservative recovery and admin/voice/default customization semantics (7 tests authored before reclaim).
- Owned scope intentionally adds **no new migration, table, financial schema, public API, screen, or mock**: uses the existing `identity.characters` and versions, `agents.agent_presentations`, `agents.character_skill_assignments`, `agents.platform_agent_profiles`, `skills.distribution`, and existing authenticated directory/Flutter `agents` consumer. Startup is admin-controlled configuration, not a new untrusted client action. The existing typed authorized `AgentDirectoryService` provides post-bootstrap application projection.
- **Competing/shared branch warning:** `main.ts` also appears in R18 #435, C01 #468 and possibly newer Gateway compositions. Merge or rebase **semantically** and preserve all other route/service registrations. Do not overwrite another branch's `main.ts`. C02 #472/#475, C05 #474/#476, C03 #473/#483 are parallel duplicate-resolution tasks, outside this claim.

### Concrete behaviors covered in source

- Two Gateway replicas initializing the **same active tenant** serialize via `pg_advisory_xact_lock` on a tenant-specific key *before* reading its support roster.
- Database writes for provisioning are transactional; PostgreSQL error, lock timeout, client disconnection or late profile insertion failure rolls back **all** new identity/version/presentation/skill/profile writes; next attempt safely re-runs the existing conservative bootstrap rather than publishing a half-pair. The lock is released by commit/rollback, not a lingering pooled session lock.
- Existing admin-owned profiles, intentional hidden same-name entries, admin voice choice and default do not get clobbered by the pre-existing algorithm. No duplicate or second default is intentionally introduced.
- Gateway refuses `MASANAWA_BOOTSTRAP_PLATFORM_AGENTS=true` without the configured tenant, OTP customer-auth prerequisites, canonical DB dependencies and the atomic PostgreSQL provisioner; it closes DB on failure and does not serve a falsely initialized runtime.
- The existing authenticated agent directory route and Flutter catalog read canonical persisted IDs, names and profile metadata without a special bootstrap UI. This does **not** assert actual Gemini/LiveKit voice or paid-Seat readiness.

### Verification: authored != executed

- **Executed**: connected GitHub source readback/PR changed-path inspection; GitHub accepted commits listed in branch history and returned committed SHAs. This verifies that code is pushed, **not** that the code compiles, tests pass or that Postgres/Flutter/app works.
- **NOT executed:** `corepack pnpm install --frozen-lockfile`, `pnpm --filter @masanawa/gateway-service typecheck`, `pnpm exec vitest run services/gateway/src/platform_agent_bootstrap.test.ts services/gateway/src/platform_agent_bootstrap_postgres.test.ts services/gateway/src/main.test.ts`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build`, and Flutter analyzer/widget tests. No isolated Node 24/pnpm 12 repository checkout, runner job steps or real Android here. GitHub Actions quota incident #457 is externally confirmed (no runnable job steps); do not waste rerun quota or report PASS.
- **NOT executed:** live PostgreSQL 18 race/rollback integration. `MASANAWA_TEST_DATABASE_URL` must point to a throwaway admin test server with `CREATE DATABASE` privilege; the optional test creates only `masanawa_r03_<uuid>` then drops it. Do not put real credentials into committed files, run against Railway production, or promote skipped tests to PASS. Cross-process two-replica server-start test, signed-in app directory reload, Android device, voice Bodi/Sulafat, real LiveKit/Gemini inference and recovery similarly unexecuted.
- New authored test cases: 3 lock-unit + 3 database integration + 1 Gateway startup = **7**, atop the 7 earlier support-seed cases (source presence only). These tests are **not** execution evidence.

### Security, recovery, operational and release gates

- Tenant scope for lock and repositories is derived server-side from validated `MASANAWA_PLATFORM_TENANT_ID`; clients cannot request bootstrap, pass different tenant IDs, make default changes or provision another person's Character via this startup function. Account operations and agent catalog authorization remain in existing server authorizers, not this patch.
- Race isolation uses an xact lock; no migration required because existing canonical identity/agents/skills tables support it. Restore/backup under `docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md` must be qualified before any production rollout. Lock waits are bounded; review DB privileges, migration state and readiness before enabling a bootstrap flag.
- **Missing implementable R03 source** beyond this narrow recovery: provision, characterize, configure safe qualified voices, stable keys and admin reconciliation for **15 additional approved Experts**; operational readiness/availability/AI Seat admission; all 17 persona characteristics; R02/R04/R09 runtime, R17/C08 final screen integration. This R03 task remains **PARTIAL_IMPLEMENTATION**, even though the smaller bootstrap-safety code slice was authored.
- **Gates:** SOURCE_WRITTEN **yes (narrow slice only)**; LOCAL_TESTED **no**; CI_EXECUTED **no**; DB_INTEGRATED **unverified**; APP_INTEGRATED **unverified**; DEVICE_VERIFIED **no**; PROVIDER_QUALIFIED **no**; DEPLOYED **no**; MERGED **no**. Whole-R03 DONE **no**.
- Traceability: **R03**, **N05**, **A** persona coverage in `OWNER-REQUIREMENTS-TRACEABILITY-20261008.md`, J01/J06/J07/J11. No money or DM-authority modification.

### Reproducible single ChatGPT Work integrator instructions

1. Fetch live main, list/compare PR #441 to current main, #435/#468 overlapping `main.ts`, any newer R03 owner and issue #457, preserving all branch history. Record the final PR head and (post-rebase) test SHA.
2. Reconcile shared Gateway composition without dropping either avatar, contacts or bootstrap registrations. Review exact TypeScript types in `platform_agent_bootstrap_postgres.ts` and migration/precondition ordering. Do not force-push another active owner's claims.
3. With Node 24/pnpm 12, run install, Gateway typecheck, focused Vitest, full typecheck/tests/build. Attach exit status/logs and fix any failures on a reviewed branch; NEVER mark a mocked PostgreSQL-only test as real DB proof.
4. With an isolated PostgreSQL 18 server and permission to CREATE/DROP a dedicated test DB, run `MASANAWA_TEST_DATABASE_URL=<secret> pnpm exec vitest run services/gateway/src/platform_agent_bootstrap_postgres.test.ts`. Verify migration order, two independent pooled connections, late-failure rollback, retry and cross-tenant isolation; sanitize log output.
5. Run two Gateway instances with startup flag and real tenant/auth repository wiring against a **safe backup/restore-qualified staging database**; validate one canonical pair, one default, proper support-only profiles, actual signed-in `GET` agent directory at authorized API endpoint, Flutter catalog readback and restart. Confirm admin modifications are not overwritten and no duplicate IDs; test failure/cancel/recovery.
6. Qualify real Gemini Bodi/Sulafat/AI Seats on Android and complete remaining 15 Expert implementations in a separately claimed non-overlapping R03 scope. Do not ship source-only status; leave PR draft/unmerged until full applicable verification and review.

**Rollback:** Stop the bootstrap flag/deploy before any new seed; revert Gateway code if staging tests fail. Atomicity means no partial transaction should commit, but **already committed** identity/profile rows are durable; never delete them blindly. No production mutation or user funds were touched by this PR.


### Post-check next-lane scan (2026-10-08 11:47 UTC)

Re-read live `main` `1d6a67ea3c182455b55a7d1d07eacdb4311682e3` and 40+ open PRs after this source push; newly visible C06 #487 (crypto transfer ledger), C03 #486 (journal retention), R15 #488 (provider safety), R16 #485 (disposable migration guard) add to existing C01 #468, C02 #472/#475, C03 #473/#483, C04 #478, C05 #474/#476, C07 #480, R18 #435 and shared CI #460 claims. The C08/R17 shell is a **single-owner integration dependency**, not an independent safe opportunistic override. **No second overlapping lane claimed**: further uncoordinated edits would conflict with still-active draft branches; complete R03 roster/runtime work needs a distinct fresh claim and working provider/Android integration. This is a new-scope collision scan, not an assertion that all other product backlog tasks are completed.
