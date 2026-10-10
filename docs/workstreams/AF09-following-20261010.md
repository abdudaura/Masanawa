# AF09 — Creator Following journey continuation (2026-10-10)

State: **PARTIAL_IMPLEMENTATION**; Node service smoke **PASS_REAL (isolated, exact blob)**; full repository/PostgreSQL/Flutter/provider/device **NOT_RUN**; not deployed. Parent customer milestone: **Published audio Talks** (UI-04, UI-07, UX-A08, UX-A09), existing PR [#609](https://github.com/Baatiku/masanawa/pull/609). This is not a second branch, follow database, public identity authority or integration baseline.

## Ownership and safe source scope

Claim `af09-following-journey-20261010-gpt6d` published and read back on `factory/claims` before edits; base main `c7f7280e640d3098be3e26f05149a0d66085441b`, continuing branch `work/af09-published-audio-20261010-gpt6`. The prior AF09 comment-thread claim remained live and is not overwritten. Only the following new exact paths are owned:

- `services/gateway/src/audio_posts/following.ts`
- `services/gateway/src/audio_posts/following_routes.ts`
- `services/gateway/src/audio_posts/following.test.mjs`
- `adapters/storage/postgres/src/audio_posts/following_repository.ts`
- `apps/mobile/lib/src/audio_posts/following_transport.dart`
- `apps/mobile/lib/src/audio_posts/follow_button.dart`
- `apps/mobile/test/audio_first/af09/following_test.dart`
- `docs/workstreams/AF09-following-20261010.md`

## Connected behavior added

- `PUT /audio-posts/:postId/follow` accepts only `{enabled:boolean}`. The actor comes from AF08's authenticated Gateway resolver; the creator derives from the published post, never from a caller-provided account/role/author ID. Repeated follow/unfollow uses one idempotent PostgreSQL relation.
- `GET /audio-posts/:postId/follow` reads the caller's persisted status. Self-follow, unknown, removed, blocked, private or cross-tenant post paths return the same neutral unavailable state.
- `GET /audio-posts/following` lists published posts by followed canonical creator IDs, applying the existing `PostVisibility` block/privacy policy to each result and preserving a bounded seek cursor. No public follower list or follower identity leak.
- `GatewayCreatorFollowingTransport` uses existing authenticated `ApiClient`. `CreatorFollowButton` reads persisted status rather than guessing, verifies the returned author ID/kind, permits retry and fences account changes. `AudioFollowingList` provides empty, loading, error/retry, refresh, low-data (no autoplay), and account-fenced pagination. New widgets do not replace a concurrently claimed feed screen before reviewed integration.
- Eight Node service cases and five Flutter widgets cases authored, covering idempotence, tenant/account isolation, Masana distinction, hidden creators, malformed requests, offline/retry and account switches.

## AF00 append-only SQL proposal — **NOT INSTALLED**

Review canonical account/persona tables, FK/deletion policy, RLS, privacy retention and schema permissions before allocating one migration in the existing registry. Do not run against production.

```sql
CREATE TABLE social.audio_post_follows (
  tenant_id text NOT NULL,
  follower_account_id text NOT NULL,
  author_id text NOT NULL,
  author_kind text NOT NULL CHECK (author_kind IN ('human','masana')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,follower_account_id,author_id,author_kind)
);
CREATE INDEX audio_post_follows_by_creator
  ON social.audio_post_follows (tenant_id,author_id,author_kind);
```

The same verified actor/tenant and creator-profile/block policy must be used for this relation as for `social.audio_posts`. AF00 should add FKs against the *actual canonical accounts/personas* where available, qualify creator deletion/account deactivation and avoid a second profile authority. The PostgreSQL adapter is inactive until this approved migration is present.

## Integration contract and blockers

- **AF00, root integrator:** Register `registerAudioFollowingRoutes` next to existing `registerAudioPostRoutes` with the same session/tenant identity resolver and `PostVisibility`; inject `createPostgresFollowingRepository`, allocate the above schema safely; do not edit or replace local APK source. Once other AF09 claim is transferred/released, mount `CreatorFollowButton` on published cards and the `AudioFollowingList` as the existing Following selector in UI-04, without duplicating the feed controller. Apply a single reviewed non-deploying integration baseline and audit auto-deploying branches.
- **AF09 owner:** Reconcile and test comments, processing and Following with identical post/creator IDs; confirm offline publish and account switching; follow/unfollow status must survive restart and two accounts. Existing PR #609 remains **partial** and draft.
- **AF05/AF15:** Reuse canonical private-media playback/recording, actor visibility and retention; Following is no substitute for a player.
- **AF13/local capable runner:** On the pinned **current** PR SHA run `pnpm install --frozen-lockfile && pnpm typecheck && node --experimental-strip-types --test services/gateway/src/audio_posts/following.test.mjs`; disposable PostgreSQL schema and two-tenant visibility/concurrent update tests; `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/audio_first/af09/following_test.dart`. CI zero-step failures and Vercel daily build limit are execution/deployment blockers, not evidence of passing or failed tests.

## Actual verification

- **PASS_REAL isolated Node service smoke:** `node --experimental-strip-types --test /mnt/data/af09verify/smoke.mjs` returned **3/3 pass** on 2026-10-10. Local `following.ts` Git blob SHA **`7163c39b86d80d6207f631f68fc14bb6eefc174e`** matched source fetched from this PR. Coverage: follow/status/unfollow, tenant and malformed-request denial, non-success on repository outage. Smoke tests are local independent checks, not the complete authored repository suite.
- **PASS_REAL isolated TypeScript check with a minimal contract stub:** `tsc --noEmit --strict --target es2022 --module nodenext --moduleResolution nodenext following.ts contract.ts` exited 0 under `tsc 5.8.3`. This does **not** qualify all repository imports or TypeScript 7.0.2 project config.
- **NOT_RUN/BLOCKED:** Full `pnpm` workspace/test/TS7 check because checkout, Node24 and pnpm12 are unavailable in this container; Flutter/Dart, PostgreSQL and Android tools unavailable. GitHub Actions reports failing no-step jobs for the original PR, and Vercel reports a free-plan rate limit. No production provider/device/rollback test ran.

**Source status:** Follow service + repository + routes + client transport/widgets and tests are committed in the **existing #609 branch**. Routes, schema and widgets are **not yet composed**; do not advertise the user-facing Following tab as functioning end to end or merge to auto-deploying main. Next action: AF00 schema/composition and capable runner execution while AF09 continues recorder, comments, playback and creator journey on this same PR.


## Same-PR continuation — Following readback matches Discover (2026-10-10)

**Parent:** published audio Talks (UI-04, UX-A08/UX-A09), **same PR #609**, not an additional integration branch. **Claim:** `af09-609-following-projection-20261010-gpt6` read back on the existing `factory/claims` registry before edits; no AF00/shared path modified. Base `main@c7f7280e640d3098be3e26f05149a0d66085441b`, reviewed shared source checkpoint `46f1232440bab1b803c1cad7c6dc278190996c5d` (refresh this changing PR head again before tests or merge).

The Following PostgreSQL query now uses the same persisted, tenant-scoped like/non-removed-comment counts as Discover and Saved; returned records carry counts rather than silently zeroing following engagement. The Following service applies the existing **`toPublicAudioPost` projection** before sending the HTTP feed, excluding `tenantId`, `authorAccountId`, `assetId`, and `requestId`; no new identity, reaction or comment authority was created. Author kind still distinguishes Masana audio. Existing count/visibility policy and idempotent follow relation remain unchanged.

Source on this **same branch/PR**:
- `services/gateway/src/audio_posts/following.ts` (canonical public projection)
- `adapters/storage/postgres/src/audio_posts/following_repository.ts` (persisted count readback)
- `services/gateway/src/audio_posts/following.test.mjs` (privacy, count and Masana regressions)
- This handoff only.

**Evidence:** GitHub committed source/blob readback performed on the changed code. New Node regression tests are **AUTHORED, NOT_RUN**; no claim of passing `pnpm` workspace/TypeScript 7 tests, PostgreSQL migrations, real Fastify, Flutter/analyzer, device, signed playback or E2E. Available isolated environment: Node 22.16.0 and global tsc 5.8.3; no GitHub DNS/clone, Node24/pnpm12 lockfile runner, Flutter/Dart, or PostgreSQL. The source `following.ts` now imports the shared value projection from compiled `contract.js`, so the former ad-hoc Node22 direct TS strip-type smoke is no longer a valid standalone runner without a build/module resolver; execute the package's real Vitest/TypeScript project instead, not a mock reenactment.

**Remaining milestone/owners:** AF00 must allocate/install reviewed append-only schema; bind authenticated Following routes and existing AF08 tenant/visibility policy in Gateway, mount the AF09 composer/feeds on the *single audited non-deploying* baseline, reconcile owner's local source/APK and test combined source SHA. AF05/AF15 must provide actual record→upload→signed-play with single-focus media authority; AF09 playback continuation on this same PR owns its client widget paths. AF13 or a capable Node24/pnpm12 + Flutter/PostgreSQL runner must check out **latest exact #609 head**, run `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm exec vitest run services/gateway/src/audio_posts/following.test.mjs`, `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/audio_first/af09/following_test.dart`, and disposable PostgreSQL two-account/follow-count/visibility tests; report logs and repair actual failures before source merge. No main/production merge or audio customer journey qualification claimed here.
