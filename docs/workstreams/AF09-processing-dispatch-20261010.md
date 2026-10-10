# AF09 Published Talks — pending-tenant processing dispatch (2026-10-10)

**Parent:** existing draft [PR #609](https://github.com/Baatiku/masanawa/pull/609), branch `work/af09-published-audio-20261010-gpt6`. Main inspected `7c443966be97e9092cbc1fb98562c75253434326`; PR base `c7f7280e640d3098be3e26f05149a0d66085441b`. **PARTIAL_IMPLEMENTATION / NOT INTEGRATED / NOT RELEASED.** Claim `af09-609-pending-tenant-dispatch-gpt6-0540` acquired on `factory/claims@03bea965725544f88ce39e182eab3c36bd230a78` and immutable-commit readback confirmed. Paths are new and separate from existing queue/worker, AF00 composition and other claimed AF09 mobile files.

## Source item advanced: AF09-08 — bounded pending publication scheduling

- `services/gateway/src/audio_posts/processing_scheduler.ts`, commit `d8faca91ae7ad8ce56afb7eee2ed43ecf10c3517`: find DISTINCT pending tenant IDs from canonical `social.audio_posts` with parameterized, ASCII/C-collated keyset, 1–30 limit and strict result validation. Do not discover tenant IDs from mobile input. No second table, post queue or moderation authority.
- The same module consumes the **existing** `createAudioPostProcessingWorker(...).runOnce({tenantId,cursor})` interface with bounded tenant/page budgets, retryable-error and published/rejected/CAS-conflict counters, error callback, per-tenant failure isolation and cycle rejection. Returns `tenantCursor` for AF00's authoritative scheduler persistence and wrap to null after last tenant. It does not create its own timer, endpoint or privileged actor.
- `services/gateway/src/audio_posts/processing_scheduler.test.mjs`, commit `5a534c44710416a01e7499b0cb9cd45c9275e7af`: five tests for SQL filter/cursor/bounds, ordered/invalid rows, multi-page calls, tenant failure independence and invalid/cyclic cursor. No new migration or activation.
- The isolated adapter is **SOURCE_CHECKED** at the two exact Git blobs `879ff81e277045c26047843b286c15d653bcc700` / `4985adff22fd91551765a91c48977db12cabfc02`. Local files matched both hashes with `git hash-object`; `node --experimental-strip-types --test processing_scheduler.test.mjs` **PASS_SIMULATED 5/5** (mocked database/worker, real source bytes), `node --check processing_scheduler.test.mjs` passed. Node v22.16.0, not the Node24/pnpm12 locked project runtime.
- The dispatch is NOT a live scheduler. **AF00 must wire** into the existing worker startup only after allocating the append-only social schema, injecting actual PG pool, canonical AF08/AF15/media moderation and bounded shutdown/restart cursor persistence. Observe/log `failedTenants` and `retryableErrors`, retry failed tenants on wrap, maintain idempotent revision-CAS, validate restart/fairness with a real PG DB. Do not mark accepted/processing as publicly published until authoritative moderation settles.

## Finite parent milestone source closure

| ID | Exact source and accountable owner | Source state | Execution/integration |
| --- | --- | --- | --- |
| AF09-01 | Published post/idempotent receipt, comments/reactions/remove `services/gateway/src/audio_posts/{contract,service,routes}.ts`; AF09 | IMPLEMENTED_UNVERIFIED feature module | Gateway root API AUTH MISSING; Node full tests NOT_RUN |
| AF09-02 | Canonical PG posts/feed/reactions/follows/comments `adapters/storage/postgres/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED, pending allocated schema | Disposable PG tenant/visibility/race NOT_RUN |
| AF09-03 | Verified mic permission, preview/trim, private upload `apps/mobile/lib/src/human_media/**` + media APIs; AF05/15 | **MISSING source/binding** | Real device/objects NOT_RUN |
| AF09-04 | Composer/drafts/encrypted feed, creator/follow, comments sheet, reports and playback `apps/mobile/lib/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED; unmounted | Flutter tests/analyzer NOT_RUN |
| AF09-05 | Real AF08 actor, visibility, reporting/media/creator route factories `services/gateway/src/{app,main}.ts`; AF00 + AF08/15 | **MISSING composition** | End-to-end auth/blocked actor NOT_RUN |
| AF09-06 | Allocated append-only schema `database/migrations/**`; AF00 | **MISSING** | PG migrate/restore NOT_RUN |
| AF09-07 | AF15 signed read/focus/private revocation and verified listening, AF05/15 + AF09 | PARTIAL isolated tickets/player; production backend MISSING | Private media/device NOT_RUN |
| **AF09-08** | **PG tenant scan + bounded worker dispatcher `services/gateway/src/audio_posts/processing_scheduler.ts`; AF09** | **SOURCE_CHECKED at `5a534c4471...`** | 5 isolated mock tests PASS_SIMULATED; **AF00 worker registration/startup MISSING** |
| AF09-09 | Canonical moderation approval and safe report lifecycle; AF09/AF15/AF00 | Partial isolated source; provider binding MISSING | Moderator/provider/restart NOT_RUN |
| AF09-10 | Chats·Rooms·Talks·Gwani·Wallet, PublishedTalksDestination and injected transports `apps/mobile/lib/src/screens/twin/**`; AF00 | **MISSING shared shell composition** | Flutter/device NOT_RUN |
| AF09-11 | Two-account record→private upload→publish→moderate→feed→play/follow/comment/report/remove, AF05/09/13/00 | **MISSING connected journey** | E2E NOT_RUN |
| AF09-12 | One deployment-audited nondeploying unified integration branch and pinned SHA; AF00 | **NOT INTEGRATED; target SHA NONE** | Main deploy hazards/owner APK reconciliation open |
| AF09-13 | Exact-head workspace Node24/pnpm12, Flutter/Dart, disposable PG, private object and rollback checks; AF13/qualified AF00 | Tests authored / focused isolated subset executed | Remaining commands BLOCKED/NOT_RUN |

## Actual environment/execution and exact commands

- Available: `git 2.47.3`, `node v22.16.0`, global `tsc 5.8.3`; focused source-matched 5/5 node:test run passed against mocked PG/worker, **not** full workspace or PG.
- Missing: `pnpm`, `flutter`, `dart`, `psql`, local repository checkout. `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` -> `fatal: ... Could not resolve host: github.com`; Node project requires >=24<25, pnpm >=12<13.
- **AF13 or qualified AF00 Node24/pnpm12 checkout runner** at the final PR/integration SHA:
  ```sh
  pnpm install --frozen-lockfile
  pnpm -r typecheck
  pnpm --filter @masanawa/gateway-service build
  cp services/gateway/src/audio_posts/processing_scheduler.test.mjs services/gateway/dist/audio_posts/processing_scheduler.test.mjs
  node --test services/gateway/dist/audio_posts/processing_scheduler.test.mjs
  pnpm --filter @masanawa/gateway-service test
  cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts test/audio_first/af09 && flutter test test/audio_first/af09
  ```
  Confirm compiled module import suffix/location and package scripts on checkout. **AF00/AF13 PG runner**: migrate `social.audio_posts` on disposable PG; seed multiple pending tenants, vary tenant collations, replay/lease/revision races; run scan→worker→persist→readback, crash/restart/wrap and tenant failure recovery. Verify deploy hooks before any main merge.
- **Next owner/actions:** AF00 owns a *bounded* change in `services/worker/src/main.ts` and allocated `database/migrations/**` plus authenticated Gateway and shell composition; do not bypass other active shared claims. AF05/15 implement actual media chain. AF09 continues connected feature work on the same PR. AF13 executes full checks and fixes failures. No source-complete claim, no safe integrated SHA, no local pull or release request.

This handoff is source-specific; do not infer product completion from its node:test success.
