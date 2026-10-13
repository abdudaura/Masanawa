# AF14 — Settings account/device controls, 2026-10-13

**Development source:** base `3fcd910ebe905a52f8fe011ee13cf81993e46aa1`; application source head `aa2f831699f0929639a95d52c13cffff23d17e56`; branch `lane/af14-settings-safe-controls-20261013`.
**Status:** IMPLEMENTED_UNVERIFIED pending Dart/Flutter execution. This is scoped source, not a fully qualified Settings, notifications, auth or installed-device release.

## Delivered connected user journeys

- Signed-in user can open the existing `/profile` editor by tapping their Settings account card, without creating another profile authority.
- Clearing cached chats now requires an explicit, accessible confirmation identifying **device-local scope**. Cancel performs no operation; pending cleanup disables repeated presses; errors keep the dialog open with a retry and never expose exception details. On account change before confirmation, refuse the request. The existing `aiChatProvider.clearAll()` remains the sole cleanup operation. Server-held history, financial receipts and deletion requests are not represented as erased.
- Selecting the default support Masana persona allows only one in-flight mutation; refreshes the existing directory before claiming confirmation; suppresses stale-account notifications. Current persona/role is shown without unnecessary AI-provider branding. This does not bypass AF08 request-level credential security.
- Notifications use confirmed OS/app permission readback, visible checking/failure/retry, one in-flight change and account-epoch fencing. Re-enabling reattempts the previous canonical directory/push registration refresh; the UI distinguishes permission from delivered push. No extra provider, device registration or push authority was created.
- Removed hardcoded `v1.0.0` (pubspec currently `1.0.1+2` but installed artifact may differ) and obsolete Status publishing claim. About/footer describe existing five tabs without asserting unverified build identity. Actual signed installed version remains MUI-10.

## Changed paths

1. `apps/mobile/lib/src/screens/settings/settings_screen.dart`
2. `apps/mobile/lib/src/screens/settings/clear_device_chats_dialog.dart`
3. `apps/mobile/test/clear_device_chats_dialog_test.dart` — four authored widget tests (cancel/no write, asynchronous single-flight, failed write + retry/private error, 320px reachability)
4. This handoff.

**Exact-path registry:** `factory/claims`, claim `af14-settings-safe-controls-20261013-gpt6`. C09 Settings claim was released in the registry; shared AF00 router, AF08 credential transport, AF01 financial and AF05 native voice remain untouched. Existing #497 Settings-related unmerged work remains preserved for selective future review.

## Verification and merge disposition

- Source changes committed and GitHub blobs read back. PR review/branch comparisons are the available checks; no independent Dart compiler execution.
- **BLOCKED/NOT_RUN**: `cd apps/mobile && flutter test --no-pub test/clear_device_chats_dialog_test.dart`, `dart analyze lib/src/screens/settings/settings_screen.dart lib/src/screens/settings/clear_device_chats_dialog.dart test/clear_device_chats_dialog_test.dart`. This runner has no `flutter` or `dart` binary; no APK/Android SDK/device/provider credential. Do not present authored tests as passing.
- Prior baseline `597 passed / 2 retained Talk Add AI failures`, whole Dart analysis `317 diagnostics` and TalkId TS2459 are **historical**, not this branch's executed results.
- The branch is intended for normal owner-authorized development merge after a read-only diff/semantic review. No CI suppression, deployment setting, auth/financial mutation, migration, provider execution or test bypass. A merged source commit is **not** E2E or release approval.

## Remaining features / continuation

The parent app is not complete. Continue substantive customer-facing **canonical server-wide Chats inbox/search (MUI-03)** via AF00/AF05 transfers, **Masana-only Status and persistent Rooms (MUI-04/06)** via their existing source/contract, and **MSN funding/Send plus quote expiry (MUI-07/08)** via AF01 contract. Do not block independent owned source because the historical Talk tests or global analyzer fail. A next batch should integrate backend, PostgreSQL, authenticated API and mounted Flutter where safe, rather than add another cosmetic-only change. AF08 profile request-level credential isolation, combined MUI-09, signed installed source MUI-10, real AF11 Calls/push/device/provider qualification and fully localized Hausa/Arabic remain OPEN.

Re-run on an actual Flutter SDK checkout and inspect CI at the exact source/merge SHA. Fix any introduced failure rather than interpreting unrelated historical suite failures as a veto on unrelated feature development.
