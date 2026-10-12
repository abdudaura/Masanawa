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
