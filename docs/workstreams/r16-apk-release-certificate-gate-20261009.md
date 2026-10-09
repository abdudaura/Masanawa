# R16 isolated Android APK certificate-evidence gate — SHA-specific handoff

**Status:** PARTIAL_IMPLEMENTATION / source and focused simulated tests locally verified / draft and unmerged. No actual release artifact or production qualification.

## Ownership and safety
- Owner: isolated R16 Android **APK** verification/recovery; not a takeover of F11, F10, F12 or R16 AAB/Gradle work.
- Claim placed before source edits: 2026-10-09 03:15 Africa/Lagos, commit `eb468d35d0f6e5308ba137e6dee8e968c8417ba2`. Five-minute lease released after this handoff and draft PR publication.
- Base `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Branch: `verify/r16-apk-release-certificate-gate-20261009`.
- Source/test checkpoint HEAD: `4c72e49c76678d0e0c73ac9d2637fa43299ee3cb` (preceded by source commit `816c68643a4e4e623292d8135045715124f0f0f3`).
- **Exactly owned paths:** `scripts/verify-android-apk-signature.mjs`, `scripts/verify-android-apk-signature.test.mjs`, and this handoff document. No shared Gateway composer, ledger, migrations, CI workflow, Gradle, Firebase, root Flutter router or production changes.

## Why and what actually works
The existing `apps/mobile/android/app/build.gradle.kts` intentionally allows a debug-signed `assembleRelease` APK for local handset testing, while store AAB builds have their own mandatory-key guard. The existing `tools/verify-android-store-bundle.sh` protects **AAB**, not downloaded/shareable **APK** artifacts. The new **read-only** APK release verifier fails closed unless all of these hold:
1. A separately supplied 64-hex / colon-separated *release certificate* SHA-256 pin; it never learns trust from the candidate APK.
2. A non-empty regular `.apk` file, not symlink; `apksigner verify --verbose --print-certs` itself returns success.
3. Exactly one signer certificate with matching pin, not an Android Debug DN; at least v2 or v3 signature verification positive.
4. `aapt dump badging` reports canonical application ID `ng.unigeria.unigeria` and no `application-debuggable` manifest flag.
5. SHA-256 of the artifact is streamed and printed only after all checks; no signing, upload, APK rewrite or network access.

**Usage, only with trusted independent cert reference:** `MASANAWA_RELEASE_CERT_SHA256=<trusted-public-64hex-cert-pin> node scripts/verify-android-apk-signature.mjs apps/mobile/build/app/outputs/flutter-apk/app-release.apk`. Needs locally installed Android SDK build-tools `apksigner` and `aapt` on PATH; this is a **distribution eligibility check**, not an APK builder or a substitute for device/provider acceptance. Ensure the pin is the Android APK's intended distribution signing cert (for Play-managed APKs, distinguish app-signing cert from upload cert).

## Executed evidence
- Host: isolated Linux tool workspace, **Node v22.16.0**. Repository package root declares Node >=24; that declared runtime is **not** verified here.
- `node --check` on **both exact committed JS file blobs** PASS.
- `node --test scripts/verify-android-apk-signature.test.mjs`: **11 PASS / 0 FAIL / 0 SKIP**. The signer and aapt outputs are deliberately stubbed in these tests, so they are **PASS_SIMULATED**, not real APK validation.
- GitHub readback SHA256 of Git blobs matches local `git hash-object`: source `959e2c8ed1ce06761e5472642028b70bcc44bf53`; test `762a54eb536701f0e808bd94e3967988c64629e0`. Therefore local executed code matches the PR's exact file bytes at checkpoint.
- CLI with absent pin exited **1**, reporting BLOCKED. CLI with a synthetic nonempty `.apk` and test pin exited **1** when real SDK `apksigner` was missing; this is expected fail-closed behavior, not APK qualification.
- Scope checked: wrong/debug/multiple/missing certificate, malformed pin, v1-only, wrong package, debuggable manifest, empty/symlink APK, signer and aapt errors, non-shell command argv and streamed digest. No provider or physical device was exercised.

## Mandatory unresolved evidence and integration
- **BLOCKED:** Android SDK `apksigner`/`aapt`, a real signed release APK, independently verified release certificate fingerprint, Node24, Android device install, Firebase/app-link qualification, Gradle release construction and CI runner (existing #457 incident). No real APK was verified.
- This does **not** resolve R16 release readiness, R17 five-tab composition, provider/user flows or the multi-PR #497 integration.
- On an integration checkout, run `node --check scripts/verify-android-apk-signature.mjs`, `node --test scripts/verify-android-apk-signature.test.mjs`, then execute the CLI with real SDK binaries, a fresh candidate APK and independently confirmed pin. Verify external app-signing identity/real install and rerun after the final merge/build SHA. Do not gate local debug APK iterations with the distribution certificate requirement; apply the check only before distribution.
- Compare the existing AAB and store signing PR's semantically equivalent rules; do not duplicate Gradle changes or replace its tests. Preserve all Firebase, financial, runtime and five-tab owners. **No deployment, branch merge, deletion or production mutation.**
