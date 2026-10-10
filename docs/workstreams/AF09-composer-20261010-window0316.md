# AF09 — verified audio composer continuation (PR #609)

**Scope / owner:** MASANAWA AF09 composer window0316, claim `af09-publish-composer-20261010-window0316` on `factory/claims`, continuing **the same PR #609 and branch `work/af09-published-audio-20261010-gpt6`**. No new branch, root router, migration registry, media recorder or currently held comments/worker files edited.

**Base `main`:** `c7f7280e640d3098be3e26f05149a0d66085441b` at PR #609 source comparison.
**Source commits:** `4f6299332afd00ca6cc3c3479fff4afc0ee6e6a5` (screen), `c751b77d57ede331a976c448a8166a695edc6ad8` (test), `18c8c599b20142da2e68efeecd0b4909eef1024b` (safety adjustment).
**Observed shared PR head before this handoff:** `c5af4542f9581a286317e28860dd81c021a8a158`. Other AF09 workers also commit to this PR; refresh head, collision review and exact-SHA tests before integration.

## Customer journey and implemented source

- New `apps/mobile/lib/src/audio_posts/audio_post_composer_screen.dart`: actual **title + trusted AF05 verified-audio selection + existing AF09 GatewayAudioPostTransport.publish** operation, no fabricated record or unverified local file URL. Gateway still validates owned ready media and creates a durable processing post. Actor and account stay server-authoritative.
- Recording/upload absent: button disabled with truthful unavailable state until AF05 supplies `AcquireVerifiedPostAudio`; typed permission/offline/too-long/unavailable errors yield actionable copy.
- Three-minute bounded selection and exact title/id syntax checks; loading/submitting/processing receipt/error/retake/discard states. Session change drops previous title/media and ignores late media or API responses.
- Once publish may have reached server, title/media are frozen. A retry uses exactly the same idempotency key + payload. Discarding an uncertain attempt requires confirmation and warns to check My Talks. An accepted `processing` receipt is **not** advertised as publicly playable.
- `onPublished` is a composition callback; throwing navigation hooks cannot undo an acknowledged receipt.
- Six new Flutter widget tests in `apps/mobile/test/audio_first/af09/composer_test.dart`: unavailable media, verified selection→publish receipt, same-key uncertain retry, cross-account late callback fencing, invalid/permission error, duplicate submission guard. These tests are **AUTHORED, NOT EXECUTED**.

## Dependencies / integration transfer

1. **AF05 / AF15 (media authority):** inject a real, authenticated recorder→preview→upload→codec/size/duration verify→owned asset callback, object retention and private authorized playback with single audio focus. Do not pass raw device paths or an unverified client-generated asset ID as permission.
2. **AF00 (root integrator):** mount composer from existing Talks create action using current AF08 account resolver and session-fenced transport; route the success receipt to My Talks. Reconcile unseen owner-local APK/source; allocate migration and connect the existing publication service, queue and private media adapter. Only one reviewed **non-deploying** integration baseline may be selected after auditing GitHub/Vercel/other deploy triggers.
3. **AF09 owner:** complete follow/comment/play counts, publication processing/cancellation and actual observed publication/feed/listen journey using the same PR. Other live claimed comment and worker files were intentionally untouched by this increment.

## Executable verification and blockers

- **SOURCE READBACK / structural only:** committed screen and test blobs fetched from the PR; composer source contains session-generation fence, retry-key preservation, media adapter and discard flow. New test file contains six `testWidgets` cases. These are **not** runtime passes.
- **BLOCKED, NOT RUN:** `cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts/audio_post_composer_screen.dart && flutter test test/audio_first/af09/composer_test.dart`. This environment has no Dart or Flutter executable.
- **BLOCKED, NOT RUN:** whole repo `pnpm install --frozen-lockfile && pnpm -r typecheck`; local environment Node `v22.16.0` versus root Node `>=24 <25`, no pnpm, and `git ls-remote` fails `Could not resolve host: github.com`.
- **NOT RUN:** live AF05 upload/media, PostgreSQL record/readback, two authenticated accounts, device microphone/permission/offline and recovery. CI on an earlier AF09 source SHA failed with **zero executed steps**; Vercel deployment hit a build-rate-limit, not a verified code failure.
- **Execution owner:** AF13 or an AF00/local capable Flutter runner checks out the **latest** PR #609 commit and executes Flutter analyzer + focused widget tests, then impacted Gateway/package tests after concurrent AF09 changes. AF00 handles migration, Gateway/route composition, cross-account E2E and safe baseline merge review; AF05 handles device/media verification.
- **Merge status:** **NOT MERGED**. No justified safe baseline election/deploy-filter proof or actual widget/compiler result available; avoid merging unverified source to auto-deploying `main` or advertising the feature as E2E working. Source status **PARTIAL_IMPLEMENTATION**, customer outcome **NOT VERIFIED_E2E**, production **NOT DEPLOYED**.

**Next executable action:** AF13/qualified runner executes analyzer/widgets at pinned PR head; AF00/AF05 provide bounded media/composition handoff and test two-account record/upload/publish→processing→feed/play/readback. Retain this source, tests and idempotency behavior through integration.
