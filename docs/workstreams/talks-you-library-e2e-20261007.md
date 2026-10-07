# Talk You library end-to-end — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-you-library-e2e-20261007`
Base: `c81a225bcc09e567f35fe1321fc5e3e8d1d3fa44`

## Scope

Finish the already-merged **You → My Talks / Saved Talks** product slice end to end.

Owned paths:
- next free `packages/talks/migrations/*saved*`
- new `services/gateway/src/talk_library/**`
- new `services/gateway/src/talk_library_routes.ts`
- focused Gateway tests
- minimal fresh-read `services/gateway/src/app.ts` / `main.ts` composition
- existing mobile `src/library/talk_library*.dart`
- existing mobile Talk-library provider/screens
- the Talk-screen overflow Save/Remove action only
- focused mobile tests
- this handoff

Not owned:
- replay recording/publication runtime
- Talk moderation/live audio
- AI Seat Commerce
- gifts
- search/ranking
- production deployment

## Contract

- GET `/me/talks`
- GET `/me/saved-talks`
- GET `/talks/:talkId/saved`
- POST `/talks/:talkId/saved` with `{saved:boolean}`

Rules:
- authenticated + tenant-scoped;
- My Talks is derived from canonical Talk Host ownership;
- live and ended/replay projections reuse canonical Talk discovery shape;
- Drafts appear only for durable `draft` Talk rows;
- save/unsave is idempotent;
- only publicly viewable Talk lifecycle states may be saved/listed;
- deleting a Talk cascades its saved references;
- Talk overflow remains compact; no new dashboard/menu clutter.

Status: active.
