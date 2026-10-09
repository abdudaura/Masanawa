# R02/R19 — AI Seat turn fencing and role continuity

- **Window/owner:** ChatGPT AI turn-safety integration window, 2026-10-08
- **Branch:** `work/r02-r19-ai-turn-fencing-20261008`
- **Base main:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
- **Task:** R02 P0 AI-audio turn interruption/host-safe publish; R19 P1 persona continuity.
- **Exact owned paths:** `services/gateway/src/talk_ai_worker/worker.ts`, `services/gateway/src/talk_ai_worker/worker.test.ts`, this workstream file.
- **Other windows:** No changes to R02 live-session lease PR #439, R03 support-bootstrap #441, R15 persona safety #443, any shared Gateway composition, migration, Flutter or finances.
- **Repository-visible work:** branch commits `44b63f4` (claim), `0bde4ee` (safety), `e70e8b4` (race tests), `86f1085` (deterministic test), `4075c5b` (reentrant abort ordering). Latest status at this checkpoint: 2026-10-08 UTC.
- **Status:** IMPLEMENTED IN BRANCH; NOT TEST-VERIFIED, NOT MERGED, NOT DEPLOYED.

## Implemented

1. Each authorized tenant/Talk/Seat tuple owns at most one current human-triggered inference. A later request aborts the prior AbortSignal **before initial async admission completes**, during stage fetch or during inference; stale results cannot publish. Other Seats remain independent. Installing the replacement before abort avoids reentrant abort-listener clobbering.
2. Repository Seat projections are checked against the requested tenant, Talk and Seat ID before inference. Reject inconsistent adapters fail closed rather than exposing cross-tenant stage/audio.
3. Re-check the fresh authorized Seat after inference and reject an in-flight response if the persona ID or Seat kind changes, even if both old/new Seats are admitted and funded. Existing Host-live, muted/removed and commerce state gating is retained.
4. Keep canonical Talk lifecycle, public stage visibility and user-confirmed paid admission unchanged; no fake audio provider or unsupported mobile endpoint.
5. Added six focused Vitest regressions for: same-Seat preemption, preemption during initial repository read and stage load, wrong tenant/Talk/Seat, persona/kind reassignment, independent-Seat parallelism. Existing stop test now waits deterministically for model entry before testing cancellation.

## Evidence and remaining gates

- **GitHub source review:** Changed only three listed owned files; no conflict with current PR #439/#441/#443 filename sets at claim time.
- **Tests:** Test cases authored but **NOT EXECUTED**. The container has Node 22 and TypeScript CLI, but no pnpm or Vitest, and GitHub clone cannot resolve github.com. Do not represent these as passing.
- **Needed before merge:** `pnpm --filter @masanawa/gateway-service typecheck`, `pnpm exec vitest run services/gateway/src/talk_ai_worker/worker.test.ts services/gateway/src/talk_ai_worker/event_context.test.ts`, all required PR CI, and review of the runtime adapter honoring AbortSignal. If GitHub Actions records zero job steps, this is an infrastructure/runner blocker, not a passing test.
- **Required production qualification:** deployed AI worker composition, actual LiveKit participant audio cancellation/publish semantics, interruption and barge-in across two signed-in phones, reconnect/Host departure, simultaneous human turns and configured Gemini provider/voices. None tested here.
- **Limits:** per-process in-flight cancellation is not a distributed, durable sequence fence across multiple worker instances. Provider playback already emitted cannot be recalled simply by aborting the JS signal. R02 live-audio release and R19 17-persona performance remain PARTIAL; this PR is not a production completion claim.
- **Next owner:** run and repair typed tests, verify audio adapter cancellation and worker deployment, then merge only if clean. Another independent lane may continue on other paths; do not edit this branch concurrently while actively owned.
