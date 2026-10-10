# AF09 Published Audio Talks — creator-report integration checkpoint (2026-10-10)

**Continuing feature:** [PR #609](https://github.com/Baatiku/masanawa/pull/609), `work/af09-published-audio-20261010-gpt6`. **Main inspected:** `7c443966be97e9092cbc1fb98562c75253434326`. **Ownership:** `af09-609-creator-report-20261010-gpt6-0604`, exact-path `factory/claims` CAS acquired and read back. Shared branch can move: re-read PR HEAD before merging. **Milestone state: PARTIAL_IMPLEMENTATION; no integrated SHA.**

## Connected feature-source increment closed (not released)

The previously isolated creator page could list/follow/play published Talks, but offered no report action there even when the same authenticated TalkSafety-backed report service was available on Discover. This changes the existing feature journey, not moderation authority:

- `apps/mobile/lib/src/audio_posts/creator_profile_screen.dart`, commit `af43129309056f6c2532119b39aec639ea9cf3fb`: reuse the existing `AudioPostReportAction` for **published** creator cards only when `PublishedAudioReportTransport` is actually bound. Keep creator pagination/follow and navigation, use the post's canonical ID and live session predicate; do not invent a report store, client target or unconfigured control.
- `apps/mobile/lib/src/audio_posts/audio_post_destination.dart`, commit `27ca7a1ee441520f2b2789bc6943a1df61faf220`: forward the already-injected TalkSafety report transport to creator navigation without changing AF00 root routes.
- `apps/mobile/test/audio_first/af09/creator_profile_test.dart`, commit `3677719b512b8a8c9c5e72e260182b9ff492eb00`: three widget regressions for confirmed submission/receipt, unavailable canonical transport and account revocation before submission.
- `apps/mobile/test/audio_first/af09/destination_test.dart`, commit `d3781e0045f143f2906bd0f54ac23e93a7c4434f`: the feed→creator path must forward the injected canonical report transport.

**Execution:** 10/10 GitHub source-structure/readback predicates passed (NOT executable Flutter checks). The actual widget tests and Dart analyzer are **NOT_RUN** because Dart/Flutter and a private checkout are unavailable here. This source increment is `IMPLEMENTED_UNVERIFIED`, not proof that users can submit a report in a running app.

## Finite parent milestone closure checklist — source vs integration and execution

| ID | Essential source and accountable owner | Source state / integration | Executed evidence |
|---|---|---|---|
| AF09-01 | Posts, reactions, follow, comments, receipts, report, playback routes; AF09 `services/gateway/src/audio_posts/**` | Feature-only source in #609; AF00 Gateway mount MISSING | Node API tests NOT_RUN |
| AF09-02 | Canonical social/queue/listen PostgreSQL and per-account visibility; AF09 `adapters/storage/postgres/src/audio_posts/**` | Feature SQL and adapters in #609; unregistered in deployed migration system | PG integration NOT_RUN |
| AF09-03 | Record/pause/preview/trim and server-verified private upload; AF09 sheet + AF05/15 media | Capture/composer source in #609; **real AF15 upload binding MISSING** | Flutter/object/device NOT_RUN |
| AF09-04 | Discover/Following/My/Saved, bounded cursors, comments, creator/navigation/reports; AF09 `apps/mobile/lib/src/audio_posts/**` | Feature-local source present, creator report at commits above; other active library changes need review | Flutter tests NOT_RUN |
| AF09-05 | Authorized private media ticket, listen progress/count/focus and playback; AF09+AF05/15 | Isolated controller/ticket source in #609; **real AF15 signed media/focus binding MISSING** | Device/storage NOT_RUN |
| AF09-06 | AF08 actual session principal/visibility, feature registry mount in Gateway `services/gateway/src/{app,main}.ts`; AF00 | **MISSING shared source/composition** | Auth/two-account NOT_RUN |
| AF09-07 | Append-only unique social, listen, processing/checkpoint migrations `database/migrations/**`; AF00 | **MISSING registered migrations**, proposals are not installed | Disposable PG NOT_RUN |
| AF09-08 | Existing trusted worker boot/shutdown/scheduler tick `services/worker/src/main.ts`; AF00 | **MISSING worker composition**, isolated processing modules exist | restart/recovery NOT_RUN |
| AF09-09 | Canonical TalkSafety target resolution/moderation, report capability injection; AF00/AF08 | Feature report source present; **root binding and permission policy MISSING** | End-to-end safety NOT_RUN |
| AF09-10 | Feature composer→receipt/creator→detail and report action; AF09 | Feature-local source including this commit; not mounted in app shell | Four widget tests authored, NOT_RUN |
| AF09-11 | Talks centre/default in five-tab shell, existing `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`; AF00 #600 | **MISSING source integration**; do not replace AF00 navigation or unseen local APK | Android routing NOT_RUN |
| AF09-12 | Two accounts record→upload→publish→process→discover→play/follow/comment/report/remove/restart; AF09/05/13 | **NOT CONNECTED E2E** — source and provider blockers above | E2E NOT_RUN |
| AF09-13 | One deploy-audited safe reviewed integration baseline, reconcile main/#497 and unseen local source; AF00 | **NO INTEGRATED SHA**; #609 open draft, no main merge/deployment | Safe-merge review BLOCKED |
| AF09-14 | Exact-source Node24+pnpm/Flutter/PG/device/service validation; AF13/05/00 | Authored checks; only structural readback in this window | Tools unavailable as detailed below |

**Next implementable source:** AF00 must mount the authenticated feature registry, register allocated migration(s), wire TalkSafety+media+worker and root Talks tab on the **single** reviewed non-deploying integration baseline after bounded path transfers. AF05/AF15 must provide actual private upload/signing/focus interfaces, not stubbed asset IDs; AF09 must bind its feature code to those contracts and fix any compilation failures. This is source work, not a local-only APK instruction.

## Test commands and exact execution assignments

Observed container: Node `v22.16.0`, git `2.47.3`; `pnpm`, `flutter`, `dart`, `psql` unavailable; `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` returned `Could not resolve host: github.com`. GitHub connector source readback is available, but no runnable checkout or Flutter SDK. **No Node/Flutter/PG suite PASS was claimed.**

- **AF13 / qualified Flutter runner** at exact integrated SHA: `cd apps/mobile && flutter pub get && dart format --output=none --set-exit-if-changed lib/src/audio_posts/creator_profile_screen.dart lib/src/audio_posts/audio_post_destination.dart test/audio_first/af09/creator_profile_test.dart test/audio_first/af09/destination_test.dart && flutter analyze lib/src/audio_posts test/audio_first/af09 && flutter test test/audio_first/af09/creator_profile_test.dart test/audio_first/af09/destination_test.dart`.
- **AF13 / Node24+pnpm runner:** `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm --filter @masanawa/gateway test`.
- **AF00/AF13 / disposable PostgreSQL runner:** install exact allocated append-only AF09 migrations and run source adapter/visibility/cursor/lease/qualified-listen integration tests on two tenant/accounts.
- **AF05/AF15 / Android+storage runner:** published-account media capture permissions, private upload/scan/verify, short-lived ticket, continuous play/focus/seek, revoked session/blocked creator, offline retry, deletion and object cleanup, with recorded device/provider evidence. No deployment without real gates.

**Bounded AF00 transfer request:** owner retains `services/gateway/src/{app,main}.ts`, `services/worker/src/main.ts`, `database/migrations/**`, `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` and TalkSafety/AF08/media composition. Exact change for this increment: when constructing `PublishedTalksDestination`, inject the **same authenticated** `GatewayPublishedAudioReportTransport` already used by feed into `reportTransport` (and actual canonical creator/player transports). The feature has no fallback/fake report. Run the above widget tests after root composition. AF00 must add this finite parent ledger to `docs/NEXT-WAVE-DELIVERY-20261010.md` on its claimed safe integration baseline; that main-only shared document is not added as an add/add conflict to #609.

No local pull, APK build, live provider action or merge to auto-deploying main is requested while these required source items are missing.
