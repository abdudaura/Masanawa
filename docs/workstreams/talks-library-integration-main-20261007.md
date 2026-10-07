# Talk library integration on replay-enabled main — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-library-integration-main-20261007`
Base: `52bdb56b717b50a6d543832933771572f246fcce`

Reclaims the useful work from diverged PR #357 after replay PR #358 changed shared
Gateway composition and introduced `0006_talk_replay.sql`.

## Owned scope

- `packages/talks/migrations/0007_talk_library.sql`
- new `services/gateway/src/talk_library/**`
- new `services/gateway/src/talk_library_routes.ts`
- fresh minimal composition in `services/gateway/src/app.ts` + `main.ts`
- mobile saved-state transport/provider + compact Talk bookmark control
- focused Gateway/PostgreSQL/mobile tests
- this workstream

## Integration rules

- preserve all replay #358 behavior;
- My Talks may expose the authenticated Host's ended Talks;
- Saved Talks expose ended content only when canonical replay state is finalized + published;
- live/reconnecting Talks remain saveable;
- save/unsave is tenant/user scoped and retry-idempotent;
- repeated Save must not rewrite `saved_at`;
- owned Talk items carry `viewerIsHost=true`;
- drafts remain empty until a durable draft editor exists.

PR #357 is superseded by this replay-aware integration and must not be merged.

Status: active.
