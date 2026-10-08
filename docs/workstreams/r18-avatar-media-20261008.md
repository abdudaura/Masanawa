# R18 avatar media — isolated implementation lane

Owner: ChatGPT avatar/media continuation window, 2026-10-08.
Branch: `work/r18-avatar-media-20261008`; base main: `d716092543f73b2733823992c34798715d719110`.
Conflict check: PR #419 and PR #421 concurrently edit profile routes, repository, editor and mobile shell. Do **not** edit those files in this lane. Neither PR includes avatar-specific storage modules. This branch owns independent backend/media and client crop/upload components only. Integration into app router and shared Gateway composition must occur after reconciling the two overlapping PRs and executing tests.
Owned paths: `packages/talks/migrations/0015_profile_avatar_objects.sql` (additive unique migration; no active conflicting migration), `services/gateway/src/profile_avatar/` (new), `apps/mobile/lib/src/profile_avatar/` (new), `apps/mobile/test/profile_avatar_crop_test.dart` (new), `docs/workstreams/r18-avatar-media-20261008.md` (this claim).
Dependencies: existing canonical `talks.public_profiles` and S3-compatible object storage used for replay, user authorization, and stable media URLs. No duplicate profile identity authority, no local-only upload, no unvalidated arbitrary avatar URLs.
Delivery goal: server-side lossless sanitized PNG validation (metadata stripped, dimensional/decompression bounds), S3 PUT/DELETE signing, safe object keys and durable owner update staging; client cropping/encoding and typed upload transport; focused tests. No false claims of full R18 integration, backend deployment or device acceptance.
Claim visible before implementation. Last update: 2026-10-08.

Integration note: inspected PRs #416/#417/#418/#419/#421; none touch talks migrations or the new profile_avatar module. The migration is appended with distinct name 0015 after existing 0014, never modifies historical checksums. This claim expansion precedes migration edit.
