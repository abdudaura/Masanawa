# AF09 #609 — one authenticated published Talks route pack, 2026-10-10

**Milestone:** Published Audio Talks, existing PR #609 on `work/af09-published-audio-20261010-gpt6`; **not complete, not integrated, not deployed**. Exact claim `af09-609-route-composition-gpt6-0544` on `factory/claims` was acquired and read back before edits. Claim covers only `services/gateway/src/audio_posts/register_feature.ts`, `register_feature.test.mjs` and this file. AF00 continues to own `services/gateway/src/{app,main}.ts`, migrations, worker startup and shared shell.

## Connected source increment, not an integration claim

Implementation checkpoint **`bce75857c96be450059fcc5c38a5edb61a0a622a`**; authored regression checkpoint **`87ffe29d2344de613c9559488a270ce678ecbd61`**. New `registerPublishedAudioFeatureRoutes(app, deps)` composes **existing** post, Following, private playback/listen and canonical TalkSafety report routes using the **same** injected AF08 actor resolver. It preflights every required production dependency before registering any route; no implicit media, fake identity or separate moderation authority. The tests assert 18 registered routes, no partial registration on missing actor/social/media/TalkSafety dependencies, and shared authenticated actor use across feed/following/playback/report.

This reduces the AF00 shared composition change to one typed feature mount and explicit provider construction, but **does not mount it**. The feature remains disabled until AF00 supplies a real session resolver, backed PostgreSQL repositories, visibility policy, AF15 private media, canonical safety and installed append-only SQL. If these are absent, `registerPublishedAudioFeatureRoutes` throws at startup; AF00 must gate registration on fully verified configuration and must not expose partial endpoints. Do not change `main`, production or migration registry from this AF09 lease.

### Bounded AF00 protected-path transfer, no implied permission

