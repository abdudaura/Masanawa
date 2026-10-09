# RECOVERY-01 U15 Host copilot recovery — 2026-10-09

Status: PARTIAL_IMPLEMENTATION for U15. Focused repairs implemented/tested; draft/unmerged, no production/paid provider/device/APK qualification.

## Source and ownership
Window RECOVERY-01; branch work/recovery-01-u15-copilot-20261009.
Original PR #536 retained at 061b637f3386f67596ca3997b8dac5ac5b619eac (main base 5e758673ae91082520b21b3153da53791ae2cbf3).
Work #497 inspected at bb73b528862aae403a52b0fdedffd36c3f7a5674; live PR/claim refresh before work showed U02 actively owned, U04/U08 recent work, U15 unowned.
Claim RECOVERY-01-u15-20261009 CAS-published/read back on factory/claims before edits, commit 6dd73e91c058e58b03c30a30299ad78bf0f5ee0e. PostgreSQL paths added/read back before demonstrated compiler repairs (67f9d9c136588688b08988b148f7dd76472048c0).
Source repair commits 940b0623f051c87506e973b8e31945b28012a580 and cc2c34b8d336ba919b1006bc0b26a776f57c48e3. Final tested source SHA cc2c34b8d336ba919b1006bc0b26a776f57c48e3. Final handoff SHA is the commit containing this file, linked from continuation PR/notifications.
Read original U15 handoff and actual R02 worker/R09 event-context contracts. Factory and canonical continuation/reconciliation/final integration documents were already read in this recovery session; module AGENTS.md absent, existing ancestor probes absent.

## Exact changed paths
- services/gateway/src/talk_agent_live_copilot/routes.ts
- services/gateway/src/talk_agent_live_copilot/routes.test.ts
- services/gateway/src/talk_agent_live_copilot/copilot.ts
- services/gateway/src/talk_agent_live_copilot/postgres.ts
- services/gateway/src/talk_agent_live_copilot/postgres.test.ts
- docs/workstreams/recovery-01-u15-copilot-20261009.md
Original copilot.test.ts executed unchanged. No shared Gateway composer, router, R02/R09 worker, finance authority, migration, Firebase/native, CI or dependency edits.

## Implemented
Fastify default Ajv strips unknown fields before additionalProperties:false can reject them. New route-local preValidation checks original parsed body before schema mutation; tenant/user/host/payer/price/output and other extra keys are rejected before service authorization/reservation/inference. Suggestions reject unsupported query fields before stage access. Seven forged-field regressions plus query denial/valid-query transport check added.
Poll summary access now handles unchecked split element under strict TS without relaxing compiler flags.
Frozen PostgreSQL authorizer/store literals now have explicit canonical interface context, eliminating implicit-any parameters. Session fixture now supplies complete PlatformSessionIdentity with actual generated canonical IDs and profile rather than an incompatible assertion.

## Executed commands and exact limits
Isolated recovered source in /workspace/scratch/f7ee53f29a54/recovery; authenticated GitHub blobs + unchanged worker/event projection, cached actual dependencies. Node24.19.0, Vitest5.0.3, TypeScript6.0.2, Fastify5.12.5. No clean full repo/frozen installation.
- Baseline node /workspace/scratch/f0d416a1a89d/node_modules/vitest/vitest.mjs run services/gateway/src/talk_agent_live_copilot/routes.test.ts services/gateway/src/talk_agent_live_copilot/copilot.test.ts: 14 PASS,1 FAIL; forged authority request reached service after stripping and returned500.
- Final node /workspace/scratch/f0d416a1a89d/node_modules/vitest/vitest.mjs run services/gateway/src/talk_agent_live_copilot: 30/30 PASS,3 files, including all7 PostgreSQL adapter tests.
- Strict node /workspace/scratch/f0d416a1a89d/node_modules/typescript/bin/tsc --noEmit --strict --exactOptionalPropertyTypes --noUncheckedIndexedAccess --target ES2024 --module NodeNext --moduleResolution NodeNext --types node services/gateway/src/talk_agent_live_copilot/copilot.ts services/gateway/src/talk_agent_live_copilot/copilot.test.ts services/gateway/src/talk_agent_live_copilot/routes.ts services/gateway/src/talk_agent_live_copilot/routes.test.ts: PASS exit0.
- Same command adding postgres.ts postgres.test.ts: FAIL exit2, sole remaining diagnostic in cached unrelated adapters/storage/postgres/src/commerce/ngn-wallet.ts:85 missing readLatestQuoteFunding against NgnWalletRepository. All U15 baseline TS2532/TS7006/TS7031/TS2352 errors eliminated. Do NOT report full typecheck PASS. Original cached Postgres barrel imports full finance source; financial owner must reconcile it with current canonical finance source.
- GitHub source compare final source against original: ahead2/behind0; exactly5 owned source/test files; first3 source files read back byte-identical. Final all5 readback verification performed before release.
Evidence: real Fastify inject with fake auth/store/worker/SQL ports; PASS_SIMULATED, NOT canonical PostgreSQL/live Gateway/LiveKit/device/E2E.

