# AF09 #609 — cursor-paginated published-Talk comments UI (2026-10-10)

State: **PARTIAL_IMPLEMENTATION**, not tested on Flutter, not integrated into the live shell, not deployed. Owner/window: `AF09-20261010-0527-comments-gpt6`. Same milestone PR: https://github.com/Baatiku/masanawa/pull/609, branch `work/af09-published-audio-20261010-gpt6`. Main inspected at `7c443966be97e9092cbc1fb98562c75253434326`; PR checkout must be re-read at the exact head before merging. CAS lease `af09-609-comments-sheet-gpt6-0527` recorded/read back on `factory/claims` commit `d8f7894d3aa34d9dfa08b0d4a47bdedb6ea3fb19` before edits.

## Implemented independently without shared-file overwrites

- `apps/mobile/lib/src/audio_posts/audio_post_comments_sheet.dart` at checkpoint `e435c256c50c2cb79b863bbdce43235e5bdeb64d`: authenticated, account-fenced, Talk-scoped bottom-sheet content consuming the **existing** `AudioPostTransport` and `AudioPostCommentPager` for bounded comment pages, deduped cursor continuation, submit with stable idempotency key across outcome-uncertain retry, author-only confirmed delete, empty/loading/offline/retry, and stale account/post response discard. Does not expose raw account/tenant data or create a new comment authority.
- `apps/mobile/test/audio_first/af09/comments_sheet_test.dart` at checkpoint `9e1f643880ca71108e255da03a408e6ea136ac93`: authored regression tests for 2-page deduplication, exact retry key on failed acknowledgment, account-switch late-response isolation, confirmation/cancel of own deletion. **NOT RUN**, not a Flutter test pass.
- Bounded ownership transfer requested in PR comment https://github.com/Baatiku/masanawa/pull/609#issuecomment-6093771231 . Feed/destination/transport/DB files were NOT changed by this window.

## Finite source closure checklist — parent milestone published Talks

| Required item (implementation owner) | Exact source/contract target | Source state | Execution / integration |
| --- | --- | --- | --- |
| Comment read/paging/write/delete service (AF09 comments backend owner) | `services/gateway/src/audio_posts/{contract,service,routes}.ts`, `adapters/storage/postgres/src/audio_posts/repository.ts`, `apps/mobile/lib/src/audio_posts/audio_post_transport.dart` | IMPLEMENTED_UNVERIFIED on #609; inspect latest concurrent source | Tests NOT_RUN here; not integrated |
| Accessible paginated comment UI (this window) | `apps/mobile/lib/src/audio_posts/audio_post_comments_sheet.dart`, `apps/mobile/test/audio_first/af09/comments_sheet_test.dart` | IMPLEMENTED_UNVERIFIED | Flutter NOT_RUN; integration pending |
| Feed comment button -> authorized sheet; replace unbounded inline read (AF09 feed owner, transfer requested) | `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart`; preserve feed tabs/scroll/player | **MISSING binding** | No shared-path lease/acceptance yet; not integrated |
| Authenticated Gateway composition, read/visibility policy, tenant/media guards (AF00 with AF08/15) | existing Gateway composition and migration registry | **MISSING/NOT VERIFIED** | Only AF00 may allocate; no SQL deployment |
| Canonical durable media capture/processing/readback/audio focus (AF05/AF15 with AF09) | verified AF15 media authority/AF05 player and post processing worker | PARTIAL_IMPLEMENTATION | Provider, storage, audio focus E2E NOT_RUN |
| Five-tab Talks navigation and account-scope binding (AF00) | existing root shell/router and PublishedTalksDestination | MISSING or PARTIAL pending unified source review | Not integrated; local APK unreconciled |
| Unified exact-head source/test/DB/device qualification (AF00/AF13) | one reviewed nondeploying baseline; PostgreSQL/Flutter/provider | NOT_RUN | No unified integration SHA published for this item |

No row above is an assertion the full customer milestone is complete. The new sheet uses a real method surface, but the destination must mount it and the canonical authorization/migration/worker bindings must exist before a customer can use it. Do not label this a local-only implementation task: missing source and mounts stay with named remote owners.

## Required next implementation (exact transfer)

The current AF09 feed-file owner should release/transfer `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart` via the existing CAS coordination record, then wire a button action to `showModalBottomSheet<void>(isScrollControlled: true, builder: (_) => FractionallySizedBox(heightFactor: 0.85, child: PublishedTalkCommentsSheet(postId: post.postId, accountId: widget.accountId, isCurrentAccount: widget.isCurrentAccount, transport: widget.transport)))`. Remove legacy inline whole-list state and preserve on-screen feed position, retries and current player state. Verify that `GatewayAudioPostTransport` implements `AudioPostCommentPager` on the mounted client and that server paging is registered. Do not duplicate a comment API or seize AF00 protected routes.

## Verification and handoff

Observed execution environment: Node 22 and git installed; `pnpm`, `dart`, `flutter`, `psql` absent. Git remote clone/list failed with `Could not resolve host: github.com`. GitHub source writes and immutable readback do not run Dart/Flutter. **NOT_RUN:** `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/audio_first/af09/comments_sheet_test.dart`; execution owner AF13 or capable AF09/AF00 checkout runner. Also `pnpm --filter @masanawa/gateway test && pnpm -r typecheck` (Node package runner / checkout blocked); `psql` disposable migration/visibility/concurrency (PostgreSQL runner missing); signed device playback/capture/provider/restore tests (AF05/AF15/owner qualified devices). Do not infer pass from authored tests. Review auto-deploy triggers and actual integration branch before any merge, and do not activate unqualified financial or media paths.

Next source owner/action: current AF09 feed owner grants/executes the exact feed-file transfer; AF00 registers canonical authenticated Gateway, SQL and shell connections on the one reviewed nondeploying baseline. Re-read #609 head and any newer source before editing shared paths; keep this same PR. No local pull request until implementable source/compose gaps are closed and one unified SHA is published.
