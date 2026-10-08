# R02/R19 — AI Seat turn fencing and role continuity

- **Window/owner:** ChatGPT AI turn-safety integration window, 2026-10-08.
- **Branch:** `work/r02-r19-ai-turn-fencing-20261008`
- **Base main:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
- **Task:** R02 P0 in-flight live AI audio safety; R19 P1 turn-taking and persona role continuity.
- **Owned paths (exact):** `services/gateway/src/talk_ai_worker/worker.ts`, `services/gateway/src/talk_ai_worker/worker.test.ts`, `docs/workstreams/r02-r19-ai-turn-fencing-20261008.md`.
- **Excluded:** talk_live server leases (#439), platform persona bootstrap (#441), R15 paid persona safety (#443), all Gateway composition/migrations, Flutter and financial paths.
- **Current step:** claim published; recheck ownership before editing, then implement latest-human-turn fencing, identity/seat continuity and regression tests.
- **Last repository-visible update:** 2026-10-08T06:09:00Z (initial claim; subsequent commits are authoritative).
- **Implementation:** NOT STARTED at claim.
- **Verification:** NOT RUN at claim. Local TS/Node regression where feasible; full monorepo Vitest/typecheck, LiveKit/Gemini and two-device acceptance explicitly separate.
- **Deployment:** NOT ATTEMPTED; only integration owner may deploy.
- **Dependency:** Production provider/audio publication must obey supplied AbortSignal for interruption; a stopped media publisher cannot unspeak frames already emitted.
- **Handoff:** Pending implementation, tests, review and PR.
