# AF09 — Restart-safe published Talk attempt, same PR #609 (2026-10-10)

**Parent customer milestone:** Published Audio Talks (UI-04, UI-06, UI-07; UX-A08/A09). **Current state:** PARTIAL_IMPLEMENTATION, no connected E2E, no release. This is not a new PR or a substitute media uploader. Continue [PR #609](https://github.com/Baatiku/masanawa/pull/609) on `work/af09-published-audio-20261010-gpt6`.

**Window/ownership:** `af09-609-durable-publish-20261010-gpt6-0406`, CAS claim on `factory/claims`, read back before changes. Main at beginning: `6bbb689fd65d977984be2487e6a6bd56aaf83001`. Previous PR head `cc229a48c3b00ebaed3c23c30968946d0e89ac45`. Committed source checkpoints `f5f3b24047d080b81520ecbfd09aae415c3002e2`, `fd0861b5a11633b08f53a26fac41682d57f31604`, `e58c10d15dd7d28cf792f7a264eeb44ae60a20f0`, `9a77dc3bb73fe5e5f3f0476750b0da4f38b564c5`. The head advances on this shared PR; refresh it before execution or integration.

## Customer issue closed in *source*

Previously the composer generated a replay-safe request ID only in RAM. If a publish returned an unknown network outcome and Android killed the process, opening the composer generated a **new** key that could create a duplicate post. A successful API receipt was not enough to fix the restart gap.

- `apps/mobile/lib/src/audio_posts/audio_post_draft_store.dart`: versioned, validated pending-attempt shape, FlutterSecureStorage-backed encrypted device recovery slot; stores only account, original request ID, verified asset reference/duration and title—not media bytes, URLs or credentials. Wrong-account reads return no draft; corrupt/inaccessible secure state fails closed. Clear requires matching account AND request ID.
- `apps/mobile/lib/src/audio_posts/audio_post_composer_screen.dart`: persist the attempt **before** any publish network call; never silently publish a restored attempt; on restart restore exact original ID/title/asset and ask user to check My Talks before retry/discard. Block sending on secure-store failure; fenced asynchronous read/write/discard across account/transport switches; clear when server confirms processing/published/failed/removed receipt, retain the receipt if cleanup fails. The server still revalidates asset ownership/readiness.
- `apps/mobile/test/audio_first/af09/composer_test.dart`: added four widget tests for unknown-result restart replay, storage write failure/no network send, cross-account isolation plus deliberate discard, and failed read/recovery retry. Existing composer behavior tests retained.

**Limitation:** the secure store is a single device-local pending-attempt slot, not durable audio bytes or a multi-account draft library. Switching accounts may replace the previous account's pending slot if a new attempt is made; the server-side My Talks history must remain the authoritative recovery history. Do not substitute a local reference for AF05's verified upload.

## Finite milestone source-closure checklist

| ID | Required source and owner | Source state on PR/other owner | Execution / integration |
| --- | --- | --- | --- |
| AF09-01 | Contract, publish/reaction/comment/readback, `services/gateway/src/audio_posts/{contract,service,routes}.ts`; AF09 | IMPLEMENTED_UNVERIFIED on PR #609 | No unified executed check |
| AF09-02 | PG feed/saved/comments/likes with microsecond pagination, `adapters/storage/postgres/src/audio_posts/repository.ts`; AF09 | IMPLEMENTED_UNVERIFIED | PG not run |
| AF09-03 | AF05/15 capture, preview, verified private upload/ownership, denied/offline/retry; allocated `apps/mobile/lib/src/human_media/**` and secure backend media | **MISSING connected production adapter** | Blocked by exact AF05/15 implementation/transfer |
| AF09-04 | Composer, feed, following, saved, comments, playback UI, My Talks and durable publish retry, `apps/mobile/lib/src/audio_posts/**`; AF09 + AF05 | PARTIAL: recovered attempt now IMPLEMENTED_UNVERIFIED; other widgets exist but not app mounted | Flutter NOT_RUN; AF00 source mounting MISSING |
| AF09-05 | AF08-authenticated Gateway composition, signed media and PostVisibility bindings, `services/gateway/src/{app,main}.ts`; AF00 | **MISSING actual bindings and imports** | Not a merely unavailable test |
| AF09-06 | Allocated append-only social post/reaction/comment/follow migrations/FKs, `database/migrations/**`; AF00 | **MISSING installed migrations** | Disposable PG test NOT_RUN |
| AF09-07 | AF05/15 private media signer and authenticated ticket with actual trusted host/player audio focus | PARTIAL ticket/player source; **real signer/recording focus MISSING** | Object/range/revocation/device NOT_RUN |
| AF09-08 | Registered processing worker with real tenant enumeration, queue scan, moderation, retry; AF09/AF00 | Queue/service present, **AF00 worker registration MISSING** | Restart/race/PG NOT_RUN |
| AF09-09 | Two-account post→process→feed→listen/follow/comment/save/delete under visible + hidden authors; AF09/13 | **MISSING connected E2E** from above source gaps | NOT_RUN |
| AF09-10 | One reviewed nondeploying source baseline with owned local #497/APK reconciliation, `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` and root integration; AF00 | **MISSING integrated SHA** | No production merge requested |
| AF09-11 | Persist uncertain publish retry before send and restore same key, `audio_post_draft_store.dart`, `audio_post_composer_screen.dart`, `composer_test.dart`; AF09 | **IMPLEMENTED_UNVERIFIED**, commits above | Four authored widget tests; Flutter NOT_RUN |

No checklist state above means the customer milestone or app is complete. Do not move implementable API, UI, migration, worker or media wiring to the owner's local checkout merely because the runner is missing here.

## Actual capability and check results

- **PASS source integrity/readback only:** GitHub accepted edits to the same PR and returned committed blob SHAs; source was retrieved again and checked for intact imports, store, composer, and tests. This does not prove Dart compilation.
- **BLOCKED / NOT_RUN (this environment):** `cd apps/mobile && flutter pub get && dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_draft_store.dart lib/src/audio_posts/audio_post_composer_screen.dart test/audio_first/af09/composer_test.dart && flutter analyze lib/src/audio_posts && flutter test test/audio_first/af09/composer_test.dart`. No `flutter` or `dart` executable, and GitHub private repository cannot be cloned here (`git ls-remote https://github.com/Baatiku/masanawa refs/heads/main` => `Could not resolve host: github.com`).
- **BLOCKED / NOT_RUN:** `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm exec vitest run services/gateway/src/audio_posts/service.test.mjs`; Node v22.16.0 here but package requires >=24 <25, pnpm >=12 unavailable, no checkout/lockfile module install. Not a repository compilation failure.
- **NOT_RUN:** disposable PostgreSQL append-only migrations/two-tenant concurrency, authorized storage upload/download, media signing and range, Android foreground/interruption/account-switch and APK.
- **Owner for exact execution:** AF13/capable AF00 Node24/pnpm12 + Flutter 3/Dart runner at the **latest #609 SHA** executes above; AF05/15 qualify actual audio/device; AF00 qualifies migrations/composition. Do not label a zero-step GitHub workflow or Vercel rate limit as a source test.

## Bounded integration requests (ownership remains protected)

**AF00:** claim `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, `services/worker/src/main.ts`, `database/migrations/**`, `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` and any actual exports used; bind `registerAudioPostRoutes`, `registerAudioFollowingRoutes`, `registerAudioPostPlaybackRoutes` to the **same** AF08 actor and canonical visibility/media authority, register trusted worker, allocate the audited schema, and mount one Tours/Discover/composer/Following/My Talks user journey on the designated reviewed **nondeploying** integration baseline. Do not overwrite unknown locally fixed APK/shell source; publish actual integrations and tested SHA. Coordinate narrow transfers rather than duplicate a Gateway or route stack.

**AF05/AF15:** implement and supply actual verified private recording/upload and AF15 signed playback/host/focus/retention; use `AcquireVerifiedPostAudio` only when returned `assetId` was verified by the server. No raw file path or externally accessible URL may count as an upload.

**AF09 next:** after review of latest PR ownership, repair any failed Dart source checks on these exact files, then continue the open AF09 customer journey source instead of another isolated guard. Keep #609 and source history intact. No production/provider/device changes occurred. Current PR is not merge qualified while required composition/migrations/media and executable checks are missing.
