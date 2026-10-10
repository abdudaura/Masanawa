# AF09 / CHAT-P01 — warm published Talks feed on existing PR #609

**2026-10-10.** Continuing Published Audio Talks (UI-04, UI-06/07, UX-A08/09), NOT a new feature PR, root integration branch, or released milestone. Feature branch: `work/af09-published-audio-20261010-gpt6`; PR: https://github.com/Baatiku/masanawa/pull/609. The observed main base was `7c443966be97e9092cbc1fb98562c75253434326`, read before edits. Existing PR head just before this documentation: `1c9d6f42f7c0414ca7712d9206ac0d8d39eafff6` (refresh before any merge, because other AF09 owners actively commit).

## Exact ownership and implemented source

Registry: `factory/claims`, claim `af09-609-feed-warm-cache-20261010-gpt6`, CAS-acquired and independently read back. This continuation reused and preserved the original PR and did not edit the active AF09 receipt/draft claims or AF00 root files.

| Exact path | Work at PR #609 | Source state |
| --- | --- | --- |
| `apps/mobile/lib/src/audio_posts/audio_post_feed_cache.dart` | New encrypted FlutterSecureStorage account-keyed published-only presentation snapshot; version/date/account validation; 20-item, 32 KiB UTF-8, 24-hour bounds; serialized write/clear | IMPLEMENTED_UNVERIFIED |
| `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart` | Discover hydration concurrently with network (no network gate); keep existing posts during manual refresh; honest stale/sync/error presentation and retry; discard late readback on account switch; clear previous account cache | IMPLEMENTED_UNVERIFIED |
| `apps/mobile/test/audio_first/af09/feed_cache_test.dart` | Five authored widget regressions: cached warm load before pending network; retained contents during refresh; offline cache/error/retry; account switch/new authoritative data; slow encrypted read and stale network response | AUTHORED / NOT_RUN |
| `docs/workstreams/AF09-feed-cache-20261010.md` | This exact source closure and execution transfer | IMPLEMENTED |

**Source commits on same branch:** `160b5c55fc833c3f4307ae6b71e37baedb9bb667`, `ae8d708607b701e20c3b4b371c0db81cd8f2c453`, `f7344b354ff880af37c17afc12a2dd9ddde3ee8f`, `1370ab64706fb795e34b9d9bfea15ea4ac107850`, `2bf5b775c5fa7dd4fb0a0413faf7842f17765ece`. Latest head above includes concurrent AF09 changes; recheck exact SHA after this document commit.

**Honest boundary:** Saved, Following and My Talks continue to require authenticated server data. A cached Discover result is explicitly *previously viewed* and never authority for current visibility, moderation, purchase or spending. Feed actions still go through authenticated server checks. There is no plaintext fallback. Account changes wipe in-memory projection and queue deletion of the previous account snapshot. **AF00 must also invoke account-scope cache purge on app-wide logout/session destruction** when mounting the feed; the isolated widget cannot catch every unmount/logout and does not claim this lifecycle gate complete.

## Finite Published Talks milestone source checklist (after this increment)

