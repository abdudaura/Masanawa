# R18 S3-compatible avatar storage lane

- Owner: ChatGPT continuation 2026-10-08, base main `453045fe30f6a0c32f46bf8562b237bdb595fb62`.
- Branch: `work/r18-avatar-s3-object-store-20261008`.
- Owns only `services/gateway/src/profile_avatar/s3_store.ts`, `services/gateway/src/profile_avatar/s3_store.test.ts`, and this workstream checkpoint.
- Goal: robust private S3-compatible PUT/DELETE for *normalized* WebP output with AWS SigV4, tenant/user content-addressed key path, exact SHA-256 payload checksum, fail-closed configuration, no unsanitized object key or user-controlled URL, and isolated transport regression coverage.
- Integration deferred to next lane: signed-in upload endpoint, owner-scoped Postgres avatar update/cleanup, public CDN policy, mobile picker, runner tests and production credentials. This adapter has no effect without deliberate composition.
- No overlap with active compiler, deletion, gifts or localization branches. Backend/profile-avatar normalizer already landed as #428.