## Canonical journey/contracts and shared patch
GET /talks/:talkId/ai-stage/suggestions accepts no query keys; authorizer supplies tenant/user, current Host and connected live state; canonical R09 authorized public events only; no private messages/finance. Return {suggestions:[{kind,prompt,trust:public-untrusted-data}]}.
POST /talks/:talkId/ai-stage/seats/:seatId/turns accepts exactly requestId and hostApprovedTranscript (bounded500). Current Host/Seat/mute/admission/commerce guard, durable acquire/hash/hour budget, sole canonical R02 worker inference and late rechecks, persisted claim completion. Return published|denied|uncertain|in_progress|budget_exhausted|conflict;202 uncertain/in-progress,429 budget,409 denial/conflict,400 malformed/extra fields. Existing service auth errors unchanged. Worker publication ACK is not audibility proof.
Same-key retry preserves unknown/running reservation; changed content conflicts; no fake success, automatic speech or new money state.

No migration changed: services/gateway/src/talk_agent_live_copilot/migration.proposed.sql remains UNREGISTERED proposal. Sole DB owner assigns order/schema after current migration audit; do not activate until reviewed.
Exact composer contract: instantiate createLiveStageCopilot with existing authenticated session/current Host authorizer, canonical seats/live repository, R09 authorized stage repository, R02 worker, createPostgresCopilotTurnStore(pool), explicit server turn cap; registerLiveStageCopilotRoutes only after migration/DB/provider qualification. No substitute authorities.
Flutter original #536 entry apps/mobile/lib/src/talk_live_copilot/panel.dart with controller/transport/models; F12/R04 mounts Host-only nested live Talk panel with real signed-in session/current Seat, reviewed transcript dialog and same-key uncertain retry. Never mount in Assistant or human Chats, no sixth tab. Source and original mobile tests preserved.

## Remaining gaps and next action
Protected composition/registration, proposed migration assignment and Host panel mount remain sole integrator dependencies. Production orphan-running/unknown claim reconciliation and retention are not implemented by this repair and cannot safely reset to replay; coordinate R02 publishing evidence/operator with integrator. Actual multi-node SQL budget/idempotency/rollback/crash proof remains open.
NOT RUN: full pnpm workspace typecheck/build/frozen install (recovered subset only); Flutter analyze/widget/transport/APK (no Flutter/Dart/Android toolchain); canonical PG18 SQL persistence/concurrency/restore, authentic API/restart/account switch, LiveKit audio/paid-seat provider and two-device audibility/Host leave/mute/reconnect (canonical DB/provider credentials/devices unavailable). No repeated hosted CI quota retries.
Next: preserve original #536; apply ONLY these two source commits/five paths to Work, reconcile canonical Postgres financial typing, run pnpm exec vitest run services/gateway/src/talk_agent_live_copilot and pnpm --filter @masanawa/gateway-service typecheck/build. Then DB owner qualifies proposal; compose exact ports and mount original Flutter panel; run flutter test test/u15_live_copilot_test.dart test/u15_live_copilot_transport_test.dart and real two-device LiveKit gates on final combined SHA.
Ownership releases after immutable notification to #497/#536; all other source/PRs retained. No merge/deploy/branch deletion/financial enablement authorized or performed.
