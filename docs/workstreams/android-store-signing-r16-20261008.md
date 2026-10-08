# R16 Android store signing safety

- Owner/window: ChatGPT R16 store-signing guard, 2026-10-08 01:56 Africa/Lagos
- Branch: `work/r16-android-store-signing-guard-20261008`
- Base main SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
- Task: R16 release qualification, specifically prevent accidental store package signed with debug credentials.
- Exact owned code paths: `apps/mobile/android/app/build.gradle.kts`, `tools/verify-android-store-bundle.sh`; claim/checkpoint path `docs/workstreams/android-store-signing-r16-20261008.md`.
- Non-owned dependencies: R01 theme and R11 locale `main.dart`, R02 audio; no Gateway, financial, deployment or APK edits.
- Current step: implementation committed; awaiting Gradle/build verification.
- Status: implementation in progress; Gradle/Android device validation not run in connector environment; no production deployment.
- Last repository-visible update: this claim commit; renew only on new repository commits.

## Implementation checkpoint

- Code commit: `3f353dacd34a876e849ff1a4c35629235f9ca9c7`.
- Guard runs for `bundleRelease` tasks (store AAB path), or when `-PmasanawaStoreRelease=true` is passed for another release task.
- Requires all four signing properties, verifies the configured keystore file exists, and refuses a file named `debug.keystore`.
- Local `flutter build apk --release` retains the existing debug fallback for handset testing when no release key is present. Such APKs are **not** qualified for distribution.
- Store candidate command: `flutter build appbundle --release` (checks the Gradle bundleRelease task); test APK command with strict store signing: `cd android && ./gradlew assembleRelease -PmasanawaStoreRelease=true`.
- Verification: connector readback of the modified Gradle script; **Gradle, Flutter build, Play signing certificate inspection and device testing NOT RUN**. A physical certificate check and store declarations are still required; this is bounded R16 progress, not R16 acceptance.
- Deploy: none. Other R16 work remains open.
- Last repository-visible activity: implementation/checkpoint commits on this branch.

## Next implementation — artifact verification

- Commit `112a98fb178ed8a988c5c2fc1ef411fb47799f8e` adds `tools/verify-android-store-bundle.sh`.
- Validates jar signature integrity, rejects known Android debug certificate subjects and requires a pinned SHA-256 certificate fingerprint.
- Operator supplies expected release certificate SHA-256 via `MASANAWA_RELEASE_CERT_SHA256` or second script argument; there is intentionally no unchecked default. Example: `MASANAWA_RELEASE_CERT_SHA256=<64-hex-sha256> bash tools/verify-android-store-bundle.sh apps/mobile/build/app/outputs/bundle/release/app-release.aab` (confirm actual output path).
- Script not executed on a built AAB in this environment. Needs Linux/macOS bash/JDK, real release key, artifact and independent certificate fingerprint comparison; no store submission has occurred.
