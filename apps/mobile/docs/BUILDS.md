# Builds — phone + web

## Flutter production distribution and future Shorebird (policy adopted 2026-10-08)

**Existing commands on this page are for normal development/manual Flutter artifacts**; a plain `flutter build` output is **not** a Shorebird patchable production baseline. Once explicitly implemented/verified, consumer `apps/mobile` will build its first signed patchable base through `shorebird release android` or `shorebird release ios` (with owner-controlled patch public-key embedding) and later distribute eligible, signed, version-specific Dart patches after staging and two-launch testing. Play/App Store artifact submission and native/plugin/asset/engine updates still require new signed releases; old ordinary/debug-signed APKs cannot automatically receive Shorebird patches. **Do not change signing/build scripts or use the sample commands for production before release qualification.** Full [canonical policy](../../../docs/FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md) and [qualification procedure](SHOREBIRD-QUALIFICATION-RUNBOOK.md). Current Work #497, CI #457 and Firebase local compilation/device acceptance remain outstanding.


All commands run from `apps/mobile`.

## Build flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `API_BASE_URL` | `https://masanawa-gateway-production.up.railway.app` | Masanawa API and OTP/session Gateway. |
| `AGENT_BASE_URL` | `https://masanawa-gateway-production.up.railway.app` | Masanawa Agent/creator Gateway. |

Example:

```sh
# Production defaults use the verified Railway Gateway and need no Dart defines.
flutter run

# Optional staging-origin override:
flutter run \
  --dart-define=API_BASE_URL=https://staging.example.com \
  --dart-define=AGENT_BASE_URL=https://staging.example.com
```

## Phone (Android)

Debug run (debug-signed, local only):

```sh
flutter run
flutter run --release   # still debug-signed — never distribute this
```

Release for the Play Store:

1. Create the upload key once (keep it offline, back it up):
   ```sh
   keytool -genkey -v -keystore ~/masanawa-upload.keystore \
     -alias masanawa -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Create `android/key.properties` (gitignored — never commit):
   ```properties
   storePassword=<your-store-password>
   keyPassword=<your-key-password>
   keyAlias=masanawa
   storeFile=<absolute-path-to>/masanawa-upload.keystore
   ```
3. Bump `version:` in `pubspec.yaml`.
4. Build the bundle:
   ```sh
   flutter build appbundle --release
   ```
   Output: `build/app/outputs/bundle/release/app-release.aab`.

Play checklist: real key (not debug), version bumped, production OTP login tried on the uploaded track, one real authorized Agent chat send tried.

## Web

```sh
flutter build web --release
```

Output: `build/web`. Serve the folder statically (Cloudflare Pages or
Vercel). For sub-path hosting pass `--base-href=/your-path/`.

## CI

`.github/workflows/mobile-build.yml` runs analyze, tests, a debug APK, and a
release web build on every push/PR touching `apps/mobile/**`. Release
signing stays manual (key lives with you, never in the repo).


## Local production APK (Windows)

From the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\apps\mobile\scripts\build_production_apk.ps1
```

The script deliberately runs the full mobile qualification path before producing the APK:

1. `flutter pub get`
2. regenerates launcher/app icons from `assets/brand/masanawa_agent_logo.png`
3. regenerates the native splash from the same approved logo
4. `dart format --output=none --set-exit-if-changed lib test`
5. `flutter analyze`
6. `flutter test`
7. release APK build against the Railway production gateway

Expected output:

```text
apps/mobile/build/app/outputs/flutter-apk/app-release.apk
```

For a faster device-development build after a previously successful full build:

```powershell
powershell -ExecutionPolicy Bypass -File .\apps\mobile\scripts\build_production_apk.ps1 -Debug -SkipTests
```

Do not restore any deleted legacy brand files. The single source of truth for launcher, splash, auth and in-app brand artwork is `assets/brand/masanawa_agent_logo.png`.
