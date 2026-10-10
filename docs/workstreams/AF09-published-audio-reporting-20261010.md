# AF09 — Published Audio Talk reporting, existing PR #609

Date: 2026-10-10. Parent: Published Audio Talks (UI-04, UI-05, UI-07; UX-A08/A09). State: **PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED / NOT INTEGRATED / NOT DEPLOYED**. Existing branch `work/af09-published-audio-20261010-gpt6`. Main observed `7c443966be97e9092cbc1fb98562c75253434326`. Claimed and read back exact paths on `factory/claims` as `af09-609-published-audio-reporting-gpt6-0442`. No new PR or integration branch.

## Connected source added (not yet mounted)

- `services/gateway/src/audio_posts/reporting.ts`: authorized published-post lookup and canonical visibility gate before invoking **existing** `TalkSafetyService.report`. No duplicate report table/ledger. Uses the existing safety kind `talk` with a scoped `published-audio:<postId>` ID to avoid aliasing an older live Talk. Rejects foreign-tenant/hidden/removed/processing posts neutrally and fences a changed authenticated actor after async reads. Routes `POST /audio-posts/:postId/report`; only an accepted canonical receipt yields 202.
- `services/gateway/src/audio_posts/reporting.test.mjs`: **7 Node cases authored** for accepted report/target mapping, denied/hidden posts, malformed input, session rotation and mutation, unavailable safety receipts and unexpected dependency errors.
- `apps/mobile/lib/src/audio_posts/audio_post_report_action.dart`: actual Gateway transport and explicit report confirmation dialog, reason/details, cancellation, retry-safe client request key and typed accepted receipt. No new safety database/provider/UI framework.
- `apps/mobile/test/audio_first/af09/report_action_test.dart`: **3 Flutter widget cases authored** for opt-in submission, same-key retry after network uncertainty and disabled/cancel behavior.

Source commits: backend `d9eb48e`, tests `c6e9c4f`, mobile `3b27821`, widget tests `2fd1865`; package import fix `77d9b09`; immutable actor fence `493d515`; fence regression `2785c9d`. Final PR head must be refreshed after this handoff.

**No claim of active customer report control:** backend composition and Talks card mounting are AF00/feed-owner protected paths. Existing canonical safety registration `/safety/reports`, policy and repository are not changed; AF00 must ensure published-audio prefixed IDs are supported by moderator resolution/review before activation.

## Finite parent source checklist

| Item and source boundary | Owner | Source state | Execution / integration |
| --- | --- | --- | --- |
| AF09 report canonical adapter, `services/gateway/src/audio_posts/reporting.ts` | AF09 | IMPLEMENTED_UNVERIFIED in #609 | Node test 7 cases NOT_RUN |
| AF09 report client, `apps/mobile/lib/src/audio_posts/audio_post_report_action.dart` | AF09 | IMPLEMENTED_UNVERIFIED in #609 | Flutter test 3 cases NOT_RUN |
| AF09 social post/reaction/follow/comments repository/routes, `services/gateway/src/audio_posts/**`, `adapters/storage/postgres/src/audio_posts/**` | AF09 | PARTIAL source in #609 | Full TypeScript/PG NOT_RUN |
| AF09 recording/preview/upload, private asset verification/signing/range and one-player focus | AF05/AF15 | MISSING connected production source | Device/object/provider NOT_RUN |
| AF09 report feed action mount, `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart` | Current AF09 feed owner with bounded transfer | MISSING REPORT ACTION WIRING (other feed source exists) | Flutter analyze/widget NOT_RUN |
| AF09 Gateway actor + post/follow/playback/report routes and visibility/media injection, `services/gateway/src/{app,main}.ts` | AF00/AF08 | MISSING shared composition | Auth/visibility E2E NOT_RUN |
| AF09 append-only post/comments/queue/follow migration, `database/migrations/**` | AF00 | MISSING allocated migration | Disposable PG/restart NOT_RUN |
| AF09 worker scheduler, `services/worker/src/main.ts` | AF00/AF09 | MISSING processing registration | Queue/restart NOT_RUN |
| AF09 Talks feed/composer/creator navigation, `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` and current router | AF00 | MISSING mounted live journey | APK/device NOT_RUN; preserve unseen local fixes |
| AF09 canonical safety moderator lookup of `published-audio:` IDs | AF00/AF08 | MISSING reviewed composition | Negative report/moderation workflow NOT_RUN |
| AF09 two-account publish/process/listen/follow/comment/report/restore regression, integrated reviewed source | AF13 + all leads | MISSING end-to-end source connections | No safe integrated SHA; no device qualification |

## Exact tests and blockers

Current runner: Node `v22.16.0`, TypeScript `5.8.3`, Git `2.47.3`; repo requires Node `>=24 <25`, pnpm `12.8.2`, TS `7.0.2`. `pnpm`, `flutter`, `dart`, `psql` unavailable; `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` fails `Could not resolve host: github.com`. GitHub readback is structural, not execution.

**AF13/qualified AF00 Node runner at exact final #609 SHA:**
```sh
node --experimental-strip-types --test services/gateway/src/audio_posts/reporting.test.mjs
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm -r typecheck
pnpm test:ci
```
**Flutter runner:**
```sh
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_report_action.dart test/audio_first/af09/report_action_test.dart
flutter analyze lib/src/audio_posts test/audio_first/af09
flutter test test/audio_first/af09/report_action_test.dart
```
**AF00/AF13:** disposable PostgreSQL migration tests, authenticated two-tenant blocked/deleted/report dedupe, moderator target resolution, mobile media and full device acceptance at integrated SHA. **Do not claim PASS** until commands have run and errors repaired.

**Batched AF00 composition request (not permission to seize shared files):** register new report routes with canonical AF08 `requireActor`, already-used post repository + `PostVisibility` and existing `TalkSafetyService`; authorize the `published-audio:` target mapping and moderation readback. Bounded AF09 feed-owner transfer: insert `AudioPostReportAction` with `GatewayPublishedAudioReportTransport` on real published cards and account/session fenced lifecycle, without clobbering warm-cache/playback edits. Keep one AF00-audited nondeploying baseline, reconcile Work #497 and unseen local APK source, run exact-head tests, and publish integrated SHA. No local pull until remaining implementable source and composition are complete.
