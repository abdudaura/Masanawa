# Builds — phone + web

All commands run from `apps/mobile`.

## Runtime defaults

A normal app build is production-shaped:

| Flag | Default | Meaning |
| --- | --- | --- |
| `API_BASE_URL` | `https://unigeria.up.railway.app` | Existing platform API that owns OTP login and session refresh. |
| `AGENT_BASE_URL` | `https://nurainworker-production.up.railway.app` | Masanawa Gateway. |
| `AGENT_RUNTIME_ENABLED` | `true` | Live Masanawa agent runtime. Set `false` only for an explicit offline/compatibility build. |

The mobile app never accepts, stores or asks for an Alpha/developer access token. After OTP verification, the same platform access token authorizes the agent directory, conversations, live voice, push, clone, Skills and creator-economy calls.

Example override for a staging environment:

```sh
flutter run \
  --dart-define=API_BASE_URL=https://staging-api.example.com \
  --dart-define=AGENT_BASE_URL=https://staging-gateway.example.com
```

## Phone (Android)

For local testing:

```sh
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

The resulting APK uses the hosted defaults above unless you supply overrides. Sign in normally with phone/email OTP.

For a local Gateway over USB, use `tool/build_alpha.ps1 -Install` (Windows) or `tool/build_alpha.sh --install` (Linux/macOS/WSL). Despite the historical filename, the helper no longer uses an Alpha token; it only selects the API/Gateway endpoints and builds the same OTP-authenticated shell.

## Play Store release

1. Create the upload key once and keep it offline/backed up.
2. Create `android/key.properties` (gitignored) with the upload-key values.
3. Bump `version:` in `pubspec.yaml`.
4. Run `flutter build appbundle --release`.

Before release, verify OTP sign-in, Gwani/Gwana directory loading, one text turn, voice, attachments, push/deep links and logout/account-switch cleanup on a physical Android device.

## Web

```sh
flutter build web --release
```

Output: `build/web`.

## CI

`.github/workflows/mobile-build.yml` runs analyze, tests, a debug APK and a release web build for mobile changes. Release signing remains manual; no signing key or session credential belongs in Git.
