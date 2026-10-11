# QUALITY profile API recovery

Owner/window: quality-profile-authority-20261011-cloud. Claim time: 2026-10-11 UTC.
Branch: lane/quality-profile-authority-20261011.
Base: a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d (fresh main after #668).
Exact paths: services/gateway/src/talk_profile_routes.ts,
services/gateway/src/talk_profile_routes.test.ts, this record.

## Narrow stale ownership recovery

Registry claim af06-pr497-chat-list-async-action-lifecycle-20261010085813 expired
2026-10-10T09:32:12.915Z. Branch work/af00-root-navigation-20261010-masanawa01-c
last commit 3c0e88489baa7b5ad99dff66e69325f23937f086 is dated 2026-10-10.
Inspected its exact two profile paths: fixture readback correction and raw-body
rejection via strict_request_body helper. Preserve the branch and all remaining
claimed paths. Transfer only the two profile paths to this Quality window.
Reuse equivalent complete profile changes from continue-chat-reliability-20261011
at 40bf774de (inline validation, no extra helper dependency). No subsystem rewrite.
The claims script refuses stale ownership; this visible recovery record precedes
a narrow compare-and-swap registry transfer and new claim/readback.

## Reproduced evidence and next action

Node 24.19.0 / pnpm 12.8.2; frozen install PASS with lockfile untouched.
Main pnpm test:ci: 24 failed, 1154 passed, 143 skipped, 2 EPERM listen errors.
Profile suite: two FAIL (stale readback and forged body accepted with HTTP 200).
Main pnpm typecheck: FAIL TS2459 packages/agents/src/talk-replay.test.ts imports
non-exported TalkId. Reserved by another unreleased stale claim; no edit here.
Next: acquire/read back exact claim, recover profile fix, execute HTTP denial,
mutation/readback tests, push checkpoints and scoped PR for coordinator.
State: PLANNED. Production/device/provider verification NOT_RUN.
No calls/status/rooms/auth/financial/shared composition edits.

## Source delivery and durable handoff

Claim acquired and read back ACTIVE: 0b6a32c4-3780-4e80-8978-daf0b3712bde;
registry CAS transferred only the two inspected expired paths. Preserved all
other owners and source branches. Implementation head: 4e6da77a2
(use git rev-parse 4e6da77a2 for full SHA). Changed paths are the three claimed
paths above; manifests, lockfiles and protected composition remain untouched.

Closed checklist:
- SOURCE_CHECKED: raw PUT/PATCH fields rejected before Fastify strips unknowns.
- SOURCE_CHECKED: authenticated self-read fixture returns actual persisted edits.
- SOURCE_CHECKED: each forged userId/tenantId/avatarUrl is denied without mutation
  or profile creation; subsequent valid edit/create succeeds with correct readback.
- Existing authentication, owner fencing, avatar-removal contract and 201 creation
  behavior retained. Reused existing continuation changes, added recovery tests.

Executed on Node 24.19.0 / pnpm 12.8.2 at implementation head:
- `pnpm install --frozen-lockfile --store-dir /tmp/masanawa-pnpm-store`: PASS_REAL,
  pinned dependency install; no tracked dependency changes.
- `pnpm exec vitest run services/gateway/src/talk_profile_routes.test.ts services/gateway/src/talk_profiles/profile_edit_postgres.test.ts`:
  2 files, 16 tests PASS_SIMULATED. Real Fastify injection + SQL query doubles;
  NOT a real PostgreSQL/storage/provider/device end-to-end run.
- `git diff --check`: PASS.
- Broader profile run: 19 PASS / 2 FAIL, both existing
  talk_profiles/postgres_repository.test.ts follow-authority fixtures. This file
  remains reserved in the recovered AF06 claim; explicit transfer needed.
- Fresh main root `pnpm typecheck`: FAIL TS2459 TalkId test import. Gateway-only
  typecheck: FAIL inherited dependency declarations and numerous test typings.
  Strict checks were not relaxed. Root `pnpm test:ci` baseline: 24 FAIL, 1154 PASS,
  143 SKIP, 2 EPERM local-listener errors. Full suite not claimed green.

Integration: coordinating window should review/cherry-pick 4e6da77a2 into its
single non-deploying baseline, or merge the scoped PR after its normal checks.
No automatic main merge: main has Git-linked deployment/migration hazards in
existing handoffs. No migration, env or composition change needed for this fix.
Re-run the two focused suites on the unified integration SHA.

Remaining QUALITY milestone: reserved compiler/fixture failures and broader
canonical API lifecycle recovery from continue-chat-reliability-20261011 must be
reconciled by exact-path owners. Next action: transfer/resume TalkId test import
and existing recovered compiler fixes, then execute root typecheck/tests/build.
Do not rerun retired creator onboarding to restore it; #668 product retirement
prevails. Profile upload/replacement source from existing R18 branch still needs
separate source reconciliation and composition; this Quality patch does not
claim that PROFILE-PHOTO lane complete.

Status: scoped source SOURCE_CHECKED; integration PENDING; production/device/
signing/provider/real DB/storage NOT_RUN. Flutter/Dart/Android and Mac signing
runners are absent here. No deployment, production migration, paid resource or
external message was performed.
