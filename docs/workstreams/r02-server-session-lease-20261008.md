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

## Checkpoint — server authority correction (2026-10-08 UTC)

- Implementation commit `26f3ce9530ed160f8423fd7c7bc094e59d4ae1e9`: reject disconnected heartbeat/media-token renewals; treat persisted ended Talks as terminal even with stale runtime projection; atomically replace only the *same owner* Host session with a fresh session ID using existing partial unique index.
- Regression commit `7320cae9fcfc1419f088d5bd3071759694e3e9db`: five focused Vitest cases for Host takeover index SQL, listener independence, revoked heartbeat, ended Talk and corrupted owner mismatch.
- Code: COMMITTED on draft PR #439. Focused Vitest/typecheck/Postgres integration: **NOT RUN**. GitHub Foundation CI run `37734978282` reports **failure before any recorded job steps**, with no downloadable job log (404 BlobNotFound). Do not call this a verified test failure or a pass.
- Deployment and paired real-device audio: **NOT RUN**. Existing LiveKit room participants with a superseded identity may require explicit server-side eviction/revocation; JWT/session revocation does not itself kick already-connected participants. Coordinate with integration's LiveKit admin and participant-state lanes before production merge. Session replacement uses an atomic partial-index UPSERT, but real PostgreSQL index inference and concurrent Host takeover still require actual DB integration tests.
- Handoff: keep PR draft and do not merge until executable CI + PostgreSQL concurrency tests, LiveKit participant eviction policy and authenticated Host reconnect/remote audio tests pass. R02 remains OPEN/UNVERIFIED. No unrelated paths changed.

## Authorized bounded expansion — terminal API error classification

- Fresh collision check: PRs #442/#440/#438/#436/#435/#433/#430/#426 do not own `services/gateway/src/talk_live/service.ts` or `services/gateway/src/talk_live_routes.test.ts`.
- Add these two exact paths to this R02 claim to classify the existing `talks.live.ended` repository domain rejection as HTTP 409 rather than a generic HTTP 500, with an API-level regression. Do not touch app.ts, routes registration or unowned worker/mobile files.
- This is a source/API error contract improvement only; not paired-device readiness.

### Terminal join error checkpoint

- `45c371e2`: maps the repository's persisted-ended domain rejection to `TalkLiveError(code=\"talks.live.ended\",statusCode=409)`. Unknown database/transport faults still propagate as HTTP 500; session authorization remains first.
- `57d59f1c`: Fastify injection regressions for authenticated ended join 409, unauthenticated join 401 and unrelated storage error 500.
- Status: committed, **not locally executed or merged**. Follow-up check: `pnpm exec vitest run services/gateway/src/talk_live/postgres_repository.test.ts services/gateway/src/talk_live_routes.test.ts`, Gateway typecheck and Postgres/LiveKit integration.
