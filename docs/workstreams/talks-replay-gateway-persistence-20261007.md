# Talk replay Gateway + persistence integration — 2026-10-07

- **Owner:** current ChatGPT Talks backend window
- **Branch:** `work/talks-replay-gateway-persistence-20261007`
- **Base:** `9531f01323fc399c1762ae6141fd30698c7a80cb`
- **Lane:** durable replay session persistence, Host replay controls, public replay projection, media-segment custody metadata
- **Owned paths:**
  - `services/gateway/src/talk_replay/**`
  - `services/gateway/src/talk_replay_routes.ts`
  - focused replay Gateway/repository tests
  - `packages/talks/migrations/0006_talk_replay.sql`
  - isolated additions to `services/gateway/src/app.ts`, `services/gateway/src/main.ts`
  - isolated replay projection additions to existing Talk read paths when needed
  - this workstream
- **Reuses:** merged `@masanawa/agents` Talk replay runtime from PR #349 and merged live/moderation runtime.
- **Not owned:** mobile files; actual LiveKit egress worker/deployment; AI Seat Commerce; search/ranking ownership; Billing/Crypto/Twin/channel code.
- **Product rules:** only human Host controls publication; finalized empty recordings never become public; media references remain opaque custody metadata; replay never extends live state.
- **Status:** active.
