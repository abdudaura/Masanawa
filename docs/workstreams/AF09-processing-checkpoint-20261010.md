# AF09 #609 — restart-safe processing checkpoint (2026-10-10)

Parent: Published Audio Talks, continuing [PR #609](https://github.com/Baatiku/masanawa/pull/609). Window/claim: `af09-609-processing-checkpoint-gpt6-0603` (read back on `factory/claims`). Base main `7c443966be97e9092cbc1fb98562c75253434326`. **PARTIAL_IMPLEMENTATION; not root-integrated, deployed, or device-verified.** This commit's exact head is to be read from PR #609 after publication; the feature branch is concurrently shared.

## Closed feature-owned source item — AF09-08a

- `services/gateway/src/audio_posts/processing_checkpoint.ts`, source commit `78b0e249b04d63ec496892e03553dcfa0ee82742`: genuine PostgreSQL singleton cursor load and revision compare-and-set write. The existing bounded `createAudioPostTenantDispatcher` supplies the cursor and per-tenant worker; no new queue, timer, media moderation authority, client tenant input, or payment/provider write. Failed DB reads do not advance; concurrent stale writers cannot overwrite a newer cursor. End-of-page cursor null deliberately wraps; per-post leases + revision settlement remain canonical.
- `services/gateway/src/audio_posts/processing_checkpoint.test.mjs`, commit `8fa36c5c84b5712ae35abddf148ac6c0652892e9`: seven regression tests for read/write, concurrent stale revision, invalid persisted cursor, pass continuation, wrap, worker failure and invalid result.
- `adapters/storage/postgres/src/audio_posts/checkpoint_schema.proposal.sql`, commit `a3ce8e3205a17710771a591ef01e8daebc2db273`: one trusted singleton checkpoint table with no public grant. **Feature SQL proposal, not an applied or numbered migration. AF00 solely allocates/reviews canonical DDL and grants.**

## Actual source-matched execution

Node v22.16.0, Linux container. Tested the exact file contents copied to an isolated path: local `git hash-object` for source `571fee4dea23a6bce878e0715492a47cec1a4848` and test `b5cf2997b67b79c65bf41072018ca6d326fd6637`, both matched GitHub readback blob SHAs. `node --experimental-strip-types --test services/gateway/src/audio_posts/processing_checkpoint.test.mjs` **7/7 PASS_SIMULATED** (real Node execution on the committed module; mocked DB/dispatcher). Direct `node --check path.ts` without strip-types failed `ERR_UNKNOWN_FILE_EXTENSION`, so it is **not** a source syntax PASS. Node 24 / pnpm12, full repository checkout, Dart/Flutter, and psql are unavailable; `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/main` returned `Could not resolve host: github.com`. No PostgreSQL adapter, workspace TypeScript, Flutter, Android, media-provider or startup/restart E2E test has been run. No CI status or static checklist substitutes for that evidence.

## Finite customer-milestone source and integration checklist

| ID | Required source / exact paths | Current source owner and state | Execution / integrated SHA |
|---|---|---|---|
| AF09-01 | Published posts/reactions/receipts/comments `services/gateway/src/audio_posts/{service,routes,contract}.ts` | AF09 source IMPLEMENTED_UNVERIFIED on #609 | full Node NOT_RUN / NONE |
| AF09-02 | Per-tenant PG post/comment/follow/listen stores `adapters/storage/postgres/src/audio_posts/**` | AF09 source IMPLEMENTED_UNVERIFIED, needs migration | real PG NOT_RUN / NONE |
| AF09-03 | Recorder/preview/trim/client compose `apps/mobile/lib/src/audio_posts/{audio_post_capture_sheet,audio_post_composer_screen,audio_post_destination}.dart` | AF09 source IMPLEMENTED_UNVERIFIED, private upload disconnected | Flutter NOT_RUN / NONE |
| AF09-04 | Discover/Following/Saved/My Talks/comments/creator/reports/playback `apps/mobile/lib/src/audio_posts/**` | AF09 source partial/IMPLEMENTED_UNVERIFIED | Flutter NOT_RUN / NONE |
| AF09-05 | Authenticated AF08 actor/visibility/TalkSafety/AF15 media mounting `services/gateway/src/{app,main}.ts` | **AF00 MISSING root source**; AF09 feature route pack authored | API E2E NOT_RUN / NONE |
| AF09-06 | Installed append-only social, listen, processing checkpoint `database/migrations/**` | **AF00 MISSING numbered migration**; feature proposal authored | disposable PG NOT_RUN / NONE |
| AF09-07 | Actual private signed upload, media validation, authorized playback/focus `AF05/AF15 native and media paths` | **AF05/AF15 MISSING connected source and qualification** | provider/device NOT_RUN / NONE |
| AF09-08a | Durable tenant checkpoint `services/gateway/src/audio_posts/processing_checkpoint.ts`, schema proposal, test | **AF09 SOURCE_CHECKED** at commits above; root unwired | mock 7/7 PASS_SIMULATED / NONE |
| AF09-08b | Trusted worker interval, cursor checkpoint, moderation, shutdown/restart `services/worker/src/main.ts` | **AF00 MISSING startup composition** | real DB/worker NOT_RUN / NONE |
| AF09-09 | Canonical moderation/report safety root and post/media lifecycle | AF09 partial; AF00/AF15 MISSING canonical binding | two-account moderation NOT_RUN / NONE |
| AF09-10 | Five-tab center/default Talks `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` | **AF00 MISSING protected shell mount**, reconcile #497 | Flutter/device NOT_RUN / NONE |
| AF09-11 | Record → verify/upload → publish → processing → feed → play/follow/comment/report/remove | AF09/AF05/AF15/AF00 **MISSING connected journey** | E2E NOT_RUN / NONE |
| AF09-12 | Single deploy-audited safe baseline, #497 and unseen local APK reconciliation | **AF00 NOT INTEGRATED**, safe SHA NONE | deploy/device NOT_RUN |
| AF09-13 | Final exact-head Node24/pnpm, PG18, Flutter and physical Android qualification | **AF13 and qualified AF00/AF05 test owners** | NOT_RUN / BLOCKED |

Do not classify AF09-05/-06/-07/-08b/-10/-11/-12 as local-only execution: they are still missing source or composition. Local pull is forbidden by the owner completion boundary until implemented and integrated.

## Bounded exact-path transfer and verification

AF00 / existing [root PR #600](https://github.com/Baatiku/masanawa/pull/600) owns `services/worker/src/main.ts` and `database/migrations/**`. After approved append-only DDL, instantiate `createPostgresProcessingCheckpointStore(pool)` and `createPublishedAudioProcessingTick({ store, dispatcher: createAudioPostTenantDispatcher({scanner,worker,onTenantError}) })` in the **existing** trusted worker. Schedule a bounded run/stop lifecycle, redacted metrics and retry. Treat `committed:false` as concurrent checkpoint conflict, not a successful saved cursor. Do not register another queue/timer or run against production before audited approval. AF00 must connect real Gateway, five-tab Talks and media/safety authorities on ONE audited nondeploying baseline; this PR is not that integration branch.

AF13 / qualified execution owner, from a full checkout **at the final exact PR/integration SHA**:

```sh
node --experimental-strip-types --test services/gateway/src/audio_posts/processing_checkpoint.test.mjs
pnpm install --frozen-lockfile
pnpm -r typecheck
pnpm --filter @masanawa/gateway-service build
# In a disposable PostgreSQL 18 database with approved AF09 numbered migrations:
# verify checkpoint persistence across process restart, concurrent CAS, expired visibility, leases and failed moderation.
cd apps/mobile
flutter pub get
flutter analyze lib/src/audio_posts test/audio_first/af09
flutter test test/audio_first/af09
```

**Next concrete implementation:** AF00 claims the protected paths and installs the reviewed AF09 social/listen/checkpoint migrations, actor/media/safety Gateway bindings, existing worker startup with this cursor, and default Talks injection; AF05/AF15 implement private verified upload/audio focus; AF13 re-executes exact-SHA checks. Preserve ongoing source fixes, report real failures, select one nondeploying integration SHA; no unsafe main merge or production enablement.
