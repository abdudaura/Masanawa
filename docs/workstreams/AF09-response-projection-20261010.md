# AF09 — public HTTP receipt projection / continuing PR #609 (2026-10-10)

**Workstream:** Published Audio Talks (AF09); branch `work/af09-published-audio-20261010-gpt6`, [existing PR #609](https://github.com/Baatiku/masanawa/pull/609). **Observed main:** `7c443966be97e9092cbc1fb98562c75253434326`. **Parent state:** PARTIAL_IMPLEMENTATION; NOT INTEGRATED; NOT E2E VERIFIED; NOT DEPLOYED. The exact PR HEAD must be refreshed after this handoff because independent AF09 windows also commit to this branch.

**Claim:** `af09-609-response-projection-20261010-gpt6-0445` acquired via CAS on `factory/claims` and read back at registry SHA `13cbf2cc01bf2603a70576d4e8d3bd219827589b`. Exact claimed paths: `services/gateway/src/audio_posts/routes.ts`, `services/gateway/src/audio_posts/routes_projection.test.mjs`, this handoff. No shared Gateway composition, mobile feed, migration, native media, financial or authentication files were seized.

## Implemented source item: AF09-13

The published-audio publish endpoint `POST /audio-posts` and owner-delete endpoint `DELETE /audio-posts/:postId` previously serialized internal `AudioPostRecord` results. Those records include `tenantId`, `authorAccountId`, `assetId`, and `requestId`; unlike the existing read-only feed, these responses violated the canonical `PublicAudioPost` contract. This was an actual source leak, not theoretical hardening.

Both endpoints now return `toPublicAudioPost` while preserving 202/200 on create, 200 on removal, idempotency in the service, revision/status for the Flutter transport and typed denial/error paths. No new projection helper, SQL table or duplicate authority was introduced.

- Implementation: `services/gateway/src/audio_posts/routes.ts` commit `3d2cb4f422e52ada25907602517fc070fdc95778`.
- Regression cases: `services/gateway/src/audio_posts/routes_projection.test.mjs` commits `89547d149ebc803c2f2459d1f08df1b7358298f5`, `20af251db6d292d1e6accf1d7e936a7c77cd3f3d`. Node source tests exercise publish 202 projection, removal 200 projection, 404 hidden owner and 409 publish conflict, with forbidden internal keys.
- Readback: connector fetched and compared changed route source and the new test file at their committed blobs. **This is structural readback, NOT executable test PASS.**

## Finite whole-milestone source closure (updated)

| ID | Required source / owner | Source state and exact gap | Execution / integration |
| --- | --- | --- | --- |
| AF09-01 | Contract, authenticated post/reaction/comment/delete/receipt API; AF09 `services/gateway/src/audio_posts/**` | IMPLEMENTED_UNVERIFIED isolated modules | Real route Fastify, auth and PostgreSQL tests NOT_RUN; shared registration MISSING |
| AF09-02 | Persistent post/like/save/comment/follow/creator, `adapters/storage/postgres/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED isolated repository/queue | Tenant, visibility, pagination, restart checks NOT_RUN |
| AF09-03 | Real microphone permission, preview/trim/verified upload; AF05/15 `apps/mobile/lib/src/human_media/**` and canonical media | MISSING production capture/upload adapter | Requires owned code + Android qualification |
| AF09-04 | Composer, feed, comments, Saved/My Talks/follow/creator UI, `apps/mobile/lib/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED isolated UI | Not mounted into authenticated five-tab Talks shell; Flutter NOT_RUN |
| AF09-05 | Gateway AF08 actor + safety/visibility/media factories, `services/gateway/src/{app,main}.ts`; AF00 | MISSING composition | AF00 exact-path registration and tests |
| AF09-06 | Append-only social post/reaction/comment/follow schema, `database/migrations/**`; AF00 | MISSING uniquely allocated migration | AF00 source; AF13 disposable PG tests |
| AF09-07 | Authorized private streaming, audio focus, range/expiry/revoke/retention, AF05/15 | Partial isolated ticket/player; production signer/focus MISSING | Provider/device NOT_RUN |
| AF09-08 | Durable processing/moderation worker registration, `services/worker/src/main.ts`; AF00 + AF09 | AF09 queue/worker isolated; MISSING AF00 job runtime composition | Race/restart/recovery NOT_RUN |
| AF09-09 | Full two-account record→publish→moderate→discover→listen/follow/comment/save/remove journey, AF09/13 | MISSING connected end-to-end | NOT_RUN |
| AF09-10 | One reviewed non-deploying unified integration baseline, AF00 | NOT INTEGRATED; target/unified SHA NOT PUBLISHED | Auto-deploy review + local APK/#497 reconciliation pending |
| AF09-11 | Encrypted account-fenced, restart-safe unknown outcome attempt, AF09 | IMPLEMENTED_UNVERIFIED on same PR | Flutter NOT_RUN |
| AF09-12 | Authenticated request receipt lookup before retry, AF09 | IMPLEMENTED_UNVERIFIED on same PR | Backend/widget/PG NOT_RUN |
| **AF09-13** | **Publish/delete response minimizes private metadata; AF09 route + tests** | **IMPLEMENTED_UNVERIFIED**, commits above | **New regression tests authored, NOT_RUN**; no integration SHA |

**Bounded exact-path composition transfers:** AF00 owns `services/gateway/src/{app,main}.ts`, `database/migrations/**`, `services/worker/src/main.ts`, `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` and registered auth/media/worker/5-tab shell. AF05/15 own native recording/upload/object read/retention. AF09 continues source of denied/retry/feed interactions without seizing those paths. AF13/qualified runner owns exact-source executable results. AF00 must publish one reviewed non-auto-deploying integration target, then record integrated SHA and migration/reconciliation results in `docs/NEXT-WAVE-DELIVERY-20261010.md` under protected ownership.

**Actual runner availability:** sandbox `node v22.16.0`, git; `pnpm`, Dart/Flutter, PostgreSQL absent; `git ls-remote https://github.com/Baatiku/masanawa.git HEAD` fails `Could not resolve host: github.com`. Repository root requires Node >=24 <25 and pnpm >=12 <13. Therefore workspace compilation and four new repository route tests are **BLOCKED / NOT_RUN**, not PASS. GitHub readback does not substitute.

**Exact commands assigned:** AF13 or AF00 Node24/pnpm12 runner: checkout exact final PR head; `pnpm install --frozen-lockfile && pnpm -r typecheck && node --test services/gateway/src/audio_posts/routes_projection.test.mjs` after TS ESM build to `routes.js`/`service.js`/`contract.js`; execute the existing gateway audio-post tests; `cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts && flutter test test/audio_first/af09`. AF00+AF13 run disposable PG migration and two-tenant post/hidden/delete/readback, then unified-source CI. Determine actual package test/build command from workspace scripts rather than treating a missing emitted `.js` file as source failure.

**Next implementation owner/action:** AF00 must implement the source-missing append-only SQL + authenticated Gateway/media/worker and five-tab composition under protected authority while AF05/15 completes signed media capture/playback; AF09 continues any independently unclaimed essential customer source in PR #609. **No local pull request until remote source/integration closure.** No production deployment or merge to auto-deploying main.
