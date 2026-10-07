# Talk replay end-to-end — 2026-10-07

Owner/window: current ChatGPT transformation window
Branch: `work/talks-replay-e2e-20261007`
Base: `9531f01323fc399c1762ae6141fd30698c7a80cb`

## Scope

Complete durable audio replay recording/publication around the already-merged replay state machine.

Owned paths:
- `packages/talks/migrations/0007_talk_replays.sql`
- `services/gateway/src/talk_replay/**`
- `services/gateway/src/talk_replay_routes.ts`
- focused replay tests
- bounded replay hooks in Talk creation and Host End service contracts after fresh reads
- `apps/mobile/lib/src/screens/talks/create_talk_screen.dart`
- bounded Create Talk transport/model changes for explicit replay consent
- replay playback additions to Talk screen/provider/transport after library lane clears
- this handoff

Explicitly not owned while active:
- You/Saved Talk library lane and migration 0006
- AI Seat Commerce
- search/ranking
- unrelated Billing/Crypto/channels
- production deployment

## Rules

- Recording requires explicit Host consent.
- Use LiveKit unified `StartEgress`, not deprecated RoomComposite start API.
- Record one mixed audio-only file; no video pipeline.
- Storage credentials stay server-only and object keys stay private.
- Ending a Talk requests Egress stop; final publication occurs only after confirmed successful Egress completion.
- Egress failure/abort/limit never creates a public replay.
- Replay publication obeys the canonical `@masanawa/agents` replay state machine.
- Public playback requires an authenticated, tenant-scoped replay access endpoint.
- The replay lane never creates a second live lifecycle authority.

Status: active.
