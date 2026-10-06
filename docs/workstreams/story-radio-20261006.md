# Story Radio workstream — 2026-10-06

## Scope

Story Radio is an admin-published serialized audio-story service for listeners. It is not a user-created social video/content feature.

Consumer/backend integration: PR #211, branch `work/story-radio-home-integration-20261006`.

Admin publishing integration: PR #213, branch `work/story-radio-admin-mobile-20261006`.

## Current implementation status

Implemented end to end in code:

- canonical `@masanawa/content` Story Radio domain and migration;
- PostgreSQL repository with draft/published series and episodes;
- publication invariants and serialized publication changes;
- authenticated customer Gateway routes;
- bounded authenticated admin routes;
- tenant/user scoping derived from platform sessions;
- platform admin allowlist inheritance plus optional Story Radio admin allowlist;
- Home room and Home continuation projection;
- customer Story Radio home/series/episode screens;
- authenticated HTTP transport via existing `ApiClient`;
- `just_audio` playback;
- progress persistence, resume, completion continuation and next-episode support;
- reactions;
- admin mobile list/create/edit/publish/unpublish flows;
- admin session-refresh retry;
- publication conflicts surfaced as HTTP 409.

## Fixes completed during resumed validation

- reconciled the latest Home production-integration base with a real merge parent;
- added Home continuation regression coverage so server continuations remain first and local duplicate chat continuations are suppressed;
- carried forward the Home Flutter test-binding fix;
- fixed episode-route lifecycle so Next Episode reloads content and instantiates a fresh keyed audio player;
- ignores stale async episode loads after route changes;
- persists current listening position when leaving the player, not only at 15-second checkpoints/pause/completion;
- maps repository `story_radio.episode.unavailable` conditions to bounded HTTP 404 behavior instead of generic 500;
- added post-unpublish progress/reaction regression coverage;
- added tenant-isolation coverage in Story Radio service fakes;
- added customer HTTP transport regression coverage;
- added admin token-refresh regression coverage and aligned the Dio adapter signature with current Dio.

## Validation evidence

GitHub Actions currently fail before code execution. The latest Foundation/Mobile jobs report no executed steps (`steps: null`), so they are runner-allocation failures rather than test failures.

Earlier external Render Node validation on the Story Radio snapshot completed frozen pnpm install, TypeScript/build and targeted tests successfully. That evidence predates the newest Dart lifecycle/test-only fixes and must not be treated as final Flutter/APK qualification.

Railway is the preferred hosted validator now, but the workspace free-plan resource cap rejects creation of both a new validation service and a separate temporary validation project.

The existing Railway mobile/APK builder is actively owned by the Home qualification lane on `ci/home-railway-apk-20261006`; it must not be repointed until that lane explicitly releases it.

## Remaining qualification

No known Story Radio product/code blocker is open from the repository audit.

Still required when an unclaimed Railway APK builder is available:

1. Flutter analyze and customer-mobile tests on the current PR #211 head.
2. Admin-mobile Flutter analyze/tests on the current PR #213 head.
3. Release APK build containing current Home + Story Radio.
4. Physical/device flow: Home → Story Radio → series → episode → play → progress → resume → reaction → next episode.
5. Admin flow against deployed Gateway/database: create series → create episode → publish episode → publish series → customer listen → verify unpublish invariants.
6. Final production auth/session-refresh and tenant/admin scoping smoke.

Do not repoint production Gateway, billing/crypto services, News validators, or the active Home APK builder to complete this workstream.
