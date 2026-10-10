# AF09 — Published Talk reporting mounted on feed cards (2026-10-10)

**Parent milestone:** Published Audio Talks (UX-A08/A09), existing [PR #609](https://github.com/Baatiku/masanawa/pull/609), branch `work/af09-published-audio-20261010-gpt6`. **Source state:** PARTIAL_IMPLEMENTATION; this UI subitem IMPLEMENTED_UNVERIFIED, not integrated or deployed. Main at inspection `7c443966be97e9092cbc1fb98562c75253434326`; refresh before composition. Exact-path CAS claim `af09-609-report-feed-mount-gpt6-20261010` published and read back at `factory/claims`. An expired older playback feed claim was reviewed and recorded in lease history; its source remained preserved. No separate PR/feature branch/worker/migration/provider was created.

## Closed source item — customer report card

- `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart`, commit `e03f56a7abe600926bd26751dd135e3126593da5`: inject optional canonical `PublishedAudioReportTransport` and display an actual `AudioPostReportAction` only for **published** Discover/Following/Saved cards when the real report route is configured. My Talks do not display the self-report control; offline/unconfigured routes never show a fake action. Existing cache, player, comments and reactions remain intact.
- `apps/mobile/lib/src/audio_posts/audio_post_report_action.dart`, commit `d593327cd6fc3db00db7458c1484ade165a2362d`: live caller authorization predicate is checked before report submission and again before showing a successful receipt; account switch or transport replacement cannot reuse the earlier dialog. The server remains the final authority. Explicit confirmation, reason, details, retry key and error states stay canonical.
- `apps/mobile/test/audio_first/af09/feed_test.dart`, commit `da1c116954997c0551421fef33db0558b1499de2`: authored widget cases for unconfigured/connected action, cancel/submit, private My Talks and changed-account prevention.
- `apps/mobile/test/audio_first/af09/report_action_test.dart`, commit `18c7785fbe64fc94b6022b5f8c4385df273552c2`: authored permission-rotation tests before and during asynchronous submission, including withholding stale success.
- Existing canonical `services/gateway/src/audio_posts/reporting.ts` and `audio_post_report_action.dart` transport are reused, **not duplicated**. AF00 still must mount the authenticated server report route, register canonical moderator target resolution for `published-audio:<postId>`, and inject the client transport into the five-tab Talks shell. The UI alone is not a working customer report endpoint.

## Second essential source correction — Following pagination was rejecting valid timestamps

Fresh source inspection found `adapters/storage/postgres/src/audio_posts/following_repository.ts` had a **double-escaped regular-expression literal** `/^\\\\d{4}.../` for the SQL microsecond timestamp. Unlike Discover's corresponding `/^\\d{4}.../`, the original Following matcher evaluated `2026-10-10T02:51:54.123789Z` as **false**. This rejects real encoded cursors and raises `audio_posts.invalid_following_row` when the Following or creator listing needs a continuation token. It is a demonstrated customer-listing blocker, not a speculative helper.

- Fix committed **`e80da36fb4592f6a83fceca037d32932a2159b9d`**, blob `b7bf5bb2d876d0b32831cfeb6bcd506e56e8ad41`: change *only* that regex literal to the correct single-escaped `\\d` and `\\.` tokens, preserving cursor format, tenant/visibility filter and full six-digit SQL timestamp.
- Existing same-PR `adapters/storage/postgres/src/audio_posts/following_repository_pagination.test.mjs` already has actual Following/creator same-millisecond pagination, malformed cursor, hidden-author and invalid-row cases authored. No duplicate test runner/source authority was created. Tests remain **AUTHORED_NOT_RUN** because the checkout/dependencies/TypeScript/PG are unavailable.
- **Executed source-derived JS regex check:** pre-fix source pattern rejected a valid timestamp; post-fix pattern passed **10/10** explicit acceptance/negative timestamp cases read from the committed blob. This is a narrow real JavaScript regexp evaluation, **not** a repository Node package test, PostgreSQL query, source compiler, Flutter test or E2E result.
- AF13/qualified AF00 runner next command at the **latest combined #609 SHA**: `node --experimental-strip-types --test adapters/storage/postgres/src/audio_posts/following_repository_pagination.test.mjs`, plus actual PostgreSQL microsecond pagination, tenant/filter and cursor-boundary checks. Correct only on observed failures; keep no false PASS.

## Finite parent-milestone source checklist

| ID | Required implementable source and exact boundary | Owner | Source state on PR #609 | Separate execution/integration |
| --- | --- | --- | --- | --- |
| AF09-01 | Post/reaction/comment/delete/receipt Gateway contracts, `services/gateway/src/audio_posts/{contract,service,routes}.ts` | AF09 | IMPLEMENTED_UNVERIFIED | Node package + Fastify tests NOT_RUN; unregistered in shared Gateway |
| AF09-02 | PG feed/saved/follow/creator/comment/count adapter, `adapters/storage/postgres/src/audio_posts/**` | AF09 | IMPLEMENTED_UNVERIFIED | Disposable PG tests NOT_RUN |
| AF09-03 | Microphone capture/permission/preview/trim and verified account-owned upload, existing native/media adapter | AF05 + AF15 | MISSING connected production implementation | Android and storage/provider qualification NOT_RUN |
| AF09-04 | Composer, encrypted retry, feed/cache, Following, comments, creator and report UI `apps/mobile/lib/src/audio_posts/**` | AF09 | IMPLEMENTED_UNVERIFIED isolated | Flutter analyzer/widgets NOT_RUN; AF00 shell injection MISSING |
| AF09-05 | Authenticated post/follow/creator/playback/report Gateway routes with AF08 session, visibility and AF15 signer `services/gateway/src/{app,main}.ts` | AF00 + AF08/15 | MISSING shared composition | Auth/blocked/tenant negative E2E NOT_RUN |
| AF09-06 | Append-only allocated social post/reaction/comment/follow/queue schema `database/migrations/**` | AF00 | MISSING allocated migration | Disposable PG install/rollback/restart NOT_RUN |
| AF09-07 | Verified private playback signing/focus/revocation/listen events and real play count | AF05 + AF15 + AF09 | PARTIAL isolated ticket/player, MISSING trusted end-to-end listen accounting | Object/device NOT_RUN |
| AF09-08 | Durable processing/moderation queue with trusted service worker startup `services/worker/src/main.ts` | AF09 worker + AF00 | PARTIAL modules, MISSING shared startup | Retry/crash/race PostgreSQL execution NOT_RUN |
| AF09-09 | Report UI control on published cards + account-fenced dialog, `audio_post_feed_screen.dart`, `audio_post_report_action.dart` | AF09, this claim | IMPLEMENTED_UNVERIFIED at `e03f56a7`, `d593327c` | 14/14 source-structure predicates only; Flutter tests NOT_RUN |
| AF09-10 | Report moderation target handling and route injection, `reporting.ts` plus canonical TalkSafety/AF00 Gateway registration | AF00 + AF08 | MISSING composition/review readback | Explicit moderation/report-negative integration NOT_RUN |
| AF09-11 | Talks nav to feed, creator and composer and transport injection `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` / root router | AF00 | MISSING shared shell composition | Flutter widget/APK NOT_RUN |
| AF09-12 | Full two-account capture→upload→publish→feed→listen/follow/comment/report/delete, fail/retry/restore | AF09/AF05/AF13 + AF00 | MISSING connected source across owners | End-to-end NOT_RUN |
| AF09-13 | Review one demonstrably non-deploying integration target, reconcile #497 and local-only fixes; publish unified source SHA | AF00 | NOT INTEGRATED; no safe target elected | Deployment audit and integrated SHA checks NOT_RUN |
| AF09-15 | Correct Following/creator exact microsecond cursor admission, `adapters/storage/postgres/src/audio_posts/following_repository.ts` | AF09, this claim | SOURCE_CHECKED_ISOLATED at `e80da36f` (10/10 source-derived regex cases) | Existing pagination repository tests and real PG NOT_RUN |
| AF09-14 | Preserve account-fenced secure attempt and server receipt reconciliation, `audio_post_draft_store.dart` and `services/gateway/src/audio_posts/{service,routes}.ts` | AF09 | IMPLEMENTED_UNVERIFIED | Restart/account-race tests AUTHORED NOT_RUN |

**Owner pre-pull rule:** AF00 appends this finite checklist into current `docs/NEXT-WAVE-DELIVERY-20261010.md` when rebasing/integrating; the older PR #609 branch does not yet contain that newer main-only document. Do not create a duplicate competing global delivery authority. No local pull until required source (not just test execution) is completed and unified. An absent runner never defers Gateway routes, DB schema, native/media bindings or shell hookup.

## Exact check evidence and execution transfer

**Executed:** GitHub source blob readback of all five changed files and 14/14 deterministic static report UI predicates; 10/10 source-derived JS regexp timestamp cases on the corrected Following matcher. This is **source inspection only**, not an executable Flutter test result and not evidence of E2E. No dependency/mock billing/provider was called. No main/deployment change.

**Observed runner:** Node `v22.16.0` and TypeScript `5.8.3`; `pnpm`, Dart/Flutter, PostgreSQL and Docker executables unavailable, no private git checkout. `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/main` → `Could not resolve host: github.com`. Root expects Node `>=24 <25`, pnpm 12, TS7. The following remain **BLOCKED / NOT_RUN**:

```sh
# AF13 / qualified AF00 Flutter runner, at final exact #609 HEAD
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_feed_screen.dart lib/src/audio_posts/audio_post_report_action.dart test/audio_first/af09/feed_test.dart test/audio_first/af09/report_action_test.dart
flutter analyze lib/src/audio_posts test/audio_first/af09
flutter test test/audio_first/af09/feed_test.dart test/audio_first/af09/report_action_test.dart

# AF13 / qualified AF00 Node24/pnpm12 runner
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm --filter @masanawa/gateway test
node --experimental-strip-types --test services/gateway/src/audio_posts/reporting.test.mjs
```

**Next exact connected source owner/action:** AF00 owns `services/gateway/src/{app,main}.ts`, `database/migrations/**`, `services/worker/src/main.ts` and `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`. After auditable path claim or explicitly accepted bounded transfer, compose all AF09 service factories with the canonical AF08 actor, AF15 visibility/signer and TalkSafety moderator resolve, allocate the SQL migration, worker registration, and inject `GatewayPublishedAudioReportTransport` plus the real feed/composer/player in Talks. AF05/AF15 implement verified microphone/private upload/play focus. AF13 runs actual source/PG/Flutter tests on the combined SHA and repairs detected failures. AF00 must audit deployment triggers and publish one reviewed, tested non-deploying integration SHA before any local handoff. Continue this existing milestone PR; do not make a competing integrator/helper branch.

**Release:** not qualified, not deployed. **No request to pull locally.**
