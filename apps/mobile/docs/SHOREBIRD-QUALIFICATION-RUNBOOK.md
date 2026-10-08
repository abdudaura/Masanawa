# Shorebird introduction, patch qualification and release operations

**Consumer `apps/mobile` only. NOT YET CONFIGURED.** Owner-approved policy: [`../../../docs/FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md`](../../../docs/FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md). This is a **procedure for a qualified future implementation**, not executable CI, a proven rollout or a credential request. All commands run in `apps/mobile` unless stated. Do not run against production while freeze/Work #497 and CI #457 remain open or device/provider/financial gates lack evidence.

## A. Pre-flight inventory (record in secure release manifest)

- [ ] Confirm current `main`, Work consolidation integration, no active overlapping release owner/lease, working tree clean, canonical five-tab shell and all R/C/J acceptance rows. `CONTINUE-HERE.md` controls readiness.
- [ ] Record app version/build, Android applicationId/signing certificate and Play state, iOS bundle ID/Team/entitlements, Android/iOS Flutter/engine/toolchain versions, native/Firebase/LiveKit config, `pubspec.lock`, CI runner status and baseline build artifacts.
- [ ] Decide where customer-controlled Shorebird organizational access, patch-signing private/public key and recovery escrow live; record operator authorization. No private key or Google/Apple/Firebase signing secret checked into source.
- [ ] Check `shorebird doctor` and compatible stable Flutter version; verify commands and CLI flags against current official documentation on actual signing machine.
- [ ] Ensure Firebase PR #461 preservation and local values handoff from Work #497 are incorporated and tested with real devices. Values are supplied only via protected local/CI configuration; do not add them to patches, repo or logs.
- [ ] Resolve base Flutter analyzer and test failures; establish backend CI, schema/migrations/restore, financial/provider and two-device acceptance. If blocked, record exact unexecuted commands, do NOT enter release stage.

## B. One-time Shorebird onboarding (new reviewed PR; NOT done yet)

1. Securely install Shorebird CLI on authorized build machine; `shorebird doctor`, `shorebird login` through owner's organization.
2. In `apps/mobile`, run `shorebird init`; inspect tracked `shorebird.yaml` and app identity before committing. Keep production and staging separation explicit; a staging patch track alone does not change backend environment. Do not assume a `shorebird.yaml` or Shorebird app exists today.
3. Generate/escrow customer-owned signing keys following https://docs.shorebird.dev/code-push/guides/patch-signing/ . Verify access policies and emergency signing coverage. Record the public key fingerprint in manifest; **private key must be accessible only to the patch signing service/operator**.
4. Produce an initial **non-production signed and instrumented** Shorebird base binary through `shorebird release android` and, after iOS toolchain readiness, `shorebird release ios`, including `--public-key-path <public.pem>` and the same reviewed build-time settings as the original release. Match `shorebird doctor` supported Flutter. Android .aab / iOS .ipa still require normal store submission and signing/review; these commands do not publish store builds.
5. Keep `flutter run`, `flutter test`, `flutter analyze`, `flutter build apk --debug` for routine development. **Plain `flutter build apk` is NOT a patchable Shorebird base release**. Don't silently replace existing local build scripts until they are explicitly updated/tested.
6. First migration to Shorebird requires a **signed normal app update** (or compatible correctly signed distribution upgrade). Users with old non-Shorebird APKs cannot take Dart patches; users with mismatched debug-signed APKs may need safe reinstall/data migration guidance.

## C. Example commands (illustrative; replace placeholders; never auto-publish)

```sh
cd apps/mobile
shorebird doctor
# One-time onboarding when authorized:
# shorebird init

# Create PATCHABLE base binary after complete release qualification.
# The public key is embedded; record exact version, flavor, Flutter and defines.
shorebird release android --public-key-path /SECURE/PATH/public.pem
# iOS requires Mac, Xcode, provisioning and iOS-native acceptance:
# shorebird release ios --public-key-path /SECURE/PATH/public.pem

# Target a *specific existing* base release, not implicit 'latest'.
shorebird patch android --release-version 1.0.1+2 --dry-run
shorebird patch android --release-version 1.0.1+2 --track=staging --public-key-path /SECURE/PATH/public.pem --private-key-path /SECURE/PATH/private.pem
# For a *qualified* QA build, preview staging patch on test device:
# shorebird preview --app-id ACTUAL_SHOREBIRD_APP_ID --release-version 1.0.1+2 --track staging
# Inspect available patches and confirm correct release+platform:
# shorebird patches list --release-version 1.0.1+2
# After approval only, promote to stable:
# shorebird patches promote --release-version 1.0.1+2 --patch-number ACTUAL_PATCH_NUMBER
# Emergency rollback with actual numbers, in correct app context:
# shorebird patches rollback --release-version 1.0.1+2 --patch-number ACTUAL_PATCH_NUMBER
```

