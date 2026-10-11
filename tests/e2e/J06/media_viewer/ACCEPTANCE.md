# C23 — published Masana media journey (not release-qualified)

Source: `services/gateway/src/modules/home_feed/media_routes.ts`, `adapters/storage/postgres/src/home_feed/media_authorization.ts`,
`apps/mobile/lib/src/features/home_feed/feed_media_{api,screen}.dart`.

1. Published approved Masana image/audio post: C21 media action passes **post + media ID**, never an unscoped object key.
2. `GET /v1/posts/:postId/media/:mediaId`: canonical trusted tenant resolver, optional verified fan session, fail-closed flag. PostgreSQL requires matching published same-tenant feed post, media ID membership and approved author revision. Storage signer separately revalidates the canonical object and approval rights; no user-chosen key.
3. Short-lived HTTPS grant (at most 300 seconds) has `private, no-store`, proper image/audio MIME, audio transcript. C23 loads one signed asset, image pinch zoom/gallery or streamed audio with seek/speed/transcript and shared audio focus hook.
4. Negative: other tenant, unpublished/removed post, missing media ID, unapproved character, signer denial, malformed/expired grant, feature disabled, no media, offline/retry, app background and account switch. Never return another fan's data or raw storage key.
5. AF00 owns canonical signer wiring and shared audio focus injection, single gateway route registration, Home callback, legal media object contract and actual Android lifecycle/provider tests. **No new SQL migration or worker** is needed: read-only reuse of `feed.posts.media_ids`, existing approved-content jobs and canonical S3 store. New signing path remains unmounted until qualification.
6. Execute Node24/pnpm12 TypeScript, Vitest, PostgreSQL18 seeded published/hidden checks, both Flutter apps, signed Android APK/device with network/offline/audio interruption, source rights and rollback on the unified SHA. Do not count these as passed without actual logs.

No deployed or live-media success is claimed by this source file.
