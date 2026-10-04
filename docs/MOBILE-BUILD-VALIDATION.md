# Mobile workstation validation

This independent root utility checks the actual checkout before compiling a debug APK.
It does not change the mobile shell, bootstrap identities or deploy services.
Use Node 22+ and a workstation with Flutter and the Android SDK installed.

From the repository root:

```powershell
node scripts/mobile-build-check.mjs
node scripts/mobile-build-check.mjs --validate
node scripts/mobile-build-check.mjs --build
```

The first command checks checkout files, Flutter machine metadata, the pubspec Dart
caret constraint, pinned Android compileSdk/platform and approved source artwork.
Android SDK selection follows `apps/mobile/android/local.properties`, then
`ANDROID_HOME`, then `ANDROID_SDK_ROOT`. The check never installs SDKs or accepts
licenses automatically. Gradle remains authoritative for JDK/build-tools/NDK checks.

`--validate` runs `flutter pub get`, analysis and tests sequentially, stopping at the
first failure. Existing warning/info diagnostics are nonfatal; compilation/analysis
errors still fail. `--build` runs these gates and then builds a debug APK. It reports
the APK path, size and SHA-256 after checking archive magic. Archive validation is
not signature inspection or device acceptance. A failed build never reports an old
APK as successful. Temporary Dart defines are removed on success and failure.

An optional preconfigured Gateway uses a private environment variable:

```powershell
$env:MASANAWA_MOBILE_GATEWAY = "https://nurainworker-production.up.railway.app"
node scripts/mobile-build-check.mjs --build
```

Use an HTTPS origin. HTTP loopback is accepted for local debug testing; configure
USB reverse separately with the existing mobile helper if needed. Without this
variable, connect through Settings > Developer > Connect test app after installing.
This runner always enables the agent runtime and never embeds Alpha access tokens,
Gemini keys, database credentials or other provider secrets. Enter the hosted Alpha
token through the secure debug connection screen.

`--root <checkout>` validates/builds a different checkout without changing its Git
branch. `--json` emits a bounded machine-readable report. Exit codes: 0 passed,
1 blocked/failed, 2 invalid arguments. Vendor command output is intentionally not
printed or saved: on failure rerun the indicated Flutter command locally to inspect
diagnostics. Default preflight only executes Flutter version metadata; Flutter itself
may initialize its toolchain. Validation/build can fetch dependencies normally.

This utility can be integrated into PR #104 by its owner. The utility's regression
tests use temporary workstation fixtures and injected process results; they do not
qualify a physical Flutter build, Gateway, live voice, purchases, push or device UX.
After installing, run the existing app/device acceptance checklist. Task 072 and
the shell PR's executable CI/device gates remain open until evidenced separately.

```bash
node --test scripts/mobile-build-check.test.mjs
```
