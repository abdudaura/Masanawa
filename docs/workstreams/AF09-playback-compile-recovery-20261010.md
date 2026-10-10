# AF09 #609 — playback source compilation recovery and parent closure (2026-10-10)

**Existing PR:** https://github.com/Baatiku/masanawa/pull/609  
**Branch:** `work/af09-published-audio-20261010-gpt6` (shared feature branch; other AF09 writers remain active)  
**Main refreshed:** `7c443966be97e9092cbc1fb98562c75253434326`  
**Source checkpoint at review:** `7a13a7c86c3319a7d4eeb8e205db83979d10b4cf` — reread latest head before any integration.  
**Claim:** `af09-609-playback-compile-recovery-gpt6-0600`, exact paths on `factory/claims`, read back before source edits.  
**Status:** PARTIAL_IMPLEMENTATION. No qualified integrated SHA, APK or production release.

## Closed source blocker — preserve previous implemented behavior

`apps/mobile/lib/src/audio_posts/audio_post_playback.dart` was genuinely malformed: listen-session UUID regex was cut off mid-literal; an older `JustAudioTalkOutput` and `AudioPostPlaybackController` were duplicated after the end of the newer, account-fenced listen-count player. The older tail also suppressed native playback progress. A Dart compiler could not accept this source.

- **`9858560b0017ca6bb48db6d2ae791b9e8bfa669c`** — restored complete validated RFC-4122 listen-grant regex, removed only the stale duplicated tail, kept the newer serialized async native player, signed HTTPS host and expiry checks, session/account fencing, actual native listened-progress receipts, and callback compatibility.
- **`e1c032ed2d0c928a8c8663ce389668f04c85ae1f`** — added valid UUID / forged token / wrong version / wrong variant / traversal regression cases in `apps/mobile/test/audio_first/af09/playback_widget_test.dart`. Authored; not executed.
- Verified GitHub blob write/readback, single class declarations and preserved source markers; **these are structural checks, not Flutter analyzer/widget test PASS**. No changes to active composer, capture, feed, backend, migration, AF00 or native paths.

## Finite Published Audio Talks closure queue

| ID | Required source + exact path owner | Source/commit state | Executed result + integration |
| --- | --- | --- | --- |
| AF09-01 | Post/feeds/comments/receipts/reactions routes `services/gateway/src/audio_posts/{contract,service,routes,register_feature}.ts` — AF09 | Isolated source in #609, 18-route pack; IMPLEMENTED_UNVERIFIED | Node/PG NOT_RUN; AF00 mount MISSING |
| AF09-02 | Social/feed/listen/follow/queue PostgreSQL `adapters/storage/postgres/src/audio_posts/**` — AF09 | Feature SQL/repository source in #609; IMPLEMENTED_UNVERIFIED | PG NOT_RUN; migration MISSING |
| AF09-03 | Recording/preview/trim/verified account-private upload AF05/AF15 and feature `audio_post_capture_sheet.dart` | Sheet and composer bridge in #609; canonical upload MISSING | Flutter/device/object NOT_RUN |
| AF09-04 | Feature feed, composer, saved/library, following, comments, report, creator and cursor pagination `apps/mobile/lib/src/audio_posts/**` — AF09 | Existing #609, library pagination is actively owned; IN_PROGRESS | Flutter NOT_RUN |
| AF09-05 | Signed private playback/listen `apps/mobile/lib/src/audio_posts/audio_post_playback.dart` — AF09 | `9858560b` compile repair, `e1c032ed` regression; SOURCE-CHECKED ONLY | Flutter/Dart NOT_RUN; AF15 real media binding MISSING |
| AF09-06 | Shared auth/blocked-user/route binding `services/gateway/src/{app,main}.ts` — AF00/AF08 | MISSING; feature-owned pack cannot mount itself | Auth/tenant integration NOT_RUN |
| AF09-07 | Append-only registered social, queue and listen migration `database/migrations/**` — AF00 | MISSING; unnumbered SQL is only a proposal | PostgreSQL migration/concurrency NOT_RUN |
| AF09-08 | Trusted processing startup `services/worker/src/main.ts` — AF00 | AF09 scheduler/processor isolated; registration MISSING | Durable worker/restart NOT_RUN |
| AF09-09 | Canonical TalkSafety target resolver for reports — AF00 | Feature report module isolated; root resolver MISSING | Denied/moderation checks NOT_RUN |
| AF09-10 | Feature creator→detail and composer→receipt in `audio_post_destination.dart` — AF09 | IMPLEMENTED_UNVERIFIED feature-local | Flutter navigation NOT_RUN |
| AF09-11 | Actual Talks centre/default shell mount `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` — AF00 | MISSING; preserve separate #600 root-nav PR | Five-tab Android/device NOT_RUN |
| AF09-12 | Two-account capture→upload→publish→process→feed→play/follow/comment/report/delete restart — AF09/05/13 | MISSING connected journey, not local-only missing code | E2E NOT_RUN |
| AF09-13 | One deploy-trigger-audited reviewed integration target, reconcile #497 and unseen owner APK — AF00 | **NONE** (no merged qualified source SHA) | Merge gate BLOCKED by missing source+tests; main unchanged |
| AF09-14 | Exact-source Node24/pnpm + Flutter/Dart + disposable PG + Android/storage qualification — AF13/AF00/AF05 | Authored test source, not executed | NOT_RUN/BLOCKED as detailed below |

**Missing source is not relabeled local-only:** AF00 must complete real authenticated Gateway factories, append-only migrations, canonical TalkSafety/worker, mobile tab and adapters. AF05/AF15 must provide real authorized microphone/object upload, private media signing/streaming and exclusive audio focus; AF09 continues current library/capture/composer and real listen-feed projection without overlap. AF13 must run full qualification on exact final SHA. No source-complete handoff until all these are resolved in the ONE reviewed safe integration baseline.

**Bounded central checklist transfer:** `docs/NEXT-WAVE-DELIVERY-20261010.md` is present in fresh `main` but **absent from this older #609 branch**. Do NOT create an add/add copy or change main from the feature branch. AF00 should incorporate this exact 14-row ledger into the parent delivery checklist on its safe integration target with ownership readback, exact integration SHA and per-row execution results.

## Actual toolchain and tests

Current execution sandbox: `node v22.16.0`, `tsc` installed; `pnpm`, `flutter`, `dart`, `psql` unavailable. `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` fails `Could not resolve host: github.com`; private checkout/dependencies unavailable. This window **did not execute** Flutter, PostgreSQL, Node monorepo suites or E2E. Blob readback and source-structure inspection are not executable test results.

**AF13 / qualified Node24+pnpm+PostgreSQL runner** at pinned final integrated SHA:
```bash
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm --filter @masanawa/gateway test
```
Run disposable PostgreSQL install/rollback, publication/visibility, listen, concurrency and worker-restart suites after AF00 allocates numbered migration. **AF13 / qualified Flutter runner**:
```bash
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_playback.dart test/audio_first/af09/playback_widget_test.dart
flutter analyze lib/src/audio_posts test/audio_first/af09
flutter test test/audio_first/af09/playback_widget_test.dart test/audio_first/af09/listen_count_test.dart
flutter test test/audio_first/af09
```
**AF05/AF15 + AF13 device runner:** real two-account Android permissions/offline/recovery/seek/focus/revocation and signed object access, storage cleanup/backup and restart. Repair any real source failures in the SAME milestone PR before reviewed safe integration. No local pull, device/package release or spend authorization requested.
