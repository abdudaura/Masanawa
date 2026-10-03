# Builds — phone + web

All commands run from `apps/mobile`.

## Build flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `API_BASE_URL` | `https://unigeria.up.railway.app` | Civic backend (auth OTP, preview chat). |
| `AGENT_BASE_URL` | _(empty)_ | Masanawa gateway, when Task 099 ships it. |
| `AGENT_RUNTIME_ENABLED` | `false` | Set `true` plus `AGENT_BASE_URL` for live sessions. |

Example:

```sh
flutter run \
  --dart-define=API_BASE_URL=https://staging.example.com \
  --dart-define=AGENT_RUNTIME_ENABLED=true \
  --dart-define=AGENT_BASE_URL=https://gateway-staging.example.com
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

Play checklist: real key (not debug), version bumped, staging SMS-code
login tried on the uploaded track, one preview chat send tried.

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
