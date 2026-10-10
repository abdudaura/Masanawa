# AF09 Published Talks — bounded comment-history continuation (2026-10-10)

**Parent milestone:** Published Audio Talks, existing [PR #609](https://github.com/Baatiku/masanawa/pull/609), branch `work/af09-published-audio-20261010-gpt6`. **Status:** PARTIAL_IMPLEMENTATION; this bounded backend/Flutter transport increment IMPLEMENTED_UNVERIFIED. **Not integrated, not deployed, no local pull requested.**

## Fresh authority, collision review, source completed

- Fresh observed main `7c443966be97e9092cbc1fb98562c75253434326`; project root `AGENTS.md`, `docs/NEXT-WAVE-DELIVERY-20261010.md`, `docs/REUSABLE-IMPLEMENTATION-PROMPT.md`, and Factory v0.4.4 skill/AGENTS/parallel/operating references were read. Main can trigger automated production builds; it is **not** the eligible integration destination.
- Live `factory/claims` exact-path CAS `af09-609-comments-backend-paging-gpt6-0519` acquired at `6b0937791d526587bed817824d57d8578b7e4da4`, renewed at `216f338e30c5c2675c3d3de73573da050484743b`. The active AF09 creator-navigation owner owns `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart`. This window **did not** edit that file, open a second PR, create a new branch, replace the repository or alter any AF00/shared registration.
- Customer defect: first 50 comments were the end of the visible history despite persisted older comments; opening a comment thread loads only `GET /audio-posts/:postId/comments`. New **additive** page endpoint `GET /audio-posts/:postId/comments/page?cursor=<opaque-comment-ID>` preserves old consumers and returns 50 comments plus continuation.
- Canonical repository verifies tenant/post/published status and existing `PostVisibility` before resolving a tenant/post-scoped anchor and SQL keyset. Ordering remains `created_at DESC, comment_id DESC`, and the SQL subquery compares original PG microseconds rather than lossy JS dates. Removed comments are hidden; unknown/foreign cursors are invalid (400), and hidden/blocked posts return the existing non-disclosing 404. No new schema, identity authority or unauthenticated route.
- Existing `createAudioPostService` builds a public-only comment view (no tenant, internal author account or client-provided authority); bounded `limit=51` yields 50 + next ID. Existing `comments()` remains unchanged.
- Flutter transport adds optional `AudioPostCommentPager` to the existing actual `GatewayAudioPostTransport` and validates post ID, duplicates, count, removal and cursor. Existing `AudioPostTransport` callers and legacy comments method remain source-compatible.
- Three authored Node cases cover 50+7 comments, identity projection, continuation, invalid/foreign cursors and authentication/forged scope. Three authored Flutter tests cover scoped sequential Dio requests and malformed cross-post/removed/duplicate/oversized/forged cursor rejection. **Authored does not mean executed.**

Exact source commits on the single existing PR (later concurrent PR pushes are retained): `5e2705fc` contract, `b48b4ac4` service, `080b8569` PostgreSQL, `058ca4fb` route, `0c6173a9` Flutter transport, `801ee3cb` Node tests, `b46d6b8d` Flutter tests. Inspect the fresh final PR HEAD before review or merge.

## Finite parent checklist (source owner, closure and qualification separately)

| ID | Required source and owner | Source state | Executable/integration gate |
| --- | --- | --- | --- |
| AF09-01 | Authenticated post/create/receipt/reaction/comment/remove repository/API: AF09, `services/gateway/src/audio_posts/**` | IMPLEMENTED_UNVERIFIED isolated | Node package/Fastify/PG NOT_RUN; AF00 registration missing |
| AF09-02 | PG feed/save/follow/creator/count/queue: AF09, `adapters/storage/postgres/src/audio_posts/**` | IMPLEMENTED_UNVERIFIED isolated | Real PG tests NOT_RUN |
| AF09-03 | Verified mic capture/permission/preview/trim, owned private media upload/retry: AF05/AF15 | MISSING connected source | Flutter/native/object E2E NOT_RUN |
| AF09-04 | Feed/cache/composer/follow/creator/report/comments/screens: AF09 `apps/mobile/lib/src/audio_posts/**` | PARTIAL, existing source; old comment history still capped in feed | Flutter tests NOT_RUN; AF00 mount missing |
| AF09-05 | **New:** PG cursor + service + authenticated page route, `repository.ts`, `contract.ts`, `service.ts`, `routes.ts`: AF09 this claim | IMPLEMENTED_UNVERIFIED at commits above | Node + PG checks NOT_RUN; shared Gateway unregistered |
| AF09-06 | **New:** production Gateway Flutter comments transport and regression, `audio_post_transport.dart`, `comments_pagination_test.dart`: AF09 this claim | IMPLEMENTED_UNVERIFIED | Flutter analyzer/test NOT_RUN |
| AF09-07 | **New:** mount accessible Load older comments, bounded retry/no duplicate/account/post generation fence, `audio_post_feed_screen.dart` + tests: **current active AF09 0517 feed owner** | **MISSING** feed UI hookup, bounded request sent on PR #609 comment `6093751421` | Must commit and execute Flutter/widget tests before any source-close claim |
| AF09-08 | AF08 session, AF15 signer/visibility, post/follow/creator/playback/report Gateway factories under `services/gateway/src/{app,main}.ts`: AF00/AF08/AF15 | **MISSING shared composition** | Auth/tenant/blocked negative E2E NOT_RUN |
| AF09-09 | Append-only social schema `database/migrations/**`: AF00 and F11 | **MISSING allocated migration** | PG apply/rollback/restart NOT_RUN |
| AF09-10 | Trusted durable processing worker/membership/media/retention `services/worker/src/main.ts`: AF00/AF09/AF15 | **MISSING worker registration** | Crash/retry/double worker NOT_RUN |
| AF09-11 | Authorized playback URL, focus, revocation, genuine listen accounting: AF05/AF15/AF09 | PARTIAL isolated player/ticket, missing qualified source | Two-device/private object NOT_RUN |
| AF09-12 | Talks five-tab + creator/composer/player/report transport injected from `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`: AF00 | **MISSING shared shell composition** | Flutter/APK NOT_RUN |
| AF09-13 | Canonical TalkSafety moderation resolution for `published-audio:<id>`: AF00/AF08 | **MISSING source integration** | Moderator/denial tests NOT_RUN |
| AF09-14 | Publish idempotency, encrypted account draft and server receipt: AF09 | IMPLEMENTED_UNVERIFIED isolated | Restart/account-change source and widget tests NOT_RUN |
| AF09-15 | One deployment-audited nondeploying integration baseline + PR #497/local APK reconciliation + tested exact merged SHA: AF00/AF13 | **NOT INTEGRATED**, baseline not identified | Source/Flutter/PG/Android and restore NOT_RUN |
| AF09-16 | Real signed two-account capture→upload→publish→read/listen/follow/comment/report/delete & restore: AF09/AF05/AF13/AF00 | **MISSING connected full journey** | Real E2E NOT_RUN |

This finite list is the workstream-level record. AF00, the owner of the global `docs/NEXT-WAVE-DELIVERY-20261010.md`, must incorporate it on the single reviewed baseline; do not edit main or AF00's shared files from a feature PR.

## Executed checks vs unavailable runners

The private repo could be read through authenticated GitHub connector, and all added source blobs/tests were fetched back. **27/28 targeted source-line assertions found expected structures; the one missing literal was only document wording, not a code check.** The exact fetched Node test was copied byte-for-byte to `/tmp/af09_comments_pagination.test.mjs`, verified with `git hash-object` = GitHub blob `03394c56f336955d18470f36a4ca338e37323142`; `node --check` **PASS syntax only**. Attempted `node --test /tmp/af09_comments_pagination.test.mjs` **BLOCKED** (exit 1, `ERR_MODULE_NOT_FOUND: /tmp/service.js` because the real repository checkout/transpiled JS is unavailable). This is source readback and syntax, **not passing repository tests.** Local runtime checked: `node v22.16.0`, `npm 10.9.2`, `tsc 5.8.3`, `git 2.47.3`. Unavailable: `pnpm`, `flutter`, `dart`, `psql`, `docker`; private checkout absent. Command `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/main` failed with `Could not resolve host: github.com`. Project requires Node24/pnpm12; **no actual Node package/Flutter/PG E2E test was run here**. Zero-step CI and build-rate-limit status do not count as tests.

**Execution owner AF13 / qualified AF00 Node24 + pnpm12 + private checkout runner, on exact *latest* #609 SHA:**
```sh
pnpm install --frozen-lockfile
pnpm -r typecheck
node --experimental-strip-types --test services/gateway/src/audio_posts/comments_pagination.test.mjs
pnpm --filter @masanawa/gateway-service test
```
**Execution owner AF13/AF00 Flutter runner:**
```sh
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_transport.dart test/audio_first/af09/comments_pagination_test.dart
flutter analyze lib/src/audio_posts test/audio_first/af09
flutter test test/audio_first/af09/comments_pagination_test.dart test/audio_first/af09/feed_test.dart
```
**Execution owner AF13/F11 real disposable PostgreSQL18:** apply AF00-reviewed migration, seed two tenants/posts with >50 comments including same-microsecond timestamps, deleted/missing cursor and blocked author, assert no duplication/foreign data across pages and correct rollback/restart; then fix any real errors before integration. **AF00** must test Gateway route wiring plus shell after composing on one audited nondeploying source SHA. **AF05/15** supply actual media and physical device proof. No provider, payment, migration, cloud or production action executed.

**Next exact remote source owner/action:** the active AF09 feed owner takes the bounded `audio_post_feed_screen.dart` comment paging UI and tests, then AF00 under its own claimed shared paths composes the authenticated routes, SQL, worker and shell. AF00 updates the global checklist, audits preview/auto-deploy triggers, and publishes one unified tested SHA. Tests/source-only cannot substitute missing UI/API bindings, migrations, source conflicts or media. Do not request the owner's local pull yet.
