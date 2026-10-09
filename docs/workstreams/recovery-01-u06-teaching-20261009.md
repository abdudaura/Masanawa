# RECOVERY-01 — U06 teaching continuity recovery — 2026-10-09

Status: PARTIAL_IMPLEMENTATION for U06; bounded backend repair implemented and locally tested. Draft/unmerged. No APK, deployment or live provider claim.

## Ownership and lineage
- Window: RECOVERY-01.
- Branch: work/recovery-01-u06-teaching-20261009.
- Original source: PR #525, work/u06-teaching-continuity-20261009-gpt6 at da324917d6387f1107348d43306294e589ca2d48. Preserve original PR and all its unique Flutter/teaching source.
- Main inspected: 5e758673ae91082520b21b3153da53791ae2cbf3.
- Sole integration PR #497 inspected at current bb73b528862aae403a52b0fdedffd36c3f7a5674; its historical 874-pass source was not fully published and does not qualify this change.
- Tested/published source: a0ba3c22c1f86336d0d2e46703c230ae1d372c65. Final handoff SHA is the commit containing this document; PR link is recorded in the integration notification.
- Exact-path claim RECOVERY-01-u06-teaching-20261009 was CAS-published in factory/claims/.factory/leases.json before source editing (claim commit 91de0efcf90c02a52d3efa3cb810d76c7fa40260) and read back. Active C09 shared composer/router claim was excluded.

## Exact changed files
1. packages/skills/src/teaching_extensions/lesson_continuity.ts
2. packages/skills/src/teaching_extensions/lesson_continuity.test.ts
3. services/gateway/src/operator_learning/routes.ts
4. services/gateway/src/operator_learning/routes.test.ts
5. docs/workstreams/recovery-01-u06-teaching-20261009.md

No shared index/manifest, auth composition, app.ts/main.ts, root router, financial authority, migration, native Firebase or CI changes. No dependency changes.

## Implemented behavior
- New lesson absent checkpoint now compares as null, matching the explicit DTO; the first continue action is admitted instead of falsely failing learning.stale_checkpoint.
- Accepted action omits optional code rather than assigning undefined, preserving exactOptionalPropertyTypes.
- Normalized repository readback must match all four authorized tenant/user/character/relationship identifiers. Foreign readback is denied before dispatch or disclosure.
- GET awaits readback inside its try/catch, so asynchronous policy errors are mapped to 403 instead of escaping as 500.
- Added first-action API, removed-checkpoint, all four foreign scope boundaries and private-readback denial regressions. Existing uncertain-write semantics, canonical request IDs, no optimistic completion and no fabricated progress preserved.

## Executed evidence
Recovered original source blobs through authenticated GitHub file reads into isolated /workspace/scratch/f7ee53f29a54/recovery. Reused cached dependencies; did not mutate other windows' checkouts. Node 24.19.0, TypeScript 6.0.2, Vitest 5.0.3, Fastify 5.12.5.
Local harness exports only unchanged teaching.ts and lesson_continuity.ts for the skills package and links actual cached contracts/agents/security. This is a focused source subset, not a clean full-workspace installation.
- Baseline: node /workspace/scratch/f0d416a1a89d/node_modules/vitest/vitest.mjs run packages/skills/src/teaching_extensions/lesson_continuity.test.ts services/gateway/src/operator_learning/routes.test.ts — 9 passed / 1 failed (first lesson falsely stale).
- Baseline strict compiler reproduced TS2375 code:string|undefined against code?:string.
- Final same focused Vitest command — 14/14 PASS, 2 files.
- Final: node /workspace/scratch/f0d416a1a89d/node_modules/typescript/bin/tsc --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --target ES2024 --module NodeNext --moduleResolution NodeNext --types node packages/skills/src/teaching_extensions/lesson_continuity.ts packages/skills/src/teaching_extensions/lesson_continuity.test.ts services/gateway/src/operator_learning/routes.ts services/gateway/src/operator_learning/routes.test.ts — PASS, exit 0.
- GitHub compare original source to tested source: ahead 1, behind 0; exactly four owned source/test paths.
Tests use real Fastify inject with fake authorizer/conversation/repository; PASS_SIMULATED, not real API/DB/provider/device/E2E qualification.

