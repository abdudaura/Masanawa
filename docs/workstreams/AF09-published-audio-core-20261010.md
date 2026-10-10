# AF09 — Published audio-post service and isolated feed (2026-10-10)

State: **PARTIAL_IMPLEMENTATION / NOT E2E VERIFIED / NOT DEPLOYED**. Window owner: AF09-20261010-0150-gpt6. Claim: `factory/claims` record `af09-20261010-audio-posts-gpt6` (read back before edits). Branch: `work/af09-published-audio-20261010-gpt6`. Base main: `f381f077c485c04261459b77a42c215d3ce3a14b`. Initial service-only checkpoint: `cb22dac688355c40610aa74dd4da84fd4423a301`. Source final SHA and PR: see branch/PR metadata after submission.

## Customer milestone advanced

New published-audio post namespace, **not** the existing legacy live Talk session. Server-authoritative publish actor/session contract, server-owned private ready-asset verification and duration/codec/size constraints, stable client request ID, atomic replay-safe insert, pending processing, trusted moderation completion with revision CAS, public feed with block/visibility callback, own-post history and like/save persistence. Gateway routes are isolated and require an AF08 server session resolver. No public moderation endpoint. Client includes Gateway transport and account-fenced Discover feed with loading/empty/network retry/pagination, saving/liking and a disabled playback control when AF05's authorized player has not been provided. No fake successful playback.

**Not done:** file capture/trim/upload/media readback, storage object signing, migration installation, comment/follow/play-count modules, publication worker lease, moderator UI, actual author display-name lookup, following library, shared shell composition and supported older Talk migration. The continuation below adds the owner-only *My Talks* history and removal flow; this is not yet mounted in the app. The existing Talk home is deliberately untouched to preserve locally fixed APK source and AF00 root integration ownership. This patch alone does not produce a working published-audio product.

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

**AF09 continuation:** implement create post draft/preview/processing retry; follow, comments, counts, moderated creator interactions and publication tooling; add worker orchestration and object-ref cleanup via AF15. Carry feature through two-account publication/play/follow/comment and retry tests, not another helper patch.

## Verification status and exact runner actions

- **SOURCE READBACK:** GitHub CAS claim read back; immutable blob SHA/source tree verified through GitHub at checkpoint. No real runtime test claim.
- **AUTHORED, NOT RUN:** originally 9 backend Node tests in `service.test.mjs` and 3 Flutter widget tests; the continuation adds 5 server and 3 Flutter cases respectively, for **14 backend and 6 Flutter authored cases**. Run them from an actual checkout, after compiling TypeScript to a corresponding `.js` module path and preserving package dependencies.
- **NOT RUN:** `pnpm --filter @masanawa/gateway test`, `pnpm -r typecheck`, `cd apps/mobile && flutter analyze && flutter test test/audio_first/af09/feed_test.dart`, disposable Postgres transaction/visibility tests, two physical devices and media/provider tests. The current container has Node 22 and TypeScript compiler, but no private Git checkout/network DNS and no Flutter/Dart; cannot honestly attribute local tests to the GitHub files here. Assign exact-head TypeScript/Flutter/PG execution to AF00 and qualified runners.
- **Test IDs:** UX-A08 and UX-A09 partially addressed at source only; CR-A01 depends AF12 and media processing. All real boundary journeys remain NOT_RUN.

Merge into the **one reviewed non-deploying integration baseline** only after exact-head typecheck, service tests, Flutter tests and auth/media/visibility review; do not merge into auto-deploying main. Review actual hosting triggers/rollout first. Preserve owner-local APK and #497. No live payment, migration, cloud, production, provider, device or deployment mutations.

## Continued existing PR #609 — own-post removal and My Talks (2026-10-10)

**Continuation claim:** `af09-continue-609-20261010-gpt6` at `factory/claims`, acquired and read back before edits. No new feature/integration branch; original branch and all existing changes preserved. Parent milestone is **Published audio Talks, UI-04/UI-06/UI-07 and UX-A08/UX-A09**, not a completed microfix lane.

**Connected source:** `AudioPostRepository.removeOwn` locks the row and returns identical 404 semantics for nonexistent/non-owned posts, changes an owner’s processing/published/failed post to `removed`, increments revision and clears public publication timestamp; repeated same-owner deletion returns the persisted removed row without another mutation. A concurrent processor’s stale revision cannot settle after removal. Gateway `DELETE /audio-posts/:postId` resolves AF08 actor server-side; Flutter transport checks the deletion receipt; `AudioPostFeedScreen` now switches Discover/My Talks, shows processing/failed/removed status, requires destructive-action confirmation, preserves retry and fences account changes. This removes a post from feeds; **it is not a claim that private media bytes are erased**—AF15 owns the retention lifecycle.

