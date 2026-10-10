# AF14 — Notification Settings state and account-fencing handoff (2026-10-10)

**Window:** MASANAWA-01 / AF14. **Status:** PARTIAL_IMPLEMENTATION (AF14 overall); scoped source IMPLEMENTED_UNVERIFIED. Not deployed, not an end-to-end/device verification.

## Git and ownership

- Base `main`: `f381f077c485c04261459b77a42c215d3ce3a14b`.
- Source/test checkpoint: `d926d2035a1a84452ca93acf60b77a174484d85f`; the follow-up handoff-only commit does not change source behavior.
- Branch: `work/af14-notification-state-20261010-masanawa01`; PR: see branch pull request.
- CAS exact-path claim `masanawa01-af14-notification-state-20261010`, initially published/read back on `factory/claims@5df912847bb73b11a12859ea4a58c9d8dda5213e`, renewed/read back on `06b2fc5ae4343aaeca4745fa1611414823e054b4`. This claim belongs only to the four paths below.
- Paths changed: `apps/mobile/lib/src/screens/settings/settings_screen.dart`, `apps/mobile/lib/src/account_preferences/notification_switch_controller.dart`, `apps/mobile/test/audio_first/af14/notification_switch_controller_test.dart`, this handoff.

## Implemented, connected behavior

- Settings binds the push switch to the current signed-in user ID, reads actual device preference/permission instead of assuming enabled, and refuses switching while initial read or mutation is pending.
- The scoped `NotificationSwitchController` serializes mutations; rechecks device status after permission request/unregister, shows denial or uncertain failure with retry, and blocks further toggles until state is refreshed.
- Async callbacks from older account generations cannot update the current account's visible state; during account transition the switch displays off and is disabled until the new account's read completes.
- Display explicitly says **device permission only — delivery not verified**. The existing native push service is unchanged; this does **not** establish successful server token unregister, delivery, per-account server preferences or OS behavior on a physical device. A late native operation can still outlive an account switch; AF00 owns the push shell context and must coordinate token ownership.
- No change to canonical auth, money, media, database schemas, provider calls, migration registry, shell, localization, shared mobile push service, or deployment.

## Contracts and acceptance

- Current source contract: `docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md` AF v1; `docs/WHOLE-APP-SOURCE-AUDIT-20261009.md` SA06 and Settings contract.
- Scoped evidence targets: SA-A02 (failed save/account switch), SA-A05 (OS permission and token state), PF-A01 (account isolation). **None are VERIFIED_E2E.**

## Execution and reproducible checks

- GitHub connector fetch of all 3 code/test files from exact branch; **11/11 readback/static structure assertions PASSED**, including account fencing, serialization, device-status reread, error/retry, UI integration and eight authored tests. This is a source consistency check **only**.
- Eight Flutter regression tests **AUTHORED, NOT_RUN**: initial read pending, OS denial, failed revoke, cross-account stale read, concurrent enable, unconfirmed permission, account swap during mutation, and explicit read failure/recovery.
- Required commands on an environment with Flutter SDK:
  - `cd apps/mobile && dart format --output=none --set-exit-if-changed lib/src/account_preferences/notification_switch_controller.dart lib/src/screens/settings/settings_screen.dart test/audio_first/af14/notification_switch_controller_test.dart`
  - `cd apps/mobile && flutter analyze`
  - `cd apps/mobile && flutter test test/audio_first/af14/notification_switch_controller_test.dart`
  - `cd apps/mobile && flutter test`
- **BLOCKED:** `flutter`/`dart` binaries absent in this execution container; no authenticated two-device Firebase/Android environment, OS notification permission test, live push token readback, installed APK or server-side preference schema. No CI, database, provider or device PASS claim.

## Dependencies, collisions and next integration action

- **Do not independently merge into production main**: draft PR #587 modifies the same Settings file to guard clear-AI-chat scope; #497 and #435 contain Settings/profile changes. Reconcile those precise hunks and preserve #587's confirmation dialog and existing #497 language/avatar work, rather than replacing either with this Settings copy. AF00 must use the owner's still-unavailable local app/APK as an additional reconciliation input.
- AF08 owns auth/credential/session server authority; AF00 owns push registration composition, native configuration, root router and localization. This slice changes none.
- Run exact merged-head Flutter tests; resolve actual merge conflicts and QA push token revoke failures. Integrate compatible source to a non-deploying branch after passing merge gate and checking auto-deploy behavior. Production still requires OS-denied/revoked, offline/unregister failure, account switch during pending request, token rotation and two-account/device readback.
- No migrations, destructive actions or rollback side effects. Revert this branch's three code hunks if integration regresses push state; existing MobilePushService remains canonical.

**Source left to finish for AF14:** full Settings navigation, accessible localized text, genuine per-account server preferences, token ownership/race coordination, profile/photo integration, installed version/help, activity, deletion and credential/session lifecycle. Claim release follows this handoff.
