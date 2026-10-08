# R18 saved header profile integration

- Owner: ChatGPT integration 2026-10-08 Africa/Lagos, after #419 merge at `af0f4254156a1d6d2745e47c3d07096aa0ed7980`.
- Supersedes stale overlapping editor PR #421 in its *header presentation* only. Do not merge #421 backend/edit model, which conflicts with canonical #419 and permits unsafe handle changes.
- Owned paths: `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`, new `apps/mobile/lib/src/social/profile_header.dart`, new `apps/mobile/test/profile_header_test.dart`, and this checkpoint.
- Use authenticated public profile provider for display name/photo; degrade to session initials on missing/error state; permit only absolute HTTPS image URL to avoid insecure remote requests.
- Profile creation/edit backed by #419; image upload/crop/replace is still blocked until durable authenticated object storage exists. This is header rendering only, not fabricated upload.
- Flutter/Android visual test gate remains pending; no release or deployment.

## Source integration checkpoint

- #419 merged to main with typed owner-only self-profile GET/PUT/PATCH and persisted avatar removal.
- `67303aed`: new pure header projector using persisted public display name and HTTPS-only avatar URL, with authenticated session identity fallback; does not grant avatar upload rights.
- `ea123097`: root header watches current owner-scoped public profile provider (the same provider invalidated by edit saves); photo appears when the server has an allowed URL. Missing/error profile uses authenticated initials.
- `7f826d29`: tests for saved name/photo, missing profile fallback, malicious/insecure URLs and Unicode initials.
- **Not executed**: Flutter analyzer/unit tests, real images, installed Android build or avatar upload workflow. Existing stored URL read is presentation-only. Real photo upload/replacement needs secure object-store pipeline and ownership confirmation.
