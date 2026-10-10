# AF09 Published Talks — serialized listening continuation (2026-10-10)

**Parent:** Published Audio Talks, existing draft [PR #609](https://github.com/Baatiku/masanawa/pull/609), branch `work/af09-published-audio-20261010-gpt6`. **PARTIAL_IMPLEMENTATION**, not integrated, device-qualified or deployed. Claim `af09-609-playback-sequencing-gpt6-0531` published/read back in `factory/claims`; exact paths: `apps/mobile/lib/src/audio_posts/audio_post_playback.dart`, `apps/mobile/test/audio_first/af09/playback_widget_test.dart`, this handoff. Concurrent feed, composer, comments, DB/service and AF00 owners untouched.

## Actual customer-source increment

Previously `play()`, `stop()`, completion and disposal could call native async `start()`/`stop()` concurrently; an old Talk could begin after a newer stop or another Talk's start. AF09's existing ticket-backed `AudioPostPlaybackController` now queues all native media operations in request order, fences queued starts by session/account/generation, refuses short-lived AF15 tickets that become expired while waiting, and does not let stale completions stop newer playback. Session revocation or account change clears the old loading state and stops any stale output; failures keep their existing sanitized error. No new media signer, audio focus authority, backend route, public URL or player instance. Existing AF05 audio session and AF15 ticket contracts remain authoritative.

Source commits (same PR): `4f83e52c`, `542754c9`, `26f90472`, `cd5048a1`, `5c9b4e71`, `8b373953`, `29123656`. Four additional pure Dart controller regressions authored: rapid switch, stop during delayed native start, session rotation during native start, ticket expiry during a delayed transition. Original widget tests retained; pending session rotation now asserts the loading state clears.

## Finite parent source-closure ledger (separate execution)

| Item / exact authority | Source state | Execution or integration |
| --- | --- | --- |
| AF09 publish/receipt/idempotency/comments/follows/saves/report/reactions/creator and queue: `services/gateway/src/audio_posts/**`, `adapters/storage/postgres/src/audio_posts/**` | IMPLEMENTED_UNVERIFIED isolated; parallel claims still active | Node/Fastify/PG NOT_RUN; AF00 root factories not connected |
| AF09 feed, composer, draft, comment sheet, creator, playback: `apps/mobile/lib/src/audio_posts/**` | PARTIAL; this listening race correction IMPLEMENTED_UNVERIFIED; concurrent comments/creator/composer changes being applied | Flutter NOT_RUN; AF00 shell still disconnected |
| AF05+AF15 real microphone permission, record/preview/trim, private upload verification and AF15 playback/download/focus/retention | MISSING connected source | Actual Android/private-object E2E NOT_RUN |
| AF00 authenticated Gateway app/main injections, AF08 actor, canonical blocked/visibility/TalkSafety/AF15 media, creator/following/report/playback factories: `services/gateway/src/{app,main}.ts` | MISSING composition; exact-path AF00 transfer required | Tenant/block/revocation/denial E2E NOT_RUN |
| AF00 allocated append-only `database/migrations/**` social posts/comments/follows/queue and media references | MISSING registered migration | Disposable PostgreSQL apply/rollback NOT_RUN |
| AF00 trusted bounded processing scheduler and startup at `services/worker/src/main.ts` | MISSING registration, AF09 worker module existing | Crash/retry/two-worker NOT_RUN |
| AF00 five-tab Talks destination + verified media injection at `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` | MISSING shared composition; AF09 destination isolated | Shell/deep-link/APK NOT_RUN |
| AF00 reviewed non-deploying integration baseline, conflict reconciliation (#497 and owner unseen local APK/source) | NO unified integration SHA | Real merged source/API/device NOT_RUN |
| AF13 executable Node24/pnpm12/Flutter/PG and AF05/15 two-account end-to-end verification | Authored tests only | BLOCKED here; exact-head run assigned to qualified AF13/AF00 runner |

## Actual capability checks and executable owner

Here: container `node -v` is `v22.16.0`, below repository Node24; `pnpm`, `flutter`, `dart`, `psql` executables absent; `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/main` failed `Could not resolve host: github.com`. No private checkout mounted. GitHub connector source/claim readback is structural inspection, **not Dart analyze/test PASS**. No mocked/proxy tests are represented as real checks.

**AF13 or Flutter-capable AF00 runner**, at final reviewed PR/combined SHA:
```sh
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_playback.dart test/audio_first/af09/playback_widget_test.dart
flutter analyze lib/src/audio_posts test/audio_first/af09
flutter test test/audio_first/af09/playback_widget_test.dart
```
Then `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm --filter @masanawa/gateway test`, disposable PostgreSQL schema/visibility/concurrent publication, and actual two-account record/upload/listen/follow/comment/delete with audio focus, offline/retry, logout/revocation and private-object access. Fix actual compilation/test failures at the exact tested SHA.

## Concrete transfers; no local pull

AF00 must register real authenticated post/report/profile/follow/playback route factories, migration, worker, feature destination and single safety/media policy on **one** deployment-audited nondeploying integration baseline; identify reviewed SHA, resolve #497 and protect owner's still-unreceived local source/APK. AF05/AF15 own private capture/upload/signing/focus; AF09 continues owned feature interactions; AF13 executes tests. No second integrator, helper branch, main merge or production operation was performed. Do **not** ask owner for local pull until remotely implementable source and composition are complete. This record closes only the concurrent listening control source item, not Published Talks.
