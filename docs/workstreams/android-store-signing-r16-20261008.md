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

## Regression coverage and CI — 2026-10-08

- `tools/tests/test-verify-android-store-bundle.sh` creates disposable RSA-signed fixture archives and covers valid release signing, unsigned artifact, incorrect/malformed fingerprint, tampered signed entry and debug certificate. No private signing credentials used.
- `.github/workflows/android-signing-verification.yml` runs those tests with JDK 17 on relevant PR/push paths and manual dispatch; use CI evidence before marking verified.
- The verifier was corrected to avoid `jarsigner -strict` treating standard self-signed release certificate warnings as failures; it still checks positive `jar verified` output plus SHA-256 pin.
- Current head includes commits `14fd643f`, `4bd20386`, `567c30ce` and `c5919901`.
- **CI result unverified:** no runner completion claimed. Flutter/Gradle APK/AAB build and certificate inspection on a real release output remain open; no merge or deployment performed.

## GitHub Actions evidence — run 37710672662

- At head `e4a1ce304b2c948191b7afecf061d33d73b1a5a3`, `Android release signing verifier` run `37710672662` reported `completed/failure`.
- Job `113095607911` reported `completed/failure` but the GitHub steps endpoint returned an **empty steps array**, and job-log retrieval returned `BlobNotFound` (404). No shell-test assertion failure is evidenced.
- `Foundation CI` run `37710672680` and `Mobile Build` run `37710672684` also reported failure on that head; investigate runner allocation before interpreting as code failures.
- Status: **CI failed / root cause unconfirmed**. Do not merge as verified. Rerun or inspect actual job logs and compile a signed artifact before release.

## Additional integrity hardening

- Commit `baa93149`: verify verbose JAR signing output and reject added unsigned entries in an otherwise signed bundle (signature validity alone does not establish coverage of every payload).
- Commit `3ca3f763`: add regression case for appended unsigned payload content.
- This remains unverified until the actual test job executes; regression test expected to enforce fail-closed behavior. No release artifact or store-ready signing evidence exists.

## Local signature-behavior verification and latest CI

- Reproduced with JDK tools in a temporary directory: signed test jar => `jar verified`; adding an unsigned file => `jar verified` **plus an unsigned-entries warning**. This motivates the new explicit rejection.
- Locally exercised the new verifier's equivalent signature/identity/fingerprint core against temporary signed/mixed artifacts: valid signed => accepted, mixed => rejected. This is **not** a full run of the repository's test harness and not a signed AAB build.
- New head workflow run `37710863394` reported failure; job `113096204794` returned no step details or log URL. Existing Foundation/Mobile workflows similarly report failure, so runner/CI environment remains unqualified. Do not classify as passing tests or a release regression without job logs.
- Release gate remains: run the checked-in script tests on GitHub Actions or an isolated checkout, run real Gradle/Flutter build, independently verify a real AAB with pinned public SHA-256 cert fingerprint, inspect output and install test-signed APK on Android. Release candidate must not be distributed before these steps pass.

## AAB input validation

- `ee50da2a`: reject non-ZIP and signed-but-not-AAB inputs by checking `BundleConfig.pb` and `base/manifest/AndroidManifest.xml` prior to signature inspection. This is an early structural sanity check, **not a replacement for bundletool validation**.
- `681da8a3`: update disposable signed test artifact to include minimum AAB paths and add arbitrary-signed-JAR rejection. Corrected signing fixture line continuation in `f6ff6a23`.
- No newly verified CI execution or Android build evidence. Leave PR draft until a real CI runner executes tests and a real release bundle passes structural, signature and device/store gates.
