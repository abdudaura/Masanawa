# U15 — On-stage AI copilot activity claim

- **Claim/owner:** GPT-6 independent U15 window, 2026-10-09 (Africa/Lagos); five-minute activity lease governed by `docs/MULTI-WINDOW-WORK.md`.
- **Branch:** `work/u15-safe-live-stage-copilot-20261009-gpt6`; **base:** `5e758673ae91082520b21b3153da53791ae2cbf3`; **status:** CLAIMED / PARTIAL_IMPLEMENTATION; **deployment:** NOT DEPLOYED; **verification:** NOT YET EXECUTED.
- **Task:** U15 bounded live-stage AI suggestions and turn admission, R02/R09/R15 safety and LiveKit contracts. Reuse existing `talk_ai_worker` authoritative event projection and seat/live state, do not replace it.
- **Exclusive paths for this claim:** `services/gateway/src/talk_agent_live_copilot/**`, `docs/workstreams/u15-live-talk-agent-copilot-20261008.md`. No shared composer, migrations, wallet, worker, or root Flutter files.
- **Related source:** #459 R09, #448/#449/#456 R02, C07 #480; tested/canonical from latest `main` only, integration awaits designated Gateway and media owners.
- **Current step:** implement fail-closed host/seat-gated optional suggestions, quota/idempotency stage decisions, and executable negative tests; report what remains uncomposed.
- **Dependencies:** authorized LiveKit/source transcriptions, authoritative host identity/seat/live policy, actual AI runtime, persisted quota/turn claims and final shared composition by R02/R09/F02/F04. Do not auto-admit/charge/publish.
- **No conflicts claimed:** searched live U15 PRs, issues and U15 branches (none at claim); will stop conflicting edits if a fresher claim appears.
