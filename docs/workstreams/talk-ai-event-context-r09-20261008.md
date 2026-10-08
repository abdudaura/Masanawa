# R09 — bounded Talk event context for AI Seats

- **Owner/window:** ChatGPT R09 stage-context implementation, 2026-10-08
- **Workstream:** talks-ai-seats (R09, isolated context subtask)
- **Branch:** `work/r09-ai-bounded-stage-context-20261008`
- **Base main SHA:** `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
- **Last repository-visible update:** 2026-10-08T05:12:29.467Z
- **Claim status:** active; five-minute activity lease per `docs/MULTI-WINDOW-WORK.md`

## Exact owned paths
- `services/gateway/src/talk_ai_worker/event_context.ts` (new)
- `services/gateway/src/talk_ai_worker/event_context.test.ts` (new)
- `services/gateway/src/talk_ai_worker/postgres_stage_repository.ts` (new)
- `services/gateway/src/talk_ai_worker/postgres_stage_repository.test.ts` (new)
- `services/gateway/src/talk_ai_worker/worker.ts`
- `services/gateway/src/talk_ai_worker/worker.test.ts`
- `docs/workstreams/talk-ai-event-context-r09-20261008.md` (this file)

## Implementation boundary
Use a trusted server repository projection of authorized public Talk events; bound/dedupe/order context for AI turns with strict limits, redaction and human Host/live-gate. Keep comments untrusted, never a system instruction. Direct Twin remains private only to its owner's Twin. No new event store, ledger, Gateway composition, migrations or external configuration.

## Shared dependencies / status
- Existing admitted-seat and human Host worker checks must remain.
- Event repositories and production LiveKit/Gemini composition require a separately coordinated integration lane; this work will not falsely claim end-to-end deployment.
- **Implementation:** PARTIAL. Added server-authorized, bounded, deduplicated 10-minute stage projection (max 16 events, 6 participants), human-turn-only worker context port, and read-only PostgreSQL adapter using existing Talk/seat/participation/question/poll tables, including safety visibility check. No schema or settlement changes.
- **Verification:** new focused Vitest tests authored for projection privacy, boundedness, tenant/Talk isolation, moderation/settlement gating, stage repository SQL, worker admit/Host gate, and fail-closed error propagation. Tests/typecheck **not executed** (repository is connector-only here; recent GitHub runners failed before execution). Must run `pnpm exec vitest run services/gateway/src/talk_ai_worker` and `pnpm --filter @masanawa/gateway-service typecheck` in an equipped runner before merge.
- **Deployment/device:** NOT ATTEMPTED; no live DB or LiveKit/Gemini credentials used.
- **Integration remaining:** production worker must be composed with `createPostgresTalkAiStageEventRepository(pool)`, approved event metadata must be converted to bounded low-trust model context rather than a system instruction, and latest Host/Seat authorization checks retained. Existing agent worker remains a provider-neutral port; this PR does not prove LiveKit/Gemini playback.
- **R09 remaining:** authoritative moderated comment publication, settled gift public-event bridge, safe actor/target visibility checks, departures/declines/directives/poll results, deduplicated event replay across reconnect, complete privacy/red-team/event-storm tests, real-device/production acceptance.
- **No collisions:** current R01/R02/R03/R04/R05/R11/R12/R16/R17 PRs own different paths. Refresh current claims before composing shared Gateway runtime; integration owns shared app/worker registration paths.
- **Release status:** R09 is PARTIAL, not DONE. Do not label production event awareness complete.
