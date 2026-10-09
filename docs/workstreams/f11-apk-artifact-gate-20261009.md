# F11/R16 — Executable final APK artifact qualification (2026-10-09)

**Scope/status:** Independent, nonconflicting F11 **VERIFICATION-ONLY** subtask; overall F11/R16 remains **PARTIAL_IMPLEMENTATION**. **DRAFT / UNMERGED / NOT DEPLOYED.** Ownership [issue #556](https://github.com/Baatiku/masanawa/issues/556), created before file writes. No new Android implementation or real device/provider/security release qualification is claimed.

## Exact identity, base and ownership

- Latest main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- New branch: `work/f11-apk-artifact-qualification-20261009`, directly from that main SHA.
- Exact only owned paths: `tools/android-apk-gate/qualify-apk.mjs`, `tools/android-apk-gate/qualify-apk.test.mjs`, this handoff.
- Production helper blob: `3dd987502f80d90193cc89f819e9b936c8d5e481`; committed tests blob: `cd81598010fe46efb5ff0c9bcb12f3a8caf1b431`.
- Source/test commits (including later Android 24 signature hardening `0738840520e27943e468b53626460e61a44c7011` and `c75b6a3748d7e8ea1eb7ed7636a62acea1018f16`): `d439081b14fb0c06451a4cc43ba2dc46ac786779`, `d4d3b033a38300ce40cacf3880f5e5ac7bf9ce41`, `6cff91b325f0fcc5f1cea1f90472f975e9377e1a`. Current branch SHA/PR link is authoritative for final head.
- Reviewed open PRs/paths: F11 draft collision auditor #518 (`scripts/audit-draft-pr-collisions*`), R16 Android private-data #455 (native manifest/network XML plus Vitest), R16 store AAB signing #410, F12 five-tab guard, F09 media, F10/Firebase, final Work #497. None owns these exact paths. This task does not replace or subsume any.

## Actual deliverable

`qualify-apk.mjs` reads a **built APK**, not source AndroidManifest or Gradle. It calls the Android SDK's `apksigner verify --verbose --print-certs` and `apkanalyzer manifest print` / `manifest min-sdk`, with subprocess time and output caps and no shell. It refuses unknown or missing signer information, extra signers, a debug signer, unsigned/only-v1 or v3-only APKs (APK v2 is required for minSdk 24), a wrong/empty release certificate pin, malformed manifest or mismatched Android package, a changed minSDK, debuggable builds, unsafe/missing no-backup/cleartext flags, and missing compiled-policy *references*. On acceptance it reports SHA-256 of actual file bytes, not an inferred Git SHA.

This is **not** an APK builder or a distributor. It deliberately requires the approved release signing certificate SHA-256 from the operator; no real fingerprint or signing secrets are stored in source. It will correctly reject debug-signed local APKs created for alpha testing.

```bash
node --test tools/android-apk-gate/qualify-apk.test.mjs
node tools/android-apk-gate/qualify-apk.mjs \
  --apk apps/mobile/build/app/outputs/flutter-apk/app-release.apk \
  --cert-sha256 "${MASANAWA_RELEASE_CERT_SHA256:?explicit operator pin required}"
```

Run on a machine with Android SDK `apksigner` and `apkanalyzer` executables in PATH and the **actual freshly built and signed distributable APK**. Certificate pin is the signing *certificate digest*, not the private key. A correct manifest declaration alone is not proof that the referenced compiled network/extraction XML behaves correctly; verify the final compiled resources and device migration behavior separately. This tool does not inspect AABs (existing PR #410), verify binary reproducibility, perform Play signature attestation, or validate Firebase/provider/device behavior. It intentionally is not installed as a main CI gate until #455 and shared integration are accepted.

## Evidence — executed versus absent

- Local available Node `v22.16.0`: `node --check` on production module and equivalent adversarial test harness passed.
- Local production file SHA-1 Git blob hash **matches the actual connector readback committed blob** `3dd987502f80d90193cc89f819e9b936c8d5e481`. A tagged-template regexp-escaping correction and an Android API 24 v2-signature compatibility correction were copied into that local file, then its smoke tests (including v3-only rejection) were rerun.
- `node --test` against **that exact production blob** and the locally authored (longer, equivalent) adversarial fixture harness: **8 passed, 0 failed**. It checks manifest, signer, multiple negative cases, tool dispatch, artifact hashing, file/tool absence and strict options. The compact `qualify-apk.test.mjs` included in this PR is separately written and read back from GitHub; **its exact committed test blob was not run in this container**, due to the connector-only private repository and blocked DNS clone.
- Local CLI `--help` returned correct usage; no-file invocation returned exit code **1** with `apk_file_unavailable`.
- `apksigner`, `apkanalyzer`, Flutter and pnpm are unavailable here; `git ls-remote` could not resolve github.com. **No true APK, app compile, Android build, AAB, device, Firebase integration, provider, user journey, full Gateway suites or CI run was executed.** No GitHub Actions retries were attempted given known Actions capacity issue #457.
- Latest `main` manifest is missing explicit no-backup and cleartext-deny controls, while draft #455 adds the source declarations. This new artifact gate will refuse built output until those changes are *merged, built, and actually present*. This is an expected release **NO-GO**, not a green current production APK claim.

## Handoff and safe integration

1. Preserve pending R16 source hardening #455 and AAB signing #410; single F11/Work integrator must reconcile those and final Firebase/native setup #461 without overwriting flags/configs.
2. Run exact committed `node --test tools/android-apk-gate/qualify-apk.test.mjs` in a full checkout. Resolve any actual differences from the locally exercised equivalent harness before PR merge.
3. Produce a **new** release-signed APK from the composed and type/test-qualified five-tab Flutter app. Evaluate with actual Android SDK tools and an owner-approved certificate fingerprint; save stdout/stderr, APK SHA-256, signer metadata, compiled Android resource proof and build Git SHA without disclosing private signing material.
4. Qualify actual Android startup, authentication, push/deep links, microphone, local-data backup policy across OS versions, low-end/RTL accessibility, network TLS, and J/K end-to-end customer flows. Confirm release signing/Play requirements, CI #457, provider/DB/restore and rollback separately.
5. Keep PR draft/unmerged until runnable full-workspace CI and real device evidence; do not change production, shared Gateway/Flutter/router, payments, provider secrets or Firebase.

**No merges, deletion, production changes, unreviewed builds or customer data access performed.** This verified source-level APK *gate logic*, not F11 or Masanawa release acceptance.
