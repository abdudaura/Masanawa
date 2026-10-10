# AF09 #609 — qualified published-Talk listening counts (2026-10-10)

**Milestone:** Published Audio Talks, same PR #609, `work/af09-published-audio-20261010-gpt6`. **State:** PARTIAL_IMPLEMENTATION overall, source implemented but UNVERIFIED and NOT COMPOSED. Author/lease: `af09-609-listens-20261010-gpt6-0553`; claim read back on `factory/claims@3a58fe1b19329e14d40e66d21b6159f8f2ec88cb`. Later exact-path scope renewal `factory/claims@40b112ec6b16bd2affb5421c570a94c059045c2d` explicitly excludes the concurrently claimed feed. Main at initiation: `7c443966be97e9092cbc1fb98562c75253434326`; refresh PR head before composing.

## Connected source implemented in this PR

- Gateway `services/gateway/src/audio_posts/playback.ts`: After existing AF08 identity, social visibility and AF15 signed private-media admission, optionally open one durable server-generated listening session. Ticket returns opaque `listenSessionId` only after verified authorization; a ticket alone never produces a count. Add authenticated `POST /audio-posts/:postId/listen` to existing playback route factory, with one typed body `{listenSessionId,playedMs}`, second session resolution, no client-controlled actor, and no secret/media URL persistence.
- PostgreSQL `adapters/storage/postgres/src/audio_posts/listen_repository.ts`: transactional open/complete, per-session account/tenant/post/revision, published visibility, expired/revoked denial, reported progress bounded by DB measured elapsed time and post duration, `accepted` idempotency and UTC viewer/post/day uniqueness. Duplicate accepted requests return the existing count; reaching the same post twice in one UTC day does not count again. DB source checkpoint `b03cac842e20dbb9fc43fa10bcea58a97c4f9bc9`.
- Canonical public post DTO, Discover/My Talks/Saved and Following/Creator PostgreSQL projections, Flutter post parser: `listenCount` from persisted `social.audio_post_listen_days` only (default zero for older fixtures). No public tenant/viewer/session or signed media identifiers. Commits `a3a02823`, `3b6c01cf`, `61838d84`, `932a32bf`.
- Mobile `audio_post_playback.dart`: read optional session id in HTTPS ticket, actual native `just_audio` position stream, ignore seek jumps, aggregate continuous progress, submit one authenticated receipt only after enough listening, retry uncertain network results with **same session id** after cooldown, fence account and same-account auth-token changes, never block playback on telemetry failure. Existing fake output classes remain compatible. Latest source checkpoint `e2c49813`.
- `audio_post_detail_screen.dart` shows live count after authorized listen; `creator_profile_screen.dart` displays durable readback count; commits `acfce1cf` and `3d8334d2`. **Feed display not modified** because another continuing AF09 owner holds `audio_post_feed_screen.dart` and its tests.
- Authored (NOT RUN) `services/gateway/src/audio_posts/listen_count.test.mjs`, `adapters/storage/postgres/src/audio_posts/listen_repository.test.mjs`, `apps/mobile/test/audio_first/af09/listen_count_test.dart`. Scope includes authorized ticket, forged actor/body, delayed server clock, optimistic spoofed seeks, replay and daily dedupe, denied/removed/revised posts, output progression, stable retries and account switch.

## SQL source proposal — AF00 owns migration integration

Additive feature-local SQL code was authored at `adapters/storage/postgres/src/audio_posts/listen_tables.proposal.sql` (commit `51c620ebce2b255b7172dfab6565c1c8cf8b0dc5`). It contains the server-minted session and daily count tables, UUID default, UTC viewer/post/day uniqueness, composite publication keys, deletion cascades, retention indexes and accepted/count integrity. **NOT an installed migration.** AF00 must review the canonical social schema, assign the unique append-only sequence, audit automatic migration/deploy triggers, and execute disposable PostgreSQL visibility/concurrency/restore checks. AF15/account-deletion must implement cleanup of identifying viewer/day rows. Do not activate it without tests.

## Finite source and qualification checklist

