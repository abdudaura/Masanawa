# AF09 — Discover feed microsecond-safe continuation, PR #609

**Owner / claim:** AF09 #609 GPT-6 feed correctness, `af09-609-feed-pagination-20261010-gpt6-0252` in `factory/claims`; read back before editing. **Branch / PR:** `work/af09-published-audio-20261010-gpt6`, https://github.com/Baatiku/masanawa/pull/609. **Fresh main:** `c7f7280e640d3098be3e26f05149a0d66085441b`. Current PR head must be refreshed because other AF09 owners share this existing branch.

## Customer defect closed in source

Discover queried posts using `(created_at,post_id)` as a PostgreSQL keyset, but previous cursor encoded `Date.parse(createdAt)` in whole milliseconds. PostgreSQL timestamps have microseconds, so advancing to e.g. `.123000Z` after a row at `.123789Z` skipped another post at `.123456Z`. Multiple uploads in the same millisecond are a plausible normal customer event, not a speculative guard.

- `adapters/storage/postgres/src/audio_posts/repository.ts`: query now selects an exact UTC microsecond timestamp alias for each scanned row, encodes the exact `[timestamp,postId]` tuple in a bounded opaque base64url cursor, and uses the original six-digit timestamp as the next `$2::timestamptz` bind. Page cursors advance over hidden authors without losing precision; malformed cursors fail before SQL. No schema, client wire-field or other owner paths changed.
- `adapters/storage/postgres/src/audio_posts/repository_pagination.test.mjs`: three actual adapter tests authored with deterministic mocked PG rows (same-millisecond ordered posts, visibility-filtered author, invalid cursor). Real DB behavior is **not** proven by this mock.

**Source commits:** `7f111e21279c0d83aff4e1e3220fa7d5e1fbe822` initial adapter, `e68fc4c4dbf4539d6080db715f1b5cc425e019a9` corrected timestamp regex, `e18f92b000c74bd071ddefe646f6904f05766f7a` regression tests. Exact code blob readback from PR was completed. Do not revert the regex correction.

## Parent Published Audio Talks finite source-closure checklist

| ID | Required source / owner | Current source state | Execution / integration |
| --- | --- | --- | --- |
| AF09-01 | Typed post contract, publish idempotency, feed/mine/saved/comments/reactions and Postgres repository; AF09, `services/gateway/src/audio_posts/{contract,service,routes}.ts`, `adapters/storage/postgres/src/audio_posts/repository.ts` | IMPLEMENTED_UNVERIFIED on PR #609; cursor precision repaired | NOT_RUN at unified head; no integrated SHA |
| AF09-02 | Deterministic public feed pagination through hidden authors with PostgreSQL microsecond cursor; AF09, adapter + `repository_pagination.test.mjs` | IMPLEMENTED_UNVERIFIED on this PR; regression tests authored | NOT_RUN: Node24/repository checkout + DB needed |
| AF09-03 | Actual recorded/previewed/uploaded/verified media asset and permission/offline/retake handling; AF05/AF15, mobile media adapter and existing media authority | MISSING connected production adapter; composer uses injectable callback | NOT_RUN; exact AF05 bounded transfer |
| AF09-04 | AudioPost composer, feed, My Talks, saved library, following and comment controls, playing/stop/error/account fencing; AF09 in `apps/mobile/lib/src/audio_posts/**` | Source modules present, some partially wired; finish owner-visible navigation and lifecycle | NOT_RUN Flutter; AF00 route hook required |
| AF09-05 | Authenticated Gateway composition, AF08 actor resolver, block policy, registered following/playback/post routes; AF00 with AF08/AF09, Gateway shared composition | MISSING connected source; isolated route modules not a reachable API | NOT_RUN; AF00 exact-file transfer |
| AF09-06 | Allocated append-only `social.audio_posts` + comments/reactions/follow/processing migrations/FKs; AF00 registry owner | MISSING installed migration; SQL proposal in AF09 handoff | NOT_RUN disposable PG replay |
| AF09-07 | Private media streaming/signer and authenticated playback ticket at trusted host, range/expiry/revocation; AF05/AF15 + AF00 | Isolated ticket/player source; real signer binding MISSING | NOT_RUN object/device/provider |
| AF09-08 | Publish-once processing queue, verified moderation and worker registration/retry; AF09 queue+worker owners, AF00 composition | Queue/worker modules present but worker registration still MISSING | NOT_RUN worker + durable restart + duplicate prevention |
| AF09-09 | All customer journeys: create→process→feed→listen, follow/comment/like/save/remove, two accounts/tenant/visibility, permission/offline/retry/deletion; AF09/AF13/AF00 | MISSING connected E2E evidence and source composition | NOT_RUN exact-head Flutter/Gateway/PG/device |
| AF09-10 | Single reviewed non-deploying integration, #497/owner-local reconciliation and rollback-safe activation; AF00 | No integrated verified unified SHA; draft PR source only | NOT_RUN; production activation forbidden |

Statuses above are about **source**, not a declaration that the whole milestone works. Every MISSING source item must be implemented remotely before requesting local pull. The assigned dependency owner must publish any bounded shared-path transfer through the registry, not silently seize AF00/AF05/AF08 paths.

## Checks / execution ownership

- **PASS structural only:** GitHub blob readback of adapter and authored tests at the named source commits, plus registry CAS claim/readback. This is not compilation/test evidence.
- **BLOCKED / NOT_RUN:** `node --experimental-strip-types --test adapters/storage/postgres/src/audio_posts/repository_pagination.test.mjs` on a Node >=24 checkout. Current sandbox has Node 22.16 and no private repository checkout; direct `git ls-remote https://github.com/Baatiku/masanawa.git` returns `Could not resolve host: github.com`. **Execution owner:** AF13 or a capable checked-out runner at exact latest PR SHA; reproduce first, then fix any failures here.
- **BLOCKED / NOT_RUN:** `pnpm install --frozen-lockfile && pnpm --filter @masanawa/postgres typecheck && pnpm -r typecheck && pnpm test:ci`. Requires repository checkout, compatible Node >=24 and pnpm 12.8.2. **Execution owner:** AF13 / AF00.
- **BLOCKED / NOT_RUN:** `cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts && flutter test test/audio_first/af09`; Flutter/Dart not in this container. **Execution owner:** qualified Flutter runner, then AF05 physical device.
- **BLOCKED / NOT_RUN:** Apply append-only migration in disposable PostgreSQL and execute cross-account same-millisecond DB isolation, real verified upload, processing+retention, playback range/revocation and two-device audio focus. **Owners:** AF00 migration/integration, AF05/AF15 media, AF13 execution.

## Immediate next implementation transfer

**AF00:** register the existing authenticated AF09 route/service/media/queue composition in the single reviewed safe baseline with exact-path claim and migration allocation. **AF05/AF15:** provide `AcquireVerifiedPostAudio` backed by real owned media upload and ticket signer, not a raw client path. **AF09:** keep implementing remaining missing source on PR #609 without creating another branch; do not replace the concurrently claimed playback or processing files.

Merge remains blocked by unexecuted exact-head checks, unallocated migration, unconnected Gateway/shell/media, and unconfirmed nondeploying baseline. No production deployment, external spending or APK operation performed.
