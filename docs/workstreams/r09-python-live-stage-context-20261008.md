# R09 — LiveKit Python AI Seat public-stage context

- **Owner/window:** ChatGPT isolated production Python presence runtime lane.
- **Branch:** `work/r09-python-live-stage-context-20261008`; base main `f4cd25420ae24be78cddd7c3d17bdc34e0f8a060`.
- **Last update:** 2026-10-08T06:26:07.368Z.
- **Exact owned paths:** `services/presence/stage_context.py` (new), `services/presence/test_stage_context.py` (new), `services/presence/runtime_store.py`, `services/presence/agent.py`, `docs/workstreams/r09-python-live-stage-context-20261008.md`.
- **Boundary:** No edits to ongoing TypeScript R09 Stage PR #452, the R02 worker #448, AI dispatch #449, Gateway composition, schema/migrations, financial ledgers or public routes.
- **Concrete gap:** TS public-stage projection exists but bundled Python LiveKit/Gemini runtime uses persona role/bio without authorized Talk topic/Host/participant/reaction/question context. Provide a separately scoped read-only existing-table projection, bounded lower-trust per-turn model message, and independently executable pure-Python tests. Preserve per-turn seat/Host/commercial gate, no free-form raw comments/ledger balances or unsolicited audio from events.
- **Implementation:** CLAIMED. **Verification:** pending; use Python 3 stdlib unittest locally; provider/Gateway/LiveKit E2E remains unverified. 