| Requirement | Source & owner | State | Execution / integration |
| --- | --- | --- | --- |
| AF09-COUNT-1 minted account-scoped listen grant after signed private media authorization | `playback.ts`; AF09 | IMPLEMENTED_UNVERIFIED | Node test authored; route not registered |
| AF09-COUNT-2 durable listener session and once-per-day accepted count | `listen_repository.ts`, `listen_tables.proposal.sql`; AF09 + AF00 | IMPLEMENTED_UNVERIFIED module/proposal; **MISSING installed migration** | PostgreSQL tests NOT_RUN |
| AF09-COUNT-3 public count projection to Discover/Saved/Following/Creator | `contract.ts`, `repository.ts`, `following_repository.ts`; AF09 | IMPLEMENTED_UNVERIFIED; depends SQL | No actual database |
| AF09-COUNT-4 listen progress from real native output to durable receipt | `audio_post_playback.dart`; AF09/05 | IMPLEMENTED_UNVERIFIED | Flutter/device tests NOT_RUN |
| AF09-COUNT-5 readable counts on creator/detail views | `creator_profile_screen.dart`, `audio_post_detail_screen.dart`; AF09 | IMPLEMENTED_UNVERIFIED | Flutter tests NOT_RUN |
| AF09-COUNT-6 readable counts on Discover/Following/Saved feed | `audio_post_feed_screen.dart`; current AF09 removal-recovery owner; bounded transfer requested | **MISSING feed text binding**, ownership conflict preserved | Not integrated |
| AF09-COUNT-7 canonical Gateway/AF08 session and AF15 media bindings, registered SQL, worker, route & five-tab shell | protected shared files; AF00 | **MISSING composition** | No safe integration SHA |
| AF09-COUNT-8 actual Node/Flutter/PG E2E, Android audio progress, replay, restore, metrics, safety | AF13 with AF00/05/15 | NOT_RUN | Release remains blocked |

## Exact runnable commands and blockers

Local Python/container inspected: `node -v` = 22.16.0; `tsc -v` = 5.8.3, `git` available. No private repository clone (Git DNS `Could not resolve host: github.com`), no `pnpm`, `dart`, `flutter`, `psql` commands. Connector source readback can establish blobs and syntax assertions but NOT repository build/test/device proof. Execute at pinned head with a capable runner:

```bash
pnpm --filter @masanawa/gateway test
pnpm -r typecheck
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/audio_first/af09/listen_count_test.dart test/audio_first/af09/playback_widget_test.dart
```

AF13/AF00 runs disposable SQL migration+concurrency/account-denial tests and `node --test` against compiled `listen_count.test.mjs` and `listen_repository.test.mjs` with proper workspace dependencies. AF05/15 checks device audio focus/progress/seek/account revocation, signed media, retention, backup and rollback. **No simulated or authored test is reported PASS_REAL.**

## Continuation/ownership

Keep this code on **existing PR #609**; re-read live claims and head before editing any shared file. Bounded request: current AF09 feed owner, after finishing deletion recovery, show `post.listenCount` on published Discover/Following/Saved feed and optionally prefer `widget.playback?.listenCountFor(post.postId)` via its existing `AnimatedBuilder`; preserve current feed and account state. AF00 owns SQL migration, Gateway playback route registration and five-tab mounting into the **one reviewed nondeploying integration SHA**. Do not ask for local pull until all required remote source and composition is closed; owner's unseen APK changes remain to reconcile. Parent milestone still PARTIAL.

## Compatibility and source readback checkpoint

20/20 exact-file readback structural checks passed on the initial feature-source checkpoint (NOT runtime execution). Corrected the existing exact-key projection regression `services/gateway/src/audio_posts/routes_projection.test.mjs` at `24d0f9b5bd3998b25720e2fb37146e8b2d601c66`, and the creator count widget assertion at `d65dab6f4b98517ef488dfc553969cca3a14fbd2`. Live PR #609 head is concurrently moving; reread it and path ownership before any further source change. Feature remains PARTIAL until AF00 installs SQL/Gateway/shell/media composition and AF13 runs executable tests; no unified integration SHA or local pull.
