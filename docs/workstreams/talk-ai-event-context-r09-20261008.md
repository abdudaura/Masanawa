# R09 — bounded Talk event context for AI Seats

- **Owner/window:** ChatGPT R09 stage-context implementation, 2026-10-08
- **Workstream:** talks-ai-seats (R09, isolated context subtask)
- **Branch:** `work/r09-ai-bounded-stage-context-20261008`
- **Base main SHA:** `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
- **Last repository-visible update:** 2026-10-08T05:07:13.523Z
- **Claim status:** active; five-minute activity lease per `docs/MULTI-WINDOW-WORK.md`

## Exact owned paths
- `services/gateway/src/talk_ai_worker/event_context.ts` (new)
- `services/gateway/src/talk_ai_worker/event_context.test.ts` (new)
- `services/gateway/src/talk_ai_worker/worker.ts`
- `services/gateway/src/talk_ai_worker/worker.test.ts`
- `docs/workstreams/talk-ai-event-context-r09-20261008.md` (this file)

## Implementation boundary
Use a trusted server repository projection of authorized public Talk events; bound/dedupe/order context for AI turns with strict limits, redaction and human Host/live-gate. Keep comments untrusted, never a system instruction. Direct Twin remains private only to its owner's Twin. No new event store, ledger, Gateway composition, migrations or external configuration.

## Shared dependencies / status
- Existing admitted-seat and human Host worker checks must remain.
- Event repositories and production LiveKit/Gemini composition require a separately coordinated integration lane; this work will not falsely claim end-to-end deployment.
- **Implementation:** starting.
- **Verification:** not yet run.
- **Deployment/device:** not attempted.