**Requested owner:** existing AF00 / one integration baseline. Exact protected files: `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, numbered `database/migrations/**`, `services/worker/src/main.ts`, `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`. After reviewing dependency contracts, construct the existing AF09 `createAudioPostService`, `createFollowingService`, `createAudioPostPlaybackService`, `createPostgresTalkListenStore`, canonical `TalkSafetyService` and visibility/media-authority implementations. Register **once** with `registerPublishedAudioFeatureRoutes(app,{requireActor,posts,following,playback,report:{repository,visibility,safety}})`. Do not also register the individual routes; do not set a dummy allow-all visibility or client-provided identity, approve self-posts or count ticket issuance as a listen. Review existing automatic deployment triggers before any merge.

## Finite parent-milestone source closure checklist

| ID | Required source and owner | Source status at this checkpoint | Execution/integration |
| --- | --- | --- | --- |
| AF09-01 | Post, reactions, comments, follow, report, private playback modules `services/gateway/src/audio_posts/**` AF09 | IMPLEMENTED_UNVERIFIED in #609 | 18-route pack SOURCE_WRITTEN; AF00 Gateway mount MISSING |
| AF09-02 | PostgreSQL post/comment/follow/processing/listen adapters `adapters/storage/postgres/src/audio_posts/**` AF09 | IMPLEMENTED_UNVERIFIED in #609 | Disposable PostgreSQL tests NOT_RUN |
| AF09-03 | Verified mic/preview/trim/upload and private media ownership AF05/AF15 | MISSING connected source | Actual device/storage checks NOT_RUN |
| AF09-04 | Feed/cache/creator/comments/following/saved/report/composer Flutter `apps/mobile/lib/src/audio_posts/**` AF09 | IMPLEMENTED_UNVERIFIED in #609 | Dart/Flutter check NOT_RUN |
| AF09-05 | Authenticated actor, visibility, safety, all gateway route mounts `services/gateway/src/{app,main}.ts` AF00/AF08 | MISSING composition; 18-route pack preflight new in #609 | Registered end-to-end routes NOT_RUN |
| AF09-06 | Append-only social+listen+queue schema and registry `database/migrations/**` AF00 | MISSING | Migration/restart/concurrency tests NOT_RUN |
| AF09-07 | AF15 verified private signer/media stream, focus and trusted qualified-listen accounting | MISSING cross-boundary source; isolated contracts in #609 | Playback/revocation E2E NOT_RUN |
| AF09-08 | Durable moderation worker/tenant discovery attached to `services/worker/src/main.ts` AF00 | AF09 worker/queue isolated; shared startup MISSING | Restart/retry/lease tests NOT_RUN |
| AF09-09 | Canonical TalkSafety report target resolver and route mount AF00 | AF09 report module authored; canonical target resolver MISSING | Negative/blocked/privacy E2E NOT_RUN |
| AF09-10 | Feature-local `PublishedTalksDestination` creator→audio and composer→receipt AF09 | IMPLEMENTED_UNVERIFIED in #609 | Flutter E2E NOT_RUN |
| AF09-11 | Actual Talks centre/default shell route and injected adapters AF00 | MISSING | Five-tab/device/navigation test NOT_RUN |
| AF09-12 | Two-account upload→publish→process→discover→play/follow/comment/report/delete AF09/AF05/AF13 | MISSING connected test journey | Real E2E NOT_RUN |
| AF09-13 | One audited non-deploying unified integration SHA and #497/local source reconciliation AF00 | NOT INTEGRATED; integration SHA none | Do not ask owner to pull |
| AF09-14 | Account-isolated attempts/recovery, keyset pagination, qualified count and removal retry AF09 | Isolated parts IMPLEMENTED_UNVERIFIED; verify latest owner heads | Node/PG/Flutter tests NOT_RUN |

**Source item closed this continuation:** feature-owned single AF08-authenticated route pack plus test source (AF09-01 route bundling). **Not closed:** AF09-05 protected actual route registration, and all MISSING entries above. This checklist records remote source states separately from actual verification; the parent milestone is PARTIAL_IMPLEMENTATION.

## Exact executable verification handoff

Sandbox evidence: GitHub blob readback of `register_feature.ts` and `register_feature.test.mjs` at source checkpoint is **SOURCE READBACK ONLY**. No Checkout, Node24/pnpm12, PostgreSQL or Flutter runner in this window. Local capability probe: `node --version` -> v22.16.0, `pnpm`/`flutter`/`dart`/`psql` missing; `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/work/af09-published-audio-20261010-gpt6` => `Could not resolve host: github.com`. Combined statuses at test checkpoint empty. No compiled TypeScript/Node suite, widget, DB or physical-device test PASS.

**AF13 / qualified Node24+pnpm12 runner** at *final pinned PR SHA*:
```sh
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm --filter @masanawa/gateway-service build
cp services/gateway/src/audio_posts/register_feature.test.mjs services/gateway/dist/audio_posts/register_feature.test.mjs
node --test services/gateway/dist/audio_posts/register_feature.test.mjs
```
The test currently imports `./register_feature.ts`; when running the emitted build replace that test import in the test copy with `./register_feature.js`, or run the authored source test with a compatible Node24 TS-strip environment. Do not claim this specific command executed before its module-loader resolution is qualified. Run other `audio_posts/*.test.mjs` at final SHA and disposable PG schema/migrations/visibility/listen/worker tests. **AF13 / Flutter-capable runner:** `cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts test/audio_first/af09 && flutter test test/audio_first/af09`. Run end-to-end on Android with two isolated accounts, microphone denied/offline/restart, private storage playback revocation, report and feed moderation. Repair real source failures in #609 before integration.

**Integration target:** AF00 elects one reviewed nondeploying baseline after source/deploy-trigger audit; no verified baseline SHA published. Preserve Work #497 and unseen owner APK edits. AF00 next implements authorized route mount + append-only migration and worker/shell composition; AF05/AF15 next implement verifiable audio capture/upload/play; AF13 owns test execution. Do not request local pull while source remains MISSING.