**The version in this example comes from repository `pubspec.yaml`, NOT confirmed Shorebird production release.** Commands involving actual `release`, `patch`, `promote` or `rollback` are **state-changing remote actions**; execute only with the approved environment and confirmed values. The examples are not a runnable copy-paste deployment script. Pin `--flavor`, `--target`, original `--dart-define*` settings and supported target architectures when relevant. On Windows PowerShell, consult Shorebird's documented quoted `'--'` separator when passing Flutter flags.

Do not use `--allow-native-diffs` or `--allow-asset-diffs` as an escape hatch. A new `pubspec.yaml` asset, Firebase native configuration, plugin/AndroidManifest change, entitlements, splash or launcher icon should be a normal signed release until separately proven compatible. Flutter SDK upgrades **always** need new store binaries.

## D. Patch admission matrix

| Change | Safe default | Gate |
| --- | --- | --- |
| Agent roster, admin skill catalog, price/capability flag, supported shell-document contents | Gateway config only | Typed, versioned action schema; authorization/idempotency; old client fallback |
| Dart-only bug fix, routing/presentation change using existing compiled assets/native APIs | Shorebird candidate | Dry-run, signed patch, matching base, QA two launches, regression + rollback |
| New/changed images/fonts/splash/icon, bundled localization/asset files | New signed binary | Asset-diff review; no asset patch assumption |
| New native SDK/plugin/permission, Firebase/APNs/LiveKit native wiring, OS-specific code | New signed binary | Store, device and security/regression acceptance |
| Flutter engine/SDK upgrade, app ID/signature/versionCode, major reviewed functionality | New signed binary | Store review/upgrade and compatibility plan |
| Wallet/bill/crypto settlement logic, ledger/database/provider changes | Gateway/database controlled change + signed binary if client/native changes | Authorization, idempotency, migration, readback, fund reconciliation and rollback-safe compatibility; no OTA shortcuts |

## E. Test matrix — capture platform/build SHA + patch numbers and actual results

| Area | Required proof |
| --- | --- |
| Two-launch OTA | Install patchable base, first launch checks/downloads signed patch, terminate/restart, patch takes effect; no false claim that an active session updated instantly |
| Update failure | Offline/no data, provider unreachable, invalid signature, incomplete download, interrupted startup; base/previous verified patch boots and UI remains usable |
| Rollback | Publish known test-only regression to QA track, exercise rollback, restart, confirm known-good behavior and telemetry; demonstrate safe compatible backend state |
| Android range | Low-RAM/low-data handset, available ABIs, cold/warm startup, Android 12+, permissions/background/Doze, sideload/store signing upgrade paths |
| iOS range | At least one signed physical iPhone, TestFlight distribution, app resume/termination, mic/LiveKit/FCM/APNs, iOS interpreted-code performance where relevant |
| Identity | OTP/refresh, logout, multi-account isolation, restored cached messages, deauthorized agent/DM, remote flags fail-closed |
| Voice & social | Public Talk Host+Seat two-device LiveKit/mic/reconnect, Assistant Gwani/Gwana text/live voice, private DM replay/outbox, share/media, lost network |
| Money | Correct account wallet, quote→confirm→settle/receipt, provider retries/crash after commit, duplicate callbacks, app downgrade, never duplicate funding/crypto transfer |
| Push & privacy | Firebase restored credentials on Android and APNs on iOS, signed-out push unregister, notification click/deep link only into authorized current account |
| Observability | Correlate app version + base Git SHA + patch number + track + platform to crash/startup/auth/voice/money outcomes; alert and human approval/rollback |

## F. Publish / promote / incident checklist

1. **Before patch:** PR review, diff classification, no native or assets diff, code-signing/security review, explicit base SHA/version/flags, local Flutter analyze/tests, code push dry-run, staging preview, static/device J-journey evidence, feature/server compatibility and emergency operator availability.
2. **During staging:** publish signed patch to `staging`, ensure only authorized QA devices subscribe or preview; test on real devices, both launches, offline and rollback, record metrics against unpatched baseline.
3. **Before stable:** compare data and error budgets, validate signed patch provenance/approvers and iOS app-store policy classification. Do not assume staging track implies percentage cohort. On stable promotion all eligible stable subscribers of that binary can receive it at their next check.
4. **During production:** monitor by binary+patch; incident responder can first disable server-authorized exposure and then roll back appropriate patch per platform/base. A rollback may require subsequent device update check/restart; no instant fix guarantee for offline phones.
5. **After:** record immutable artifact hash, release/patch track, Git SHA, change class, approvals, exact test commands/results, dashboard baselines, any incident, rollback decision and subsequent compatibility plan.

## G. Outstanding tasks specifically NOT performed by this documentation update

No `shorebird init`/`shorebird.yaml`, signing keys, publisher account, Android/iOS release, OTA patch, new CI, Firestore/Firebase credentials, production rollback or patched-device acceptance was created/claimed. Flutter and Gateway remain unchanged; current Work #497, Actions #457 and Firebase local-values/device handoff remain external blockers. Final integration window may use this as the release workstream after actual source consolidation, but must not mark Shorebird or app READY from docs alone.
