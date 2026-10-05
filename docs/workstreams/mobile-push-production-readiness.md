# Mobile push production readiness — 2026-10-05

Owner/window: ChatGPT production-readiness continuation after APK/runtime reconciliation.
Branch: `work/mobile-push-readiness-20261005`
Base: `3e2332ff2b1ac63ea23284ece67d8e9c364dc777`

Observed gap:
- the production mobile Settings screen offers a Notifications switch even when the APK was built without Firebase client configuration;
- the current production Railway Gateway variable inventory does not contain `MASANAWA_FIREBASE_SERVICE_ACCOUNT_JSON`, so server push dispatch is not configured;
- the current APK verification script does not pass the four Firebase client Dart defines.

Owned paths:
- `apps/mobile/lib/src/screens/settings/settings_screen.dart`
- this claim file only

Boundaries:
- no Firebase credentials are invented or committed;
- no Gateway `main.ts`, APK verifier, billing, crypto, auth, AgentDirectory, or migration changes;
- no new Render/Railway service.

Acceptance:
- an APK without Firebase client configuration must not present an enabled-looking notifications control or falsely tell the user to use system settings;
- a configured build keeps the existing permission/register/unregister behavior unchanged;
- missing production Firebase inputs are recorded explicitly for operator completion.

Implemented:
- the Notifications switch is disabled when the APK has no Firebase client configuration;
- the subtitle now says "Not available in this build" instead of misleading users toward Android system settings;
- configured builds preserve the existing request/register/unregister behavior unchanged.

Still operator-blocked:
- mobile build must receive `FIREBASE_API_KEY`, `FIREBASE_APP_ID`,
  `FIREBASE_MESSAGING_SENDER_ID`, and `FIREBASE_PROJECT_ID` as Dart defines;
- production Gateway must receive `MASANAWA_FIREBASE_SERVICE_ACCOUNT_JSON`;
- no Firebase credentials/config currently exist in the production Railway variable inventory inspected in this workstream;
- the active APK verifier path is owned by another production-build continuation and was deliberately not edited here.

Status: implementation checkpoint complete pending PR integration.
