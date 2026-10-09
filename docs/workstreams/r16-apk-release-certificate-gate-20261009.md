# R16 isolated Android APK certificate-evidence gate — ownership claim

- **Status:** CLAIMED; release feature remains PARTIAL_IMPLEMENTATION.
- **Owner/window:** isolated R16 verification/recovery, 2026-10-09; this is **not** reassignment of R16/F11 or any active PR.
- **Base:** `main` at `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Branch:** `verify/r16-apk-release-certificate-gate-20261009`.
- **Claimed at:** 2026-10-09 03:15 Africa/Lagos; lease: five minutes; owner must renew if still editing.
- **Exclusive exact paths:** `scripts/verify-android-apk-signature.mjs`, `scripts/verify-android-apk-signature.test.mjs`, `docs/workstreams/r16-apk-release-certificate-gate-20261009.md`.
- **Scope:** release APK read-only signature verification with pinned certificate digest, package-ID check, debug-certificate refusal, safe diagnostics and runnable negative tests; no APK build/signing, native edits, CI workflow changes, shared launch or production access.
- **Dependencies:** R16 Android store signing PR's AAB verifier is distinct. F10 Firebase, F11 release preflight, R17 five-tab shell, all financial Gateway and database contracts are untouched.
- **Acceptance:** real APK checked with Android SDK `apksigner` and `aapt` using a separately established certificate fingerprint; unit fixture tests are not real APK acceptance.
- **Initial claim checkpoint:** append committed implementation/test evidence and accurate unverified gates below.
