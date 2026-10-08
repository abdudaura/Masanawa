# R18 S3-compatible avatar storage lane

- Owner: ChatGPT continuation 2026-10-08, base main `453045fe30f6a0c32f46bf8562b237bdb595fb62`.
- Branch: `work/r18-avatar-s3-object-store-20261008`.
- Owns only `services/gateway/src/profile_avatar/s3_store.ts`, `services/gateway/src/profile_avatar/s3_store.test.ts`, and this workstream checkpoint.
- Goal: robust private S3-compatible PUT/DELETE for *normalized* WebP output with AWS SigV4, tenant/user content-addressed key path, exact SHA-256 payload checksum, fail-closed configuration, no unsanitized object key or user-controlled URL, and isolated transport regression coverage.
- Integration deferred to next lane: signed-in upload endpoint, owner-scoped Postgres avatar update/cleanup, public CDN policy, mobile picker, runner tests and production credentials. This adapter has no effect without deliberate composition.
- No overlap with active compiler, deletion, gifts or localization branches. Backend/profile-avatar normalizer already landed as #428.

## Implementation checkpoint

- `2bd949a5`: S3-compatible PUT/DELETE with SigV4 signing of **exact normalized WebP bytes**; immutable `profiles/tenant_.../user_.../sha256-<digest>.webp` key. Rejects untrusted owner strings, non-HTTPS endpoints, unpinned bucket/region config, wrong hash, non-WebP and unnormalized dimensions, and excessive output bytes. No public S3 ACL is requested.
- `f6622596`, `2979562f`, `bac9ee80`: focused tests for signed upload payload and hash, strict owner scoping, invalid credentials/bucket/CDN configuration, failure propagation and immutable delete semantics.
- CDN delivery requires explicit separate HTTPS origin; this adapter never signs anonymous S3 GET or accepts caller-selected URLs or object keys.
- **Tests authored, not run:** GitHub Actions runner fails before execution; local Node tooling lacks repo dependencies and remote access. No production object PUT, public CDN policy test, device upload or profile persistence.
- Required next: wire signed-in route + normalized image, binding and cleanup across PostgreSQL and Spaces, content-owner revocation and cache busting, mobile image picker/crop, explicit container/CI acceptance. Do not consider avatar upload implemented until that end-to-end path is qualified.