**Committed source checkpoints (same PR):** contract `9ea7ae785fe25063d71a9baaa5e18d4455e0b528`; service `5a8fd259b9564cd846d91285b3f89e2b3cf02a8f`; PostgreSQL repository `367f116c386b1808b2f28782ca395d2a8339a4e4`; route `4eaedb7e8473029d255ef8cf077bcb359076830b`; client transport `d543c992f60bf81eb3b530f04cbb30dd7178a186`; feed screen `cfd8ebf1ad76d1df170dd5873e13f287635e205c`; server tests `b1b1d8d99af7985c76a24244876b78a5b0fb967f`; Flutter tests `945ddaf6abb127d0ac4995d36ad7d2489adf41f3`. Exact final PR HEAD must be reread after this handoff edit.

**Test source:** five new server regression cases for owner-only/idempotent removal, cross-account and cross-tenant denied access, post-deletion moderation revision conflict, saved-reaction readback/unsave and tenant isolation; three new Flutter widget cases for confirm/cancel, failed removal/retry, and Saved/Unsave readback. **No executable test PASS is claimed.**

**Runner and build blockers (actual observation):** This container executes Node `v22.16.0` and `tsc 5.8.3`, while root `package.json` requires Node `>=24 <25`, pnpm `>=12 <13` and TypeScript `7.0.2`. There is no repo checkout, pnpm, Dart/Flutter or PostgreSQL client here. `git ls-remote https://github.com/Baatiku/masanawa refs/heads/main` fails `Could not resolve host: github.com`. GitHub Actions exact-head source checkpoint `945ddaf6abb127d0ac4995d36ad7d2489adf41f3`: Foundation CI run `38015861631`, job `114105822777` and Mobile Build run `38015861618`, job `114105823005` concluded failure with **zero steps**; Vercel commit status is build-rate-limit failure. These signals are **BLOCKED**, not source/test failures and not test passes.

**Action owner and executable next action:** AF13 or a capable AF00/local Node 24/pnpm 12 + Flutter runner must check out the exact final PR HEAD and run `pnpm install --frozen-lockfile && pnpm typecheck && pnpm exec vitest run services/gateway/src/audio_posts/service.test.mjs`, then `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/audio_first/af09/feed_test.dart`; run PostgreSQL migration and two-tenant concurrent delete/settle/feed tests on a disposable database. AF00 must allocate the append-only migration, wire canonical AF08 session resolver/AF15 verified media and safety adapters, then mount new Talks on the reviewed **single elected non-deploying** integration baseline, reconcile unreceived local APK source and audit automatic deploy triggers. AF05/AF15 own actual recorder/upload/private player; AF09 continues publish composer, worker, follow/comment/count paths. Until the exact source tests and composition have been executed and reviewed, **do not merge PR #609 to main or characterize UX-A08 as working E2E**.

### Same-PR saved-library continuation (2026-10-10)

Without adding a competing library, `AudioPostRepository.saved` now joins existing `social.audio_post_reactions` to published posts in the current tenant and validates each result against the canonical visibility callback (blocked/private authors fail closed). The server session resolves the viewer in `GET /audio-posts/saved`; another user's saves are not a public signal. The Flutter `Saved` view reads that server list and `Unsave` sends `enabled:false` to the original idempotent reaction endpoint before removing the local item. The UI deliberately does not expose an inert Following tab. A fresh device/integration check still must qualify cross-tenant, block/unblock, reaction persistence and retention.

Source commits: saved contract `705041548a9d787263091aa37dd6b0e7146dfdc2`, service `d43d98d80a57001b4be81371d7594b874cbbff82`, repository `649de11d835bfdc0fefc0396b79b0bf0824107b7`, route `82754de6a8816981f6430b1ad339cad4d57f9ecc`, transport `d5ca569aa23d2839adf14aa76f595cf4f685733b`, screen `3ccb5459140c33933ec07c8492ff0a28491ca5cd`, server tests `bd239da33484af0d3ea9fc44ba53f303583b09ab`, widget tests `9cb53fb34f94dc1e77bd3acbd9f889992e3ae1de`. Final handoff/source HEAD is the most recent commit on PR #609; reread it before integration. No CI runtime source test was performed.


## Continuation: durable published-Talk comments (2026-10-10)

