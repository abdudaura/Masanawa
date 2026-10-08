# R09 moderated public Talk comments in AI stage context — 2026-10-08

Owner/window: ChatGPT R09 bounded context lane.
Branch: `work/r09-moderated-comments-stage-20261008`. Base main SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
Claim created 2026-10-08T06:12:34.594Z.
Exact owned files: `services/gateway/src/talk_ai_worker/postgres_stage_repository.ts`, `services/gateway/src/talk_ai_worker/postgres_stage_repository.test.ts`, `docs/workstreams/r09-moderated-talk-comments-20261008.md`.
Task: R09 P1 stage events gap — PostgreSQL authorized stage currently intentionally omits all comments despite projector support for explicitly moderated public comments. Add bounded read of only comments explicitly approved with safety_enforcement visibility='public', respecting topic, tenant, Talk, author block preference, event age and ordered budgets. Do not expose ordinary unreviewed public comments, private status, hidden reports, user financial state or client messages. Write regression tests against exact SQL and projection.
Active PR collision check: none across exact paths. Does not claim voice model admission, gifting stage settlement, or full R09.
Verification currently unrun; no local checkout/CI runners working, do not merge unverified.
