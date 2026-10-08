# R02 — Server live-session authority and Host resume

- Owner/window: ChatGPT R02 server lease continuation, 2026-10-08.
- Branch: `work/r02-server-session-lease-20261008`.
- Base main SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- Task references: R02 live audio; R15 live Seat authority where connected session revocation is involved.
- Exact owned paths: `services/gateway/src/talk_live/postgres_repository.ts`, `services/gateway/src/talk_live/postgres_repository.test.ts`, and this claim file only.
- Dependency: existing persisted Talk owner, single active Host unique index, room/session JWT, moderation's LiveKit server-side participant controls. No ownership of Gateway composition, migrations, app, mobile, worker, R04 participant PR, or shared readiness ledger.
- Initial evidence: persisted unique index rejects a second connected Host session, current connect always INSERTs and can fail on Host rejoin; heartbeat UPDATE permits a previously disconnected session to become connected; media-token issuance reuses heartbeat and inherits this defect. Need atomic Host replacement, fail-closed terminated session, tests and production qualification.
- State: CLAIMED; implementation and test execution pending, deployed/device NOT verified.
- Last repository-visible activity: claim commit (2026-10-08 UTC). Refresh during work.