**Parent milestone:** Published audio Talks, existing PR #609; comments are part of the
customer journey, not a separate integration branch. This AF09 continuation
extends the same feature-owned contract, service, Fastify routes, PostgreSQL
adapter, Flutter feed/transport and their tests. The separate AF09
`processing_worker.ts` / `processing_queue.ts` ownership is preserved.

**Implemented in source (not yet integrated/qualified):**
- `GET /audio-posts/:postId/comments`: server session, tenant and canonical
  blocked-author visibility, published-only post, latest 50 comments.
- `POST /audio-posts/:postId/comments`: validated 1–400 character plain-text
  body, server-account author, request-key idempotency and conflict rejection,
  status 201 on authenticated publication. Request body accepts only
  `requestId` and `body`.
- `DELETE /audio-posts/:postId/comments/:commentId`: author-only tombstone,
  idempotent removal acknowledgment; no client moderator privilege.
- Feed inline comments panel: loading/empty/error/retry, comment composer,
  author deletion, account-change response fencing and replay-safe retries.
  Fixed original dynamic `const Padding` empty-state expression.
- Added backend negative cases for non-published, removed, cross-tenant,
  spoofed author, duplicate keys and removal; Flutter widget cases for
  send/remove/offline retry. Authored tests have **not** run in this
  GitHub-only source environment.

**Append-only SQL proposal requiring AF00 review/allocation/installation:**

```sql
CREATE TABLE social.audio_post_comments (
  tenant_id text NOT NULL,
  post_id text NOT NULL,
  comment_id text NOT NULL,
  author_account_id text NOT NULL,
  request_id text NOT NULL,
  body text NOT NULL CHECK (char_length(body) <= 400),
  created_at timestamptz NOT NULL DEFAULT now(),
  removed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, post_id, comment_id),
  UNIQUE (tenant_id, post_id, author_account_id, request_id),
  FOREIGN KEY (tenant_id, post_id)
    REFERENCES social.audio_posts (tenant_id, post_id)
);
CREATE INDEX audio_post_comments_recent
  ON social.audio_post_comments
  (tenant_id, post_id, created_at DESC, comment_id DESC)
  WHERE removed = false;
```

**Activation blocked until** AF00 registers the audited migration,
auth/session/visibility source, approved worker/composition and Talks route;
AF05/AF15 provide verified record/upload, signed playback and retention.
The user cannot publish/play a real audio Talk merely because this
source is present in PR #609. Require executable source checks at exact
PR SHA, disposable PostgreSQL two-account + concurrency execution, Flutter
analyzer/widget tests and deployment-trigger review before safe integration.
Do not merge to auto-deploying main from this partial source.

**Runner assignment:** AF13 or an AF00 runner with checkout/Node 24/pnpm/Dart/
Flutter/PostgreSQL executes `pnpm install --frozen-lockfile`,
`pnpm --filter @masanawa/gateway test`, `pnpm -r typecheck`,
`cd apps/mobile && flutter analyze && flutter test test/audio_first/af09/feed_test.dart`,
and PG migration/negative cases, reporting exact SHA and command output.
This window can inspect GitHub source and run local Node 22 commands, but has
no repository checkout (DNS `git ls-remote` fails) and no pnpm, Dart, Flutter
or PostgreSQL runner. Do not call unexecuted test files PASS.

**Comment privacy and moderation:** Public comment payloads expose only
`postId/commentId/body/createdAt/removed/isMine`, not commenter internal
`authorAccountId`. A canonical per-account comment rate limit and review
policy are still required from the Gateway/AF13 safety owner before
production activation; a post's audio moderation does not automatically
moderate arbitrary comments. Do not bypass that gate.

**CI inspection at PR revision on 2026-10-10:** GitHub Foundation CI
run `38017064116` job `114109584409` and Mobile Build run
`38017064130` job `114109584597` returned failure with **zero
reported job steps**. Neither constitutes source/test execution. The
local environment reports Node `v22.16.0`, no checkout (GitHub DNS
unavailable), pnpm, Flutter/Dart or PostgreSQL. Source readback and
structural inspection are not PASS_REAL.

## Continuation: public Talk privacy and persisted engagement counts (2026-10-10)

