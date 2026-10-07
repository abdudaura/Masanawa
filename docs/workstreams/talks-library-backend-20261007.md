# Talk library backend — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-library-backend-20261007`
Base: `9531f01323fc399c1762ae6141fd30698c7a80cb`

## Scope

Complete the backend behind the already-merged **My Talks** and **Saved Talks**
mobile surfaces, and add durable idempotent save/unsave authority.

Owned:
- `packages/talks/migrations/0006_talk_library.sql`
- new `services/gateway/src/talk_library/**`
- new `services/gateway/src/talk_library_routes.ts`
- focused Gateway/PostgreSQL tests
- minimal fresh-read composition edits in `services/gateway/src/app.ts` and
  `services/gateway/src/main.ts`
- this handoff

PR #355 was closed with zero commits, so its stale mobile claim no longer owns any
implementation. This lane reclaimed and completed the mobile save-state transport and
compact Talk Save/Remove action on the same branch.

Not owned:
- replay recording PR/runtime
- Talk live/moderation/AI Seat authorities already merged
- Commerce/Gifts
- production deployment

## Required contracts

- GET `/me/talks`
- GET `/me/saved-talks`
- GET `/me/saved-talks/:talkId`
- PUT `/me/saved-talks/:talkId`
- DELETE `/me/saved-talks/:talkId`

## Invariants

- authenticated and tenant/user scoped;
- My Talks returns only Talks owned by the authenticated Host;
- Live and replay/ended projections are separated;
- drafts are omitted until a durable draft editor exists;
- Saved Talks expose only still-visible Talk states;
- save/unsave is idempotent;
- saved state cannot leak across users or tenants;
- owned Talk projections set `viewerIsHost=true`;
- library state does not become a second Talk lifecycle authority.

## Implementation checkpoint

Implemented:
- durable tenant/user-scoped `talks.saved_talks` references;
- canonical My Talks projection from Host-owned Talk rows;
- owned projections preserve `viewerIsHost=true`;
- canonical Saved Talks projection over still-visible Talk states;
- authenticated saved-state read;
- idempotent PUT save and DELETE unsave;
- repeated save does **not** rewrite `saved_at`, so retries never reorder the library;
- Gateway route registration and production `main.ts` composition;
- focused route and PostgreSQL tenant/user isolation tests.

Mobile integration completed here:
- saved-state GET projection;
- idempotent PUT save / DELETE unsave transport;
- Riverpod saved-state provider;
- Talk app-bar bookmark replacing the previous dead More action;
- Saved Talks cache invalidation after mutations;
- focused widget coverage for save/unsave.

Status: backend + mobile library integration complete; ready for qualification/merge.
