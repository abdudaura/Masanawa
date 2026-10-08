# R18 avatar image normalization lane

- Owner: ChatGPT continuation 2026-10-08 Africa/Lagos, base `88e67cc6c79de1ca09e02f11e929065dcfb2ea82`.
- Branch: `work/r18-avatar-processing-20261008`.
- Task: hardened user-provided profile image decoding, safe normalized WebP output, clear resource limits and tests. This is a separate foundation to the signed-in profile CRUD merged as #419/#425.
- Owned paths: `services/gateway/src/profile_avatar/normalizer.ts`, `services/gateway/src/profile_avatar/normalizer.test.ts`, `services/gateway/package.json`, `pnpm-lock.yaml` and this claim. No R11/R12/R09/R10 files, no changes to Gateway composition, storage or mobile screens.
- Safety: no external URLs, metadata preservation, SVGs, animations or files beyond byte/pixel limits; normalization must occur server-side prior to durable storage. Fail closed on decode errors.
- Pending integration: owner-scoped upload endpoint, S3/Spaces private upload and public CDN policy, transactional persisted profile binding, orphan cleanup, mobile picker/crop, tests and deployment. **This lane alone is not avatar upload.**
- CI is pre-runner failing, so tests must be executed before production enablement. No image processing is wired into production by this branch.

## Implementation and local API evidence

- `caf4d988`: server-only `normalizeProfileAvatar` using Sharp 0.35.5 API; 2 MiB input cap, <=12 million decoded pixels and 4096px edge cap, allowlist JPEG/PNG/WebP one page only, normalizes to opaque sRGB 512×512 WebP and strips metadata, caps output at 512 KiB, returns SHA-256 for immutable storage naming.
- `804a559e`: regression source for valid raster, deterministic re-encode, EXIF/ICC absence, oversized, invalid, SVG/GIF and undersized images.
- `e1e3f7b` and `a176574a`: added explicit `sharp: 0.35.5` runtime dependency to Gateway package and existing lock importer; existing resolved sharp package/snapshots reused, no new transitive upgrade.
- Local executed smoke test against installed **Sharp 0.34.1** (not the pinned 0.35.5) passed raster normalization, metadata stripping, deterministic digest and common malformed/unsupported image rejection. Full checked-in Vitest, TypeScript, pinned dependency binary, DB, storage and device checks not executed.
- **Do not enable uploads** using this module alone: no authenticated endpoint, durable object store, ownership binding or cleanup exists in this lane. That integration must be separately qualified before release.