## Canonical integration contract and order
No migration added. Existing packages/skills/migrations/0004_teaching_progress.sql and adapters/storage/postgres/src/skills/teaching.ts remain canonical; migration registry owner must verify installation/order.
GET /agent/learning/progress?characterId=<canonical id>: current AgentConversationAuthorizer supplies tenant/user/relationship; no-store; {state:empty|available,progress:null|TeachingProgress}.
POST /agent/learning/actions: characterId, characterSessionId, canonical requestId, action continue|practice|explain_again|simpler|slower|answer, expectedUpdatedAt string|null, optional answer only for answer. Existing AgentConversationService.turn enforces session admission and canonical idempotent request journal.
Success {state:accepted,latest}; uncertain/rejected {state,code,latest}. Dispatch acceptance is not persisted completion. 400 invalid, 403 scope mismatch, 409 stale, existing auth failures propagate to Gateway's canonical handling.
Exact shared integration patch for elected composer (do not blindly duplicate existing instances):
1. Import registerOperatorLearningRoutes from ./operator_learning/routes.js.
2. Register it only with the current authorized AgentConversationAuthorizer, existing AgentConversationService, and canonical createPostgresTeachingProgressRepository(pool).
3. Ensure canonical teaching assistant is attached to conversation turns and its existing schema is installed.
Flutter entry: existing apps/mobile/lib/src/learning/learning_progress_card.dart LearningProgressCard; GatewayLearningTransport in learning_http_transport.dart receives real authorized relationship and character session; U02 supplies stable request issuance/reconciliation. Mount within Assistant/C07 through F12, no sixth tab; discard/replace session state on logout/account switch. Preserve original #525 mobile code.

## Missing behavior, precise blockers and next action
- Shared Gateway and Flutter composition is protected by sole integrator; this repair does not register endpoints/mount learning UI.
- No full workspace frozen installation/typecheck/build, Flutter analyzer/widget tests/APK: only a recovered backend subset and cached dependencies are available; Flutter/Dart/Android toolchain is absent in this execution environment.
- No canonical PG18 persistence/races/restart/restore, real authenticated two-user API, model/provider grading, Hausa/English correctness or device speech/accessibility evidence: canonical DB/provider/device credentials and devices are not available to this isolated recovery lane.
- Last-write-wins checkpoint concurrency and model exercise association remain original U06 limitations; coordinate CAS progression with canonical DB owner, not a competing schema.
Next concrete integrator action: preserve #525 then apply ONLY these four repair paths from a0ba3c22c1f86336d0d2e46703c230ae1d372c65 (or cherry-pick that one source commit), run pnpm exec vitest run <two test paths> and package strict checks on combined SHA, compose the documented existing ports, then execute real API→teacher→PG→persisted readback and Flutter tests. Do not apply the entire source branch over Work; baseline includes original #525 history.
Unexecuted commands: pnpm --filter @masanawa/skills typecheck; pnpm --filter @masanawa/gateway-service typecheck; cd apps/mobile && flutter analyze && flutter test test/learning/learning_progress_test.dart test/learning/learning_http_transport_test.dart.

## Read order and ownership transfer
Read Factory v0.4.2 SKILL/AGENTS and operating/owner/parallel/security/release references; Masanawa CONTINUE-HERE; U/F reconciliation; final consolidation template; #497 current final handoff/manifest/PR ledger/build recovery; MULTI-WINDOW-WORK; #525 original handoff/source and canonical teaching contracts. Applicable root/nested AGENTS probes were absent.
Claim releases after final SHA-specific PR notification; ownership transfers to sole #497 integrator for integration, not feature acceptance. U06 remains partial, all original PRs retained, no merge/deploy/money/branch deletion.
