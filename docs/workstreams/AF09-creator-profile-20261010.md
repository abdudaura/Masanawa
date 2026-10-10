# AF09 — Creator profile, continuing PR #609

State: PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED increment, NOT integrated, NOT deployed.
Customer milestone: Published Audio Talks, UI-07 and UX-A08/UX-A09.
Claim ID: af09-609-creator-profile-20261010-gpt6-0423 on factory/claims, published and read back before edits.
Branch: work/af09-published-audio-20261010-gpt6
Base main observed: 7c443966be97e9092cbc1fb98562c75253434326
Source commit(s): 2f7f586a307ebdf45d04d296cb6983d42ec951ef (backend), Flutter commit 5d695aa9d97cf7f57f2bd152088e7146208ac353; UI retry fix 63fd23d392e4155b6fd8bb82663e9faa936bb624; regression test e75f6c2cc412c82d0d0efec8d27f3ebd4431c307. Re-read final PR head.

## This increment
- GET /audio-posts/creators/:authorKind/:authorId built on the existing AF09 Following authenticated route and canonical author IDs, not new profile or identity storage. Authenticated tenant and viewer are server-derived.
- Shared PostVisibility checks each row; unpublished, blocked or hidden posts are not returned, and public wire projection omits tenant/account/media-id/request-id. No new migration required for the creator-specific read.
- Flutter CreatorProfileTransport verifies post author/kind/status; CreatorProfileScreen displays identity supplied by the canonical AF07 resolver, an AI disclosure, existing persisted follow control, listed audio and per-post counts, refresh/retry/empty/more, and account fencing. Opening a post requires AF00's canonical routing callback; no unverified playback or fabricated avatar/bio.
- Four backend service tests and four Flutter widget tests authored; latest adds preservation of visible posts across failed refresh. GitHub source blob readback is structural; execution of workspace tests NOT_RUN.

## Finite source and integration checklist
- AF09-01 post/visibility/feed/reactions/comments/following: IMPLEMENTED_UNVERIFIED in existing PR #609.
- AF09-02 PostgreSQL durable feed/follows/comments/processing: IMPLEMENTED_UNVERIFIED; real PG NOT_RUN.
- AF09-03 AF05/15 record/preview/trim/verified upload/retention: MISSING production adapter/source.
- AF09-04 profile-specific service/repository/mobile source: IMPLEMENTED_UNVERIFIED (this commit); root navigation/source mounting MISSING (AF00).
- AF09-05 AF00 authenticated route/safety/media-authority composition: MISSING.
- AF09-06 AF00 append-only social post/follow/comment migrations: MISSING installed registry.
- AF09-07 AF05/15 private object signer and playback media focus: MISSING real bindings.
- AF09-08 AF00 trusted processing worker registration/tenant enumeration: MISSING.
- AF09-09 two-account publish/process/listen/follow/comment/delete: NOT_RUN, end-to-end source disconnected.
- AF09-10 one reviewed nondeploying unified source SHA, reconciled unseen local APK and original #497: MISSING (AF00).
- AF09-11 persisted pre-send uncertain-publish retry: IMPLEMENTED_UNVERIFIED in existing PR.

## Owned exact paths this continuation
services/gateway/src/audio_posts/following.ts,
services/gateway/src/audio_posts/following_routes.ts,
adapters/storage/postgres/src/audio_posts/following_repository.ts,
services/gateway/src/audio_posts/creator_profile.test.mjs,
apps/mobile/lib/src/audio_posts/creator_profile_transport.dart,
apps/mobile/lib/src/audio_posts/creator_profile_screen.dart,
apps/mobile/test/audio_first/af09/creator_profile_test.dart,
docs/workstreams/AF09-creator-profile-20261010.md.

## Execution and transfers
AF13 or an AF00 runner with exact checkout + Node >=24 <25, pnpm 12, Flutter/Dart:
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm --filter @masanawa/gateway test
node --test services/gateway/src/audio_posts/creator_profile.test.mjs (with the repository's TS ESM compilation/resolution)
cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts && flutter test test/audio_first/af09/creator_profile_test.dart
Then disposable PostgreSQL denied/block/tenant/pagination test and two-device media replay and creator follow journey.

This environment has no private checkout in its container, so the exact branch workspace and production migrations, Flutter, PostgreSQL and physical device tests were not performed here. Authored tests are NOT_RUN. GitHub Actions previously ran zero job steps; Vercel preview hit a rate limit. These are not PASS_REAL.

Bounded AF00 transfer: register existing AF09 following routes with real AF08 requireActor and canonical PostVisibility; mount CreatorProfileScreen from published Talk creator controls using a validated canonical identity resolver and post navigation. Register post/media/worker routes, allocate append-only migrations, and elect the ONE reviewed nondeploying integration baseline after audit. AF05/15 provide recording/upload/signing/retention/player. No competing integration branch or main deployment authorized.

## Checked source and current execution environment

At e75f6c2cc412c82d0d0efec8d27f3ebd4431c307, GitHub source readback had all 8 owned files and 10/10 structural assertions of actor authorization, public projection, shared visibility, client identity/account fences, refresh/retry and authored tests. This is NOT executed source testing. Container: Node v22.16.0, npm 10.9.2, TypeScript 5.8.3; no pnpm, Flutter, Dart or psql; git ls-remote https://github.com/Baatiku/masanawa refs/heads/main fails 'Could not resolve host: github.com'. Node24/pnpm12, Flutter/PG and Android test execution are BLOCKED/NOT_RUN and assigned AF13/capable AF00; safe PR merge and production activation remain blocked pending source checks, composition and reviewed nondeploying integration baseline.
