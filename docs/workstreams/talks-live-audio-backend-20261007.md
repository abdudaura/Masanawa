# Talks live-audio backend — 2026-10-07

- Owner: current ChatGPT Talks backend window
- Branch: `work/talks-live-audio-backend-20261007`
- Stacked base: PR #337 head `32445d182ae483527be2615afbf822aac6ffa47d`
- Lane: Talk live-audio session/admission runtime
- Owned paths:
  - `services/gateway/src/talk_live/**`
  - `services/gateway/src/talk_live_routes.ts`
  - focused Talk live-audio tests
  - isolated inherited additions to `services/gateway/src/app.ts` and `services/gateway/src/main.ts`
  - `packages/talks/migrations/0004_talk_live_sessions.sql`
  - isolated Talk lifecycle SQL updates performed only through the new Talk-live repository
  - this handoff
- Reuse: existing Gemini Live token/session/security foundations; do not create another voice provider stack.
- Not owned: mobile files; AI Seat Commerce; search/ranking; host moderation; replay storage; existing private-agent voice flows.
- Product invariants: every live Talk has a real human Host; listeners cannot mint Host/speaker authority; live audio is Talk-scoped and tenant-scoped; reconnect state must be explicit.
- Status: active.
