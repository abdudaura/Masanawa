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

## Authorized bounded expansion — LiveKit Host takeover eviction

- Collision check on fresh open PR path lists: #445, #444, #443, #442, #441, #440, #438, #436, #435, #433, #430 and #426 do not touch `services/gateway/src/talk_live/livekit_media.ts` or `services/gateway/src/talk_live/livekit_media.test.ts`.
- Added exact ownership of those two files. The issuer is already wired to production `main.ts` using the configured LiveKit URL/key/secret, so cleanly extend the existing authoritatively authenticated token path without editing the R18-owned Gateway composition.
- Before issuing a replacement human Host media credential, enumerate currently connected room participants using LiveKit `RoomService.ListParticipants` and remove previously issued session-scoped identities belonging to the same Host. Never evict another person or the current lease. Require successful RoomService validation or fail closed; an absent room is a distinct handled case. Validate service authorization and ensure controlled token cleanup on LiveKit Cloud where supported.
- Tests must cover old-Host removal, first room absence, other-user isolation, malformed replies and server errors; external real LiveKit/handset qualification is still outstanding.

## Integration test path claim

- Add `services/gateway/src/talk_live/postgres_repository.integration.test.ts` for real PostgreSQL index, owner/tenant isolation, concurrent Host replacement and old-session heartbeat/disconnect safety using existing talks migrations. Test is gated by `MASANAWA_TEST_DATABASE_URL`; never hit production DB.
- No other active PR owns this new file. Do not edit migrations or shared database registry.

## Host media authority hardening checkpoint — 2026-10-08

- `4d7c94b5` + `a52a3a4d`: LiveKit token issuer uses existing configured LiveKit RoomService credentials. For each Host (including muted Host), it lists connected participants in the exact Talk and evicts stale identities with the same authenticated Host prefix before minting the new lease token. Handles a missing room, empty repeated protobuf field, duplicate participant projection, and concurrent participant departure; malformed service data or failed admin authorization/remove fails closed. RoomService requests timeout after five seconds.
- `98ff4cad` + `9bf52428`: tests authored for Host-only eviction, mixed unrelated users, no room, clean room, first connection, muted Host, failed List/Remove, JWT RoomService HMAC grant, and removal race.
- `4a0c2042`: surface RoomService dependency failure as retryable `talks.live.media_unavailable` HTTP 503 instead of leaking a new JWT or representing a provider outage as opaque 500.
- `378b4cba` + `58e76691`: re-read authenticated session authority after asynchronous RoomService work; if a concurrent Host session superseded it, return 409 `talks.live.session_changed` without exposing signed credentials. This handles a verified server-side issuance race but does not remove tokens previously delivered.
- `28820289`: real-PostgreSQL integration suite added, gated by `MASANAWA_TEST_DATABASE_URL`, uses the existing canonical talks migrations; asserts partial unique index takeover, concurrent replacement, rejected previous heartbeat/disconnect, tenant isolation, terminal Talk behavior. Does NOT modify production DB or schema.
- **Release status: PARTIAL / UNVERIFIED.** No executable workspace Vitest/typecheck or test PostgreSQL, no production LiveKit API, and no paired handset connection. CI runners have repeatedly reported failures with no recorded steps. On self-hosted LiveKit, RemoveParticipant disconnects an active participant but cannot necessarily revoke a previously issued JWT until its bounded TTL expires; LiveKit Cloud supports the revocation timestamp. Audit the concrete deployment behavior and consider room-level participant admission enforcement before declaring complete security.
- **Before merge:** `pnpm exec vitest run services/gateway/src/talk_live/livekit_media.test.ts services/gateway/src/talk_live/postgres_repository.test.ts services/gateway/src/talk_live/postgres_repository.integration.test.ts services/gateway/src/talk_live_routes.test.ts`; `pnpm --filter @masanawa/gateway-service typecheck`; authenticated two-device Host reconnect/overlap, old-track removal and listener audible validation against real LiveKit. Verify branch divergence and re-review shared integrations before merge.

## Live production observation (read-only Railway, 2026-10-08)

- Railway project `empowering-education`, `masanawa-gateway` production: deployed **SUCCESS** at `ae80941295d67c53d8e3eff1aa0447af8f49ec6e` on 2026-10-08 05:52:19 UTC. This does **not** contain PR #439 and is not R02 proof.
- Config inventory confirms names `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `MASANAWA_TALK_GEMINI_LIVE_MODEL`, `MASANAWA_TALK_AI_AGENT_NAME`, `MASANAWA_TALK_GWANI_VOICE`, `MASANAWA_TALK_GWANA_VOICE` are present. Railway OAuth connection redacts values; presence is **not** successful provider handshake/audio qualification.
- HTTP proxy logs record private `/agent/sessions/open` and `/agent/live/token` 500 responses around 05:47–05:48 UTC **before** the successful policy-initialization deployment. No authenticated paired public `/talks/:talkId/live/media-token` acceptance is observed after deployment, so the original audio defect remains unverified.
- `/agent/events/stream` had a 502 at 05:55 UTC and later 499 long-lived disconnects around 75 seconds. A 499 may be client cancellation; do not classify every occurrence as a backend crash. Agent runtime emitted one 214ms blocked event-loop warning at 06:15 UTC.
- Authenticated client telemetry also includes occasional 401 after 200 refresh responses, but HTTP records alone do not establish whether they were from the same account/session. Investigate with privacy-safe request correlation if the issue recurs; do not log bearer tokens or customer speech.
- No live service variables or deployment configuration changed. Current production Gateway deployment uses `main`, NOT this draft PR. Pending R02: real device request IDs, LiveKit room authorization/grants, current LiveKit RoomService API behavior and remote audio.

## LiveKit moderation adapter scope expansion — time unit safety

- Additional exclusive paths: `services/gateway/src/talk_moderation/livekit_admin.ts`, `services/gateway/src/talk_moderation/livekit_admin.test.ts`.
- Current LiveKit `RemoveParticipant` accepts `revoke_token_ts` as Unix milliseconds. Existing code sends `Math.floor(now().getTime()/1000)` (seconds), which is a 1970-era timestamp under the documented contract, and may not revoke issued Cloud credentials. PR #443 R15 and other active PRs do not change these files.
- Correct only this exact time unit and assert it in provider-contract tests; reuse the configured moderation adapter, no migrations/composition changes. Production revocation remains unverified.

### LiveKit revocation unit checkpoint

- `f70ddcd0`: existing moderation `RemoveParticipant` sends `revoke_token_ts: now().getTime()` (milliseconds), consistent with LiveKit's documented protobuf field. Previously emitted seconds.
- `def9b6eb`: regression validates the exact millisecond value under an injected clock and ensures an absolute modern Unix timestamp; does not claim runtime Cloud revocation is tested.
- Current production main at `ae8094129` does not contain this correction. No production config changed. Executable Vitest/LiveKit account test and Cloud versus self-hosted token-replay qualification are still required before merge.
