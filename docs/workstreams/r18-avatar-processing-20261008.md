# R18 avatar image normalization lane

- Owner: ChatGPT continuation 2026-10-08 Africa/Lagos, base `88e67cc6c79de1ca09e02f11e929065dcfb2ea82`.
- Branch: `work/r18-avatar-processing-20261008`.
- Task: hardened user-provided profile image decoding, safe normalized WebP output, clear resource limits and tests. This is a separate foundation to the signed-in profile CRUD merged as #419/#425.
- Owned paths: `services/gateway/src/profile_avatar/normalizer.ts`, `services/gateway/src/profile_avatar/normalizer.test.ts`, `services/gateway/package.json`, `pnpm-lock.yaml` and this claim. No R11/R12/R09/R10 files, no changes to Gateway composition, storage or mobile screens.
- Safety: no external URLs, metadata preservation, SVGs, animations or files beyond byte/pixel limits; normalization must occur server-side prior to durable storage. Fail closed on decode errors.
- Pending integration: owner-scoped upload endpoint, S3/Spaces private upload and public CDN policy, transactional persisted profile binding, orphan cleanup, mobile picker/crop, tests and deployment. **This lane alone is not avatar upload.**
- CI is pre-runner failing, so tests must be executed before production enablement. No image processing is wired into production by this branch.
