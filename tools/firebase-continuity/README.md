# Firebase integration continuity check

This **read-only, offline** F11 verification helper checks that Masanawa's *composed* Flutter application has consistent Firebase identity and safety plumbing across Android and iOS. It does not change configs, register devices, call Firebase, validate APNs, or qualify any push delivery.

## Commands

From a checkout of the **combined integration branch** (not an isolated old `main`):

```bash
node --test tools/firebase-continuity/check.test.mjs
node tools/firebase-continuity/check.mjs --root=. --json
```

Exit **0** means only the listed structural checks pass; **1** means missing or conflicting integration; **2** means invalid flags. JSON output reports **error codes and filenames only**, never config values, secrets, app tokens or email addresses. All unit fixtures use synthetic identifiers, not actual Firebase values.

## Checks and boundaries

- Android app ID `com.masanawa.app`, Google Services Gradle plugin and version, permission to post notifications, data backup disabled.
- Android `google-services.json` parses, includes exactly one Masanawa package client with app ID and a public API-key entry; rejects service-account/private-key material in client config.
- iOS `GoogleService-Info.plist` has the bundle/project/sender/app/public key fields, rejects private-key material, and matches Android project and sender.
- Flutter Firebase dependencies and the existing Android qualification script's external defines-file path have not been lost.
- Structural-only: cannot establish real project ownership, correctness of app build values, signing, APNs/FCM entitlements, server service-account permissions, security of other files, notification delivery, account isolation or actual iOS/Android installation.

**Expected initial failure:** current `main` omits native Firebase configuration from PR #461/#497. Keep this a manually run integration preflight; final integrator may add a CI gate only after semantically composing the native, Flutter and Gateway source and executing physical-device/provider checks. Never add actual production Firebase service-account JSON or local signing/defines files to make the checker pass.

Scope: `F11` read-only qualification, adjacent `F10/R14` only. Handoff: `docs/workstreams/f11-firebase-continuity-20261009.md`.