**Same parent milestone:** Published audio Talks, existing [PR #609](https://github.com/Baatiku/masanawa/pull/609). No helper PR, integration branch, migration registry, worker or shared router was created/touched. The earlier comment-path claim `af09-comment-thread-20261010-gpt6c` was read back and renewed before source edits; it was later released by a concurrent continuation. This handoff update uses a newly read-back, documentation-only claim `af09-609-counts-privacy-handoff-20261010-gpt6c`, without reclaiming code paths.

**Code authored on same PR:**
- `services/gateway/src/audio_posts/contract.ts`: `PublicAudioPost` and `toPublicAudioPost` explicitly select safe client fields. Internal `authorAccountId`, `tenantId`, `assetId` and idempotency `requestId` are excluded from public feed/library/history JSON; these are not durable public URLs or authorization capabilities.
- `services/gateway/src/audio_posts/service.ts`: Discover, Saved and My Talks now return the same minimal public post projection rather than raw PostgreSQL records. The authenticated author's publish/remove acknowledgments still use their original own-record contract.
- `adapters/storage/postgres/src/audio_posts/repository.ts`: count active tenant-scoped `like` reactions and non-removed comments from the existing social tables on Discover/Saved/My Talks reads. No fabricated client-side success counters or second engagement database; the AF00-owned append-only comments migration is still required.
- `apps/mobile/lib/src/audio_posts/audio_post_transport.dart` and `audio_post_feed_screen.dart`: validate nonnegative integral social counts, render persisted count readback on published Talk cards, and continue keeping playback disabled until a real media player is injected.
- Existing `services/gateway/src/audio_posts/service.test.mjs` gains public-data-leak/engagement-projection checks; existing `apps/mobile/test/audio_first/af09/feed_test.dart` gains count rendering and malformed-wire regression cases. **Authored, not executed.**

**Committed source checkpoints:** contract `aa875466b75d796af3180ea962d83bf46f58377e`; service projection `2c5cce79aa51ded3856a9699d35f6cea609d243e`; PostgreSQL projection `39b4f56797531c47dcd838d169ab8218db0e46e2`; transport `b0195b990969b2615c71fd2cfd835886425f86b5`; feed `03f28f6ab7e732dc34d59582d775f8c80b9957ac`; runtime import correction `e7114b33287e5f41c105b78d631ce4ee473e7348`; backend tests `75a0fa1710614db769e1ab46f734fd4986ec8cad`; Flutter tests `f7f28993f911ddcf9c020bef3a7d642eb7623258`. **Re-read the changing PR head** before executing or merging; multiple legitimate AF09 owners write separate paths to this same branch.

**Known remaining gap:** AF09 Following's separately owned `following.ts` / `following_routes.ts` still returns its raw repository feed type and must apply the shared `toPublicAudioPost` projection. The Following repository does not yet project persisted counts. This cross-owner path is a bounded transfer to the active Following owner, **not** permission for this continuation to change it. The feed's current like button is an idempotent set action; newly persisted counts become visible on read/refresh, not a fabricated optimistic tally. Verified playback/play counting requires AF05's signed read/listening authority, not a button tap.

**Execution result / blocker:** Source commits and GitHub blob readbacks exist; no actual repo compiler, PostgreSQL, Node package tests or Flutter widget runs have passed in this window. Container: Node `v22.16.0`, only global `tsc` available; project requires Node `>=24 <25`/pnpm 12/TypeScript 7.0.2. `pnpm`, `flutter`, `dart`, `psql` are absent; `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` returns `Could not resolve host: github.com`. These are **BLOCKED / NOT_RUN**, not PASS. GitHub status for shared PR head `3b6c8ea45b77b921e90e8d1b6b4aed231c583a3b` was `pending` with zero reported commit statuses as observed at ~02:33 UTC (not a source test pass).

**Execution owners / next action:**
1. **AF13 or qualified AF00/local Node 24 + pnpm 12 runner:** check out the **latest final PR #609 SHA**; run `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm --filter @masanawa/gateway test`, plus `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/audio_first/af09/feed_test.dart`. Repair real compiler/widget failures on owned paths and run an actual disposable PostgreSQL migration/count/privacy/tenant/block test. Do not mistake authored tests for passing.
2. **AF09 Following owner:** wire the shared public projection into the separately owned Following API and count projection without exposing internal accounts/assets; add its negative regression tests.
3. **AF00:** elect/publish one demonstrably non-deploying safe baseline only after checking GitHub/Vercel/hosting triggers; install reviewed append-only schema, bind AF08 session, canonical visibility/media moderation, connect Gateway/Talks route, reconcile unseen owner-local APK/source, test integrated SHA. Do not merge draft #609 into auto-deploying main while its source/runtime is unverified.
4. **AF05/AF15:** real signed recorder/upload/authorized playback/media deletion lifecycle, focus and verified listen events; then prove two-account record→upload→publish→feed→play/follow/like/comment and retry/restart on devices.

**Status:** PARTIAL_IMPLEMENTATION, NOT VERIFIED_E2E, NOT DEPLOYED. Source test gate blocked; no safe baseline merge of #609 performed.
