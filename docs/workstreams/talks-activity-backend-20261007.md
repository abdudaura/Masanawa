# Talk Activity backend — 2026-10-07

- **Owner/window:** current ChatGPT Talks backend window
- **Branch:** `work/talks-activity-backend-20261007`
- **Stacked base:** PR #337 head `32445d182ae483527be2615afbf822aac6ffa47d`
- **Lane:** authenticated Talk-network Activity projection + durable persistence
- **Owned paths:**
  - `services/gateway/src/talk_activity/**`
  - `services/gateway/src/talk_activity_routes.ts`
  - `services/gateway/src/talk_activity_routes.test.ts`
  - `packages/talks/migrations/0002_talk_activity.sql`
  - isolated additions to `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, and `adapters/storage/postgres/src/readiness.ts` inherited from parent PR #337 ownership
  - this workstream file
- **Not owned:** any `apps/mobile/**`; AI Seat commerce; social-profile backend; push delivery; unrelated Commerce/Twin/channel/runtime files.
- **Contract:** implement `GET /activity?filter=all|talks|money|social&limit=60` matching the active mobile Activity lane, with user/tenant isolation and safe display projections.
- **Claim status:** active.
