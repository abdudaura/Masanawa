# Firebase local compilation handoff

Firebase source from PR #461 is preserved in the Work integration. Project: `masanawa-mobile`; Android application ID and iOS bundle ID: `com.masanawa.app`. Native configuration files contain public client identifiers, not the Gateway service-account credential.

The local agent must supply an external JSON file with four nonempty keys: `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_PROJECT_ID`. For Android, copy the API key and mobilesdk_app_id from `apps/mobile/android/app/google-services.json`; sender ID is project_info.project_number, project ID is project_info.project_id. For iOS, use the corresponding values from `GoogleService-Info.plist`, including the iOS GOOGLE_APP_ID. Do not reuse the Android app ID for iOS.

Run the existing qualification script from the repository root:

```powershell
./scripts/qualify-first10-android.ps1 -FirebaseDefinesFile C:\local-config\masanawa-firebase-android.json -Install
```

The script validates the four keys, supplies `--dart-define-from-file`, and retains analyzer/test/signing checks. Without the argument it explicitly warns that Firebase push stays disabled. Do not commit local values files, signing keys or service-account JSON. Direct Flutter builds must receive the same defines-file argument. No defaults or developer token prompt are added.

Changing the Android package from `ng.unigeria.unigeria` to `com.masanawa.app` creates a separate installed app; `adb install -r` will not migrate old app data. Verify sign-in with the correct package and do not delete the previous app until any needed local data is preserved.

Gateway deployment separately needs `MASANAWA_FIREBASE_SERVICE_ACCOUNT_JSON` for this project. Its live presence is not verified here and must not be placed in client configuration. iOS push additionally requires APNs capability/credentials qualification.

Local acceptance: compile/sign APK, install on authorized device, verify authenticated token registration, permission denial/re-enable, foreground/background/cold-start delivery, token refresh, account switch and sign-out isolation, and intended deep-link navigation. Native compilation and actual FCM delivery remain unverified in Work; client configuration files alone are not end-to-end evidence.
