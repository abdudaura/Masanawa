# AF09 — Published audio-post service and isolated feed (2026-10-10)

State: **PARTIAL_IMPLEMENTATION / NOT E2E VERIFIED / NOT DEPLOYED**. Window owner: AF09-20261010-0150-gpt6. Claim: `factory/claims` record `af09-20261010-audio-posts-gpt6` (read back before edits). Branch: `work/af09-published-audio-20261010-gpt6`. Base main: `f381f077c485c04261459b77a42c215d3ce3a14b`. Initial service-only checkpoint: `cb22dac688355c40610aa74dd4da84fd4423a301`. Source final SHA and PR: see branch/PR metadata after submission.

## Customer milestone advanced

New published-audio post namespace, **not** the existing legacy live Talk session. Server-authoritative publish actor/session contract, server-owned private ready-asset verification and duration/codec/size constraints, stable client request ID, atomic replay-safe insert, pending processing, trusted moderation completion with revision CAS, public feed with block/visibility callback, own-post history and like/save persistence. Gateway routes are isolated and require an AF08 server session resolver. No public moderation endpoint. Client includes Gateway transport and account-fenced Discover feed with loading/empty/network retry/pagination, saving/liking and a disabled playback control when AF05's authorized player has not been provided. No fake successful playback.

**Not done:** file capture/trim/upload/media readback, storage object signing, migration installation, comment/follow/play-count modules, publication worker lease, moderator UI, actual author display-name lookup, library/following screens, shared shell composition and supported older Talk migration. The existing Talk home is deliberately untouched to preserve locally fixed APK source and AF00 root integration ownership. This patch alone does not produce a working published-audio product.

## Claimed exact paths

- `services/gateway/src/audio_posts/contract.ts`
- `services/gateway/src/audio_posts/service.ts`
- `services/gateway/src/audio_posts/service.test.mjs`
- `services/gateway/src/audio_posts/routes.ts`
- `adapters/storage/postgres/src/audio_posts/repository.ts`
- `apps/mobile/lib/src/audio_posts/audio_post_transport.dart`
- `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart`
- `apps/mobile/test/audio_first/af09/feed_test.dart`
- `docs/workstreams/AF09-published-audio-core-20261010.md`

## SQL append-only migration proposal — AF00 alone allocates

No SQL migration or existing schema registry edited. AF00 must review canonical schema names, data retention and existing tenant isolation before assigning a new append-only migration.

```sql
CREATE SCHEMA IF NOT EXISTS social;
CREATE TABLE social.audio_posts (
  tenant_id text NOT NULL, post_id text NOT NULL,
  author_id text NOT NULL, author_account_id text NOT NULL,
  author_kind text NOT NULL CHECK (author_kind IN ('human','masana')),
  asset_id text NOT NULL, request_id text NOT NULL,
  title text NOT NULL, duration_ms integer NOT NULL
    CHECK (duration_ms BETWEEN 1000 AND 180000),
  status text NOT NULL CHECK (status IN ('processing','published','failed','removed')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NULL,
  PRIMARY KEY (tenant_id,post_id),
  UNIQUE (tenant_id,author_account_id,request_id),
  CHECK (char_length(title) BETWEEN 1 AND 100)
);
CREATE INDEX audio_posts_published_feed
  ON social.audio_posts(tenant_id,created_at DESC,post_id DESC)
  WHERE status='published';
CREATE INDEX audio_posts_author
  ON social.audio_posts(tenant_id,author_account_id,created_at DESC);
CREATE TABLE social.audio_post_reactions (
  tenant_id text NOT NULL, post_id text NOT NULL, account_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('like','save')),
  PRIMARY KEY (tenant_id,post_id,account_id,kind),
  FOREIGN KEY (tenant_id,post_id) REFERENCES social.audio_posts(tenant_id,post_id)
);
```

Migration requires disposable PostgreSQL execution, origin/media foreign keys, proper tenant constraints, restore rehearsal, and review of storage redaction, safety/retention dependencies. Not authorized for production.

## Composition requests (not edits)

**AF00:** import and register `registerAudioPostRoutes` inside one canonical authenticated Gateway composition using AF08's session resolver. Supply a *single* verified media authority and moderator worker call path; do not use a client-approved status. Bind the existing canonical profile/safety block policy to `PostVisibility`; fail closed when unavailable. Integrate Flutter `AudioPostFeedScreen` as the Talks tab (Chats · Rooms · Talks · Gwani · Wallet), keeping older live resources typed and accessible only if correctly rehomed to Rooms. Do not activate route before PostgreSQL migration and authoritative bindings.

**AF05/AF15:** own recorder, codec validation, object metadata, private upload authorization, signed read and shared one-player audio focus. Only pass `onPlayAuthorized` after real playback, data-leak checks and retention. Secure private asset access is not equivalent to copying a public storage URL.

**AF09 continuation:** implement create post draft/preview/processing retry; follow, comments, counters, saves/history and moderation/delete; add worker orchestration and object-ref cleanup via AF15. Carry feature through two-account publication/play/follow/comment and retry tests, not another helper patch.

## Verification status and exact runner actions

- **SOURCE READBACK:** GitHub CAS claim read back; immutable blob SHA/source tree verified through GitHub at checkpoint. No real runtime test claim.
- **AUTHORED, NOT RUN:** 9 backend Node tests in `service.test.mjs`, plus 3 Flutter widget tests. Run them from an actual checkout, after compiling TypeScript to a corresponding `.js` module path and preserving package dependencies.
- **NOT RUN:** `pnpm --filter @masanawa/gateway test`, `pnpm -r typecheck`, `cd apps/mobile && flutter analyze && flutter test test/audio_first/af09/feed_test.dart`, disposable Postgres transaction/visibility tests, two physical devices and media/provider tests. The current container has Node 22 and TypeScript compiler, but no private Git checkout/network DNS and no Flutter/Dart; cannot honestly attribute local tests to the GitHub files here. Assign exact-head TypeScript/Flutter/PG execution to AF00 and qualified runners.
- **Test IDs:** UX-A08 and UX-A09 partially addressed at source only; CR-A01 depends AF12 and media processing. All real boundary journeys remain NOT_RUN.

Merge into the **one reviewed non-deploying integration baseline** only after exact-head typecheck, service tests, Flutter tests and auth/media/visibility review; do not merge into auto-deploying main. Review actual hosting triggers/rollout first. Preserve owner-local APK and #497. No live payment, migration, cloud, production, provider, device or deployment mutations.
