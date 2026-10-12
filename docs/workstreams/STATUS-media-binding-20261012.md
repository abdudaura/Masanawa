# STATUS signed media continuation — claim before implementation
Branch lane/status-media-binding-20261012. Base integration/rebuild 523b1511ebff58ce10d5e90cb2478680970e0d2b (merged PR674). Prior source qualified head683d7526f; handoff534b5681f. Owner says continue; previous direct owner transfer of main.ts covers additive Status wiring. No deploy/production migration.
Exact paths:
- adapters/storage/postgres/src/home_feed/eligibility.ts
- adapters/storage/postgres/src/home_feed/eligibility.test.ts
- services/gateway/src/modules/home_feed/media_runtime.ts
- services/gateway/src/modules/home_feed/media_runtime.test.ts
- services/gateway/src/modules/home_feed/composition.test.ts
- services/gateway/src/talk_replay/playback/s3_object_store.ts
- services/gateway/src/modules/home_feed/object_store.test.ts
- services/gateway/src/main.ts
- docs/workstreams/STATUS-media-binding-20261012.md
Reuse the existing S3 SigV4 implementation with an optional signed HEAD metadata port; no second signer/catalogue. Read cleared canonical character_media mapping with tenant/author/active/platform/revision checks. Bind current published post membership and canonical object rights before signing. MIME/size check from trusted object metadata; bounded HTTPS grants, failures/recovery/revocation tests. Startup accepts an explicitly qualified media store/origin dependency; default unconfigured state is typed unavailable. No guessed replay bucket or CDN.
Repository-visible composition handoff: deployment/environment catalog belongs to coordinator. Supply the qualified canonical Masana object store via Status startup media port (endpoint/bucket credentials + approved origin); explicit environment/catalog transfer is required before adding production media variables. This window implements/reviews executable behavior and tests, not credentials or activation. Audio assets/focus remain separately unqualified because current canonical catalogue stores only image kinds.

## Durable delivery evidence
PR https://github.com/weavewellindustrieslimited/masanawa/pull/676. Base523b1511ebff58ce10d5e90cb2478680970e0d2b; substantive source head e7588974af9483ca1fe6fe84a044463dd5011a0f. Eight implementation/test paths above; ninth path is this workstream record. No other paths changed. Prior PR674 merged523b1511 and its merge tree exactly matched qualified branch534b5681.

Implemented: existing pool exposes PgFeedMediaAuthorization alongside canonical eligibility; default Status startup mounts media routes. Explicit StartGatewayServiceOptions.statusMedia carries a qualified object store + exact approved HTTPS download origins. Current tenant/author/approved revision/platform ownership + cleared rights map canonical media ID to object key. Existing replay S3 signer gains optional HEAD metadata method (signed request, no redirects, 10s timeout, bounded/valid headers). Existing replay methods/callers remain compatible. Image drafts/independent approval and download grants check trusted MIME/size; image references cannot be relabelled audio. Recheck object mapping/rights after HEAD and published membership before120s grant. Storage errors are redacted and recover on retry. No raw keys or credentials in response. Invalid origin configuration releases database; absent store mounts a typed unavailable path. No guessed replay bucket/metadata, new catalogue or signer.

Executed on this source:
- pnpm12.8.2 frozen install PASS, no dependency changes.
- Full workspace strict `pnpm typecheck` PASS; refreshed Gateway typecheck after final composition tests PASS, settings/assertions unchanged.
- `pnpm --filter @masanawa/gateway-service... build` PASS, production-condition media runtime/S3 metadata imports PASS.
- `MASANAWA_TEST_DATABASE_URL=<disposable-local-PG18> pnpm exec vitest run packages/feed/src adapters/storage/postgres/src/home_feed services/gateway/src/modules/home_feed services/gateway/src/talk_replay/playback/s3_object_store.test.ts tests/e2e/J06/feed-journey.test.ts`: 19 files / 102 tests PASS. Includes 91 simulated/unit/Fastify and 11 real PostgreSQL18 checks (prior9feed+2cleared object mapping/revocation). Existing replay signer regression tests PASS. Startup injected store, default unavailable and invalid-origin database cleanup exercised. Local fixtures only.
- No mobile source changed since PR674 (15Flutter tests/clean scoped analyzer); no repeat or signed device claim. Prior full build and74registered migrations/0repeat/readinessPASS remain that explicitly recorded checkpoint, not production evidence.
- Whole-app suite last qualified at PR674:29failures, all reproduced on unchanged base. This media checkpoint qualifies scoped source only; no claim global suite/release is green.

Integration: merge qualified media source into non-deploying integration/rebuild; preserve incoming Calls root additions. Target currently523b1511, identical base. No main merge, deployment, paid resources or production migration.

### Concrete narrow coordinator handoff and next action
Requested exact shared path: `config/production-env.json` (environment catalogue reserved to coordinator). Add/register optional canonical Masana storage settings with classification and owner, then bind them to approved main.ts StatusMediaConfiguration using existing createReplayObjectStore.statObject/presignGet implementation: endpoint, region, canonical Masana bucket, access key, secret and approved HTTPS origin(s). Suggested variable names: MASANAWA_STATUS_MEDIA_S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET and MASANAWA_STATUS_MEDIA_DOWNLOAD_ORIGINS. Confirm actual canonical bucket/key provenance before configuring; replay credentials/bucket must not be reused implicitly. No variables are added to runtime/catalogue until that shared transfer; this source already supports explicit trusted dependency injection. Credentials/provider availability remain release requirements, not fabricated PASS.

Remaining: production configuration binding/credentials + live signed media/store verification; approved canonical audio-asset ingestion/type schema + shared audio-focus integration (current character_media accepts portraits/banners/covers only, so audio stays denied); Android SDK/device + signed Android key, Mac/Xcode runner and iOS signing/provisioning for binary verification; authorized release/backup/rollback/migration execution. Production Status remains not verified; last executed readyz200/feed404. Next dependency-ready action is the narrow shared environment-catalogue transfer and qualified storage connection. Do not run production migrations or deploy under the original authorization.

Status: IMPLEMENTED + VERIFIED_SCOPED secure configured image binding; NOT_CONFIGURED in default deployed startup; production NOT_VERIFIED.
