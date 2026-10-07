# Talk participation + Host moderation backend — 2026-10-07

- **Owner:** current ChatGPT Talks backend window
- **Branch:** `work/talks-participation-host-moderation-backend-20261007`
- **Base:** `e4537500e10222cc8b76c15af543eae9180f6b26`
- **Lane:** durable listener participation + Host moderation/end + human Speaker media admission
- **Owned paths:**
  - `services/gateway/src/talk_moderation/**`
  - `services/gateway/src/talk_moderation_routes.ts`
  - focused moderation/participation tests
  - `packages/talks/migrations/0005_talk_moderation.sql`
  - isolated additions to `services/gateway/src/app.ts`, `services/gateway/src/main.ts`
  - isolated Speaker-role/media-authority extensions under `services/gateway/src/talk_live/**`
  - this workstream
- **Reuses:** canonical `@masanawa/agents` Talk live revision/state machine merged from PR #344; durable live runtime/media from PR #345.
- **Not owned:** mobile files; AI Seat money movement; replay storage; search/ranking; unrelated Commerce/Twin/channel code.
- **Contracts:** mobile participation + Host-controls contracts already documented on main.
- **Status:** active.
