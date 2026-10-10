# AF09 #609 — executable social schema source, 2026-10-10

**Parent milestone:** Published Audio Talks (AF09-01..14), existing [PR #609](https://github.com/Baatiku/masanawa/pull/609) branch `work/af09-published-audio-20261010-gpt6`; **PARTIAL_IMPLEMENTATION / NOT INTEGRATED / NOT DEPLOYED**. Latest main observed `7c443966be97e9092cbc1fb98562c75253434326`. Window `af09-609-social-schema-gpt6-0552` has an acquired and read-back exact-path CAS claim on `factory/claims`.

## Required source implemented in the same feature PR

- `adapters/storage/postgres/src/audio_posts/schema.sql`: complete PostgreSQL source for **six** AF09 tables with account/tenant-scoped keys, duplicate-safe post requests/comments/follows, moderation revision & published status constraints, optimistic feed and microsecond keyset indexes, media-aware listen sessions and one-qualified-listen-per-day persistent counters. Source commit `99c02bcbc9a444c0f55ee2889fb00d63432d7de0`.
- `adapters/storage/postgres/src/audio_posts/schema_integration.test.mjs`: **authored real disposable PostgreSQL test** that installs the feature SQL only under an explicit disposable database gate and verifies cross-tenant/post FKs, duplicate request/comment/follow/reaction denial, duration constraints, listen-session timestamps, and daily count idempotency. Source commit `56e5d3fbd32fdd2debdb71e6e70c0fcda591b3cb`. Authored does **not** mean executed.

This is an **unnumbered feature-owned migration proposal**, intentionally not installed, registered or run in production. AF00 has sole authority to assign numbered migration, cross-check existing schemas/identity/media FKs, inspect RLS/grants and migrations/production deploy automation, review revision/visibility and integrate additive DDL. Source SQL is now present rather than delegated as local-only missing code.

## Finite parent milestone checklist at this source checkpoint

| ID | Required source/path and owner | Current source | Execution + integration |
|---|---|---|---|
| AF09-01 | Posts/reactions/comments/following/report/playback/listen services and 18-route bundle `services/gateway/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED on #609 | Real Gateway mount MISSING; Node24 tests NOT_RUN |
| AF09-02 | Post/comment/follow/queue/listen repositories `adapters/storage/postgres/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED on #609 | Actual Postgres tests NOT_RUN |
| AF09-03 | Verified recording/permission/preview/trim/private upload AF05/AF15 | MISSING connected media source | Android/object readback NOT_RUN |
| AF09-04 | Published feed/comment/creator/follow/saves/composer client `apps/mobile/lib/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED | Flutter analyzer/tests NOT_RUN |
| AF09-05 | Authenticated AF08 actor + block/visibility/media/safety route mount `services/gateway/src/{app,main}.ts`; AF00 | MISSING protected composition | API E2E NOT_RUN |
| AF09-06 | Six tables `adapters/storage/postgres/src/audio_posts/schema.sql` AF09, numbered append-only migration `database/migrations/**` AF00 | Feature SQL **IMPLEMENTED_UNVERIFIED** this checkpoint; numbered migration MISSING | Disposable schema test AUTHORED NOT_RUN; schema not installed |
| AF09-07 | Real private signed streaming/focus/revocation/qualified-listen authority AF05/15/09 | Isolated listen adapters; MISSING media integration | Device/storage tests NOT_RUN |
| AF09-08 | Trusted publication queue/startup `services/worker/src/main.ts` AF00 | Isolated worker authored; actual startup MISSING | Restart/lease tests NOT_RUN |
| AF09-09 | Canonical TalkSafety target resolver/report API mount AF00 | Feature report source authored; root resolver MISSING | Negative/blocked privacy E2E NOT_RUN |
| AF09-10 | Feature-local `PublishedTalksDestination` and recovered composer AF09 | IMPLEMENTED_UNVERIFIED | Flutter UI tests NOT_RUN |
| AF09-11 | Five-tab Talks default shell injection `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` AF00 | MISSING | Navigation/device NOT_RUN |
| AF09-12 | Two-account record→upload→publish→process→listen/follow/comment/report/delete AF09/05/13 | MISSING connected journey/test | E2E NOT_RUN |
| AF09-13 | Single audited nondeploying unified SHA + #497/unseen local APK reconciliation AF00 | NOT INTEGRATED, safe SHA none | Never ask for local pull |
| AF09-14 | Account-bound recovery, SQL cursor precision, listen counting and removal retry AF09 | Isolated portions IMPLEMENTED_UNVERIFIED | Real Node/PG/Flutter tests NOT_RUN |

**Now closed at feature-owned SOURCE_WRITTEN level:** six-table PostgreSQL SQL and disposable integration test source. **Still open:** AF00 must allocate/install reviewed numbered migration and wire live app/worker/shell; AF05/15 must provide real media; AF13 must run checks. Claim release does not mark AF09-06 INTEGRATED.

## Exact verification and ownership transfer

Read back the two GitHub source blobs. Current runner limitations observed in session: Node v22.16.0 versus required Node24, `pnpm` / `dart` / `flutter` / `psql` absent, no checkout because `git ls-remote https://github.com/Baatiku/masanawa.git` fails DNS. A GitHub source/blob readback or static JS parse is **not** PostgreSQL execution. All database E2E tests here **NOT_RUN/BLOCKED**.

**AF13/qualified PostgreSQL18 runner**, after checkout of final exact PR/unified SHA, on a **fresh disposable database** with name ending `_af09_test`:
```sh
pnpm install --frozen-lockfile
AF09_SCHEMA_DISPOSABLE=yes AF09_SCHEMA_TEST_DATABASE_URL=postgresql://localhost/masanawa_af09_test node --test adapters/storage/postgres/src/audio_posts/schema_integration.test.mjs
pnpm -r typecheck
pnpm --filter @masanawa/gateway-service build
cp services/gateway/src/audio_posts/register_feature.test.mjs services/gateway/dist/audio_posts/register_feature.test.mjs
node --test services/gateway/dist/audio_posts/register_feature.test.mjs
cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts test/audio_first/af09 && flutter test test/audio_first/af09
```
A missing AF09 env gate skips rather than passes the PG test. No test should be used with production/staging data. AF13 must capture actual applied SQL, tenant/privacy/recovery results and repair source failures on the existing PR before integration.

**Exact-path AF00 transfer (request, not ownership):** integrate `adapters/storage/postgres/src/audio_posts/schema.sql` into allocated numbered `database/migrations/**` after reviewing actual current schema, existing migrations, cross-slice identity/media FKs, permissions and deployment hooks. Validate the new tables before enabling `registerPublishedAudioFeatureRoutes` in the AF00-owned `services/gateway/src/{app,main}.ts`; wire worker startup and real audio Talks default shell. Single reviewed, audited nondeploying integration SHA remains unavailable. AF05/15 own secure mic/upload/media authority, AF13 the executable runner. Preserve owner-local work and do not request local pull until required source and integration are complete.
