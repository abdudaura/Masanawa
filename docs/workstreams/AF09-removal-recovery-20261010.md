# AF09 #609 — My Talks deletion outcome recovery (2026-10-10)

**Window:** AF09-609-removal-recovery-gpt6-0549. **Same continuing PR:** https://github.com/Baatiku/masanawa/pull/609. **Main observed:** `7c443966be97e9092cbc1fb98562c75253434326`. **Source checkpoint:** `97a706f77999bafadf5f8279510d86d7d5e43c5c` (reread shared head before further work). **Integration SHA:** none. **Status:** AF09 source increment IMPLEMENTED_UNVERIFIED, full Published Audio Talks milestone PARTIAL_IMPLEMENTATION, not merged or deployed. Claim: `af09-609-removal-recovery-gpt6-0549`, published/read back on factory/claims `009576d8ba3116367e8a3a92db4703267bacbba5`.

## Customer journey and exact source ownership

A creator opens Talks → My Talks → Remove Talk → confirms. If the authenticated server receives the removal but its response is lost, the client now reads **existing canonical My Talks** rather than issuing a second mutation or incorrectly saying deletion failed. It recognizes a server-removed record and updates status. If the server still shows the Talk active, retry is possible. If history cannot determine the outcome (offline, error or bounded list excludes it), the customer sees **Check removal status**; that control performs read-only recovery before allowing a new DELETE. Old account/session and feed-mode results are fenced; the busy marker is retired when a refresh changes feed generation. The server's existing idempotent author-only DELETE remains authoritative; no new ledger, API, or database is created.

- `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart` — source commits `353feab8b9b71c185b23f1c537a562b259790a68`, `f39db8ed08d2dd0099c24dee7f75e2899cefc092`.
- `apps/mobile/test/audio_first/af09/feed_test.dart` — four authored regressions: lost acknowledgment with authoritative removed readback; offline uncertainty and explicit status check; late account-A readback after switch; concurrent background feed refresh releases busy button. Test commits `03849addd8c1948d64cd23af2fefd796aa03fe2e`, `97a706f77999bafadf5f8279510d86d7d5e43c5c`.
- This owned workstream handoff document, no shared root/Gateway/finance/migration edits.

**Note:** this source must be analyzer/widget tested. Its account/session guard intentionally ignores a removal result if an independent feed reload superseded that result; fresh authoritative feed data must correct display. A limited My Talks history cannot prove a missing row was removed, so unknown remains unknown.

## Finite required Published Audio Talks source checklist (live parent, not a release claim)

| ID | Required source / owner | State at this checkpoint | Execution / integration |
| --- | --- | --- | --- |
| AF09-01 | Canonical publish/react/comment/delete/receipt service and authenticated route modules, AF09, `services/gateway/src/audio_posts/**` | IMPLEMENTED_UNVERIFIED feature modules; AF00 Gateway mounting MISSING | Node24/pnpm & auth negative tests NOT_RUN |
| AF09-02 | Tenant-fenced PostgreSQL posts/feed/comments/follow/social repository, AF09, `adapters/storage/postgres/src/audio_posts/**` | IMPLEMENTED_UNVERIFIED partial, concurrent listen/tenant dispatch work | SQL/restart/concurrency NOT_RUN |
| AF09-03 | Real AF05 mic capture/preview/trim and AF15 verified upload/private media resolution | MISSING canonical connected source | Android/provider/object proof NOT_RUN |
| AF09-04 | Account-fenced feed, comments sheet, status/composer/creator/detail, save/like/report, deletion and recovery, AF09, `apps/mobile/lib/src/audio_posts/**` | IMPLEMENTED_UNVERIFIED; deletion outcome recovery added here; remaining complete media binding MISSING | Flutter analyze/widgets NOT_RUN |
| AF09-05 | AF08 authenticated actor, blocked/visibility policy, verified AF15 signer into `services/gateway/src/{app,main}.ts` (AF00) | MISSING shared composition | API/E2E NOT_RUN |
| AF09-06 | Approved append-only `database/migrations/**` for posts/social/listening/processing (AF00) | MISSING shared composition | Disposable PG migrations NOT_RUN |
| AF09-07 | Trusted listen/progress counts from real audio provider callbacks and bounded PG receipts (AF09/AF05/15) | IN_PROGRESS on separately claimed AF09 #609 source; integration MISSING | Media/device tests NOT_RUN |
| AF09-08 | Durable processor/tenant dispatch with existing worker bootstrap `services/worker/src/main.ts` (AF09/AF00) | IN_PROGRESS isolated queue/scheduler; AF00 registration MISSING | Job recovery NOT_RUN |
| AF09-09 | Canonical TalkSafety report route + negative policy, AF09/AF00 | IMPLEMENTED_UNVERIFIED module/UI; mount MISSING | Auth/policy tests NOT_RUN |
| AF09-10 | PublishedTalksDestination creator/detail/composer feature navigation, AF09 | IMPLEMENTED_UNVERIFIED | Flutter widgets NOT_RUN |
| AF09-11 | Five-tab Talks/default shell & preserved account state in `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` and router (AF00 #600) | MISSING feature mount | Flutter device NOT_RUN |
| AF09-12 | Two-account capture→upload→publish→process→feed→play/follow/comment/report/delete journey + recovery (AF09/AF05/13/00) | MISSING connected E2E | Provider/DB/device NOT_RUN |
| AF09-13 | One audited non-deploying review baseline with #497 and unseen local APK fixes reconciled (AF00) | NOT INTEGRATED | No integration SHA |
| AF09-14 | Durable encrypted request/receipt recovery, microsecond cursor and offline snapshot (AF09) | IMPLEMENTED_UNVERIFIED | Flutter & PG tests NOT_RUN |

**No local pull:** AF00 must first close all source/composition rows and publish one reviewed unified SHA, then separately assign genuinely unavailable Android/provider proof.

## Actual execution and next owner

GitHub file-content writes/readbacks executed, but not Dart/Flutter compilation. Observed container: Node `v22.16.0`; `pnpm`, `dart`, `flutter` and `psql` absent; `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/main` fails `Could not resolve host: github.com`. Structural source inspection is not repository test execution. No production migration, provider request, paid execution or deployment triggered.

**AF13 / qualified Flutter runner, exact checked-out head:**
```sh
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_feed_screen.dart test/audio_first/af09/feed_test.dart
flutter analyze lib/src/audio_posts test/audio_first/af09
flutter test test/audio_first/af09/feed_test.dart test/audio_first/af09/comments_sheet_test.dart test/audio_first/af09/destination_test.dart
```
**AF13 / qualified Node24 + PostgreSQL runner:** `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm --filter @masanawa/gateway test` plus a disposable PostgreSQL schema for tenant/reaction/deletion, listen and worker recovery. **AF05/15** must execute verified capture/upload/playback on Android. **AF00 protected integration owner** must mount routes, approved SQL, worker and Talks destination on a single audited non-deploying baseline; request narrow transfers through factory/claims instead of editing contested paths.

Next AF09 implementation: coordinate unclaimed source for nontruncated My Talks/Saved pagination once current listen-count claim on the repository/transport is released or expressly transferred; do not silently overwrite active owner. Parent milestone remains open.
