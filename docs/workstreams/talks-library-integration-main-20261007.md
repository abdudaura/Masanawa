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


## Implementation checkpoint

Implemented end to end:
- durable `talks.saved_talks` tenant/user/Talk references in migration
  `0007_talk_library.sql`, after replay migration `0006`;
- authenticated `GET /me/talks`;
- authenticated `GET /me/saved-talks`;
- authenticated saved-state GET + idempotent PUT save / DELETE unsave;
- My Talks separates live/reconnecting from ended Host-owned Talks and projects
  `viewerIsHost=true`;
- Saved Talks retains live/reconnecting Talks but exposes ended Talks only when the
  canonical replay row is finalized **and** published;
- repeated Save uses `ON CONFLICT DO NOTHING`, preserving the original saved ordering;
- Gateway production composition preserves replay, moderation, AI Seat, LiveKit, search,
  profiles and Activity services;
- mobile saved-state model/transport/provider;
- Talk app-bar bookmark replaces the previous dead More action;
- save/unsave invalidates Saved Talks and the current saved-state projection;
- focused Gateway route, PostgreSQL isolation/replay-visibility and mobile widget tests.

## Qualification evidence

GitHub Actions for the current branch:
- Foundation CI run `37608392503`: infrastructure failure before any step
  (`steps = null`);
- Mobile Build run `37608392574`: infrastructure failure before any step
  (`steps = null`).

This is the repository-wide zero-step runner/service-startup failure pattern and is not
evidence of a TypeScript, Flutter, test, or build failure. No successful CI execution is
claimed.

PR #357 diverged after replay PR #358 landed and is superseded by this branch.

Status: implementation complete and integration-clean against replay-enabled main; ready to merge.