| ID | Required paths and owner | Source state | Execution / integration |
| --- | --- | --- | --- |
| AF09-C1 | `services/gateway/src/audio_posts/{contract,service,routes}.ts` and PG post/feed/comment/follow stores; AF09 | IMPLEMENTED_UNVERIFIED on #609, latest source requires review | Workspace TS, Vitest, PG NOT_RUN; integrated SHA NONE |
| AF09-C2 | `apps/mobile/lib/src/audio_posts/audio_post_feed_{cache,screen}.dart`; AF09 | IMPLEMENTED_UNVERIFIED here; warm/offline projection wired in isolated screen | Five Dart widget tests NOT_RUN; unmounted on root |
| AF09-C3 | Composer, replay-safe draft/receipt, saves/comments/follows/creator/playback views under `apps/mobile/lib/src/audio_posts/**`; AF09 peers | PARTIAL source on #609, account-draft and receipt peers own their current paths | Exact-head Flutter suites NOT_RUN; AF00 mount MISSING |
| AF09-C4 | Private recording/preview/upload/object authorization and stable playback focus; AF05/AF15 allocated native/media paths | MISSING connected qualified production adapter | Android/device/S3 signing NOT_RUN |
| AF09-C5 | Authenticated Gateway and media/visibility composition, `services/gateway/src/{app,main}.ts`; AF00 + AF08/15 | MISSING registration and canonical bindings | Composition SHA NONE; security/review pending |
| AF09-C6 | Allocated append-only post/reaction/comment/follow DB migrations under `database/migrations/**`; AF00 | MISSING installed migration and foreign-key/retention reconciliation | Disposable PostgreSQL NOT_RUN |
| AF09-C7 | Registered trusted worker, tenant scan, moderation/retry under `services/worker/src/**`; AF00 + AF09 | Queue/worker source PARTIAL on #609; shared registration MISSING | PostgreSQL/processing concurrency NOT_RUN |
| AF09-C8 | Root Talks tab, composer navigation, logout clear `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`; AF00 | MISSING integrated binding; #600 owns shell | Flutter/Android NOT_RUN; integration SHA NONE |
| AF09-C9 | Real account A/B post-process-feed-listen-follow-comment-save-delete, moderation, logout, offline, restart; AF09/13/05/15 | MISSING composed and qualified journey | NOT_RUN / no deployment |
| AF09-C10 | ONE audited non-deploying unified baseline and local APK change reconciliation; AF00 | MISSING elected/verified integration SHA; existing #497/#600 remain inputs | DO NOT request local pull |

This closes **one connected source item**, not CHAT-P01 app-wide, not the AF09 milestone, and not the owner's separate CHAT-P02–P05 / GWANI-P01 chat-speed and billing continuity acceptance.

## Actual checks, limitations and next execution

- **GitHub readback PASS (structural only):** current feature source blobs and five test cases read back; 11/11 V8 text/source predicates for account fence, age/size bound, live refresh, clear and retry. This is NOT Dart analyzer/test execution.
- **Runtime availability observed in this container:** `node --version` = `v22.16.0`, below repo Node >=24 requirement; `pnpm`, `dart`, `flutter`, `psql` unavailable. `git ls-remote https://github.com/Baatiku/masanawa refs/heads/main` => `Could not resolve host: github.com`. No private clone/dependency checkout. No real Dart/Flutter/device/DB or backend test was run; no status reported as PASS_REAL.
- **AF09/AF13 Flutter runner at latest PR #609 HEAD** should run:
  ```sh
  cd apps/mobile
  flutter pub get
  dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_feed_cache.dart lib/src/audio_posts/audio_post_feed_screen.dart test/audio_first/af09/feed_cache_test.dart
  flutter analyze lib/src/audio_posts test/audio_first/af09
  flutter test test/audio_first/af09/feed_cache_test.dart test/audio_first/af09/feed_test.dart test/audio_first/af09/composer_test.dart
  ```
- **AF09/AF13 Node24/pnpm12 runner** at same HEAD: `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm exec vitest run services/gateway/src/audio_posts`. Then AF00/AF15 disposable DB migration tests, real signed-object readback and Android offline/warm timing benchmarks. Absence of the runner defers only execution, not the unimplemented source rows above.
- **Next implementation owner/action:** AF00 must publish a single deployment-audited non-deploying integration target and exact-head composition queue; AF05/AF15 must connect actual verified media and player; AF09 must continue #609's next unclaimed core source item (do not overwrite active receipt/draft claims). AF00 claims the protected root/logout and Gateway/migration paths before installing imports/routes and mounting the feed. Only source-checked reviewed safe changes may be integrated; never merge unknown financial/media/auth source to automatically deploying main or claim an APK is finished.

The customer's locally fixed source/APK has not been supplied and was **not overwritten or reconciled**. No production, paid provider, migration, automatic deployment or irreversible action occurred.
