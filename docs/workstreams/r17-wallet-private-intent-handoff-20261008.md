# R17 — Wallet to private Talk service-intent handoff (2026-10-08)

Owner/window: ChatGPT R17 private service handoff, isolated branch.
Branch: `work/r17-wallet-private-intent-handoff-20261008`
Base main SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
Task references: R17 P0 (and R06–R08 dependencies). This is a bounded client handoff, **not** a claim to monetary transaction execution or voice-first full acceptance.

## Exact owned paths
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` — only Wallet shortcut callback / private Talk handoff; existing R11 localization work must be preserved on integration.
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart` — typed one-time private service-intent initiation, no auto microphone/charge.
- `apps/mobile/lib/src/services/private_service_intent.dart` — strict intent identity, unambiguous plain-language presentation / safe handoff.
- `apps/mobile/lib/src/screens/chat/private_service_intent_prompt.dart` — explicit non-paying assisted-service entry card with retry/editor fallback.
- `apps/mobile/test/private_service_intent_test.dart` — mapping / duplicate/reselection/recovery regression coverage.
- `apps/mobile/test/private_service_navigation_test.dart` — widget-level Wallet-to-Talk handoff, failed wallet and logout coverage.
- this claim file.

Do **not** edit `app_router.dart` (R04 #433), `wallet_screen.dart` (R06 #438), `billing_screen.dart` or provider/quote/funding code (R05 #440), R11 ARB files or any server commerce or task authority.

## Preflight and dependencies
- Current main verified at base SHA, read `CONTINUE-HERE.md`, `MULTI-WINDOW-WORK.md`, all current product/voice-first contracts and R01–R19.
- Active PR file ownership checked for #442, #441, #440, #439, #438, #435, #433, #426. #426 shell localization was last updated 2026-10-08T05:28:52Z and has an expired five-minute lease at the time of claim. Preserve its useful changes and avoid its changed regions.
- Existing Wallet root actions currently open separate Billing/Crypto screens, while private Chat auto-sends `initialPrompt`; the new path must **not** auto-send a financial confirmation or start the microphone.
- R06/R07/R08 own durable quote/task/payment workflows. A client-only handoff cannot authorize payment or replace that contract.

## Implementation checkpoint / explicit handoff
Status: **IMPLEMENTED IN SOURCE ONLY; NOT VERIFIED FOR MERGE OR PRODUCTION.** Draft PR #445: https://github.com/Baatiku/masanawa/pull/445

- Latest implementation HEAD as checked: `2d89b57d1b15e89d404e6c9180d1b54792716bae` (2026-10-08). Base `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`, branch ahead of main with no files outside exact ownership; no shared Gateway, auth, migration or provider changes.
- Wallet Crypto/Data/Airtime/Electricity/TV actions now select only a typed, current-account private intent and move to the existing Talk tab; no microphone, quote approval, payment, provider order or balance is initiated on selection.
- The private assistant shows an explicit Continue in Talk / Use service form / Dismiss card. Only Continue sends a non-authorizing help request to existing `AiChatController.sendText`; existing authenticated, quote-backed Billing/Crypto forms remain the manual path.
- In-memory `PrivateServiceIntentController` tracks selection revisions, prevents an older send completing over a newer selection, revokes on sign-out/account change and preserves route rebuilds. Failed assistance leaves an actionable retry; sending/update gates disable double submission.
- Switching to the manual financial form tears down private inline live voice/voice playback first. Actual Android public/private track routing remains an R07/R08 device acceptance gate, not proven by this code.
- Tests authored: `private_service_intent_test.dart` (mapping, canonical editor, no auto-send/mic, account revision/revocation, in-flight duplicate blocking, disabled transport, retry) and `private_service_navigation_test.dart` (real GoRouter root rebuild, Wallet transport failure, signed-in selection, unavailable agent recovery, logout).
- Static GitHub source readback and lexical delimiter checks completed on 6 edited code/test files; these checks are NOT a substitute for Dart analyzer/tests. No conflict markers detected in focused edits.
- Latest observed GitHub Actions on code HEAD `f9da2a640...`: Foundation CI run `37736202098`, Mobile Build run `37736202080`; both reported failure with `runner_id=0` and **zero executed steps**. Therefore they establish a GitHub runner allocation blocker, not a source compile error/success. Subsequent test-only commits likewise unexecuted.
- Flutter SDK/executable unavailable in this connector environment; **NOT RUN:** `flutter pub get`, `flutter analyze`, `flutter test test/private_service_intent_test.dart test/private_service_navigation_test.dart`, full mobile tests, APK build. **NOT RUN:** real authenticated assistant request, Android microphone handling, provider/financial/device acceptance. **NOT DEPLOYED.**
- This fixes the bounded entry-intent routing only. Full R17 and R06–R08 acceptance remain **OPEN/PARTIAL**: typed server-owned task ID/quotes, supported locality/translation, spoken financial confirmation, server-projected option cards, low-literacy voice parity and direct device acceptance require coordinated backend, R11, R06/R07/R08 work.
- Integration review must reconcile `twin_home_shell.dart` with stale draft localization PR #426, and ensure current main hasn't moved; do not replace its translations. PR #433 owns app_router.dart, #438 owns wallet_screen.dart, #440 owns billing_screen.dart; none touched.
- **Merge blocked pending executable Flutter analyzer/widget suite, CI runner recovery, review and cross-branch reconciliation.** Leave #445 draft; do not misreport full mobile readiness.
- Handoff: rerun all focused tests on Flutter-capable runner, resolve compiler/runtime errors, review app-account navigation, reconcile translations, and test service selection with live signed-in Gwani and real Billing/Crypto capability before marking verified. This claim does not reserve code ownership beyond the 5-minute repository-visible lease.

