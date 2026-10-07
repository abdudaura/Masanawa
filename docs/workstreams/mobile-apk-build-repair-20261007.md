# Mobile APK compilation repair — 2026-10-07

Owner: current Railway/APK repair window
Branch: `fix/mobile-apk-build-20261007`
Base: `bb3f6d204c2e53f21eaf2574311c7c0ef4cbf315`
Last update: 2026-10-07T22:00:28.630Z
Status: active.

## Exact owned paths

- apps/mobile/lib/src/screens/activity/activity_screen.dart
- apps/mobile/lib/src/screens/you/you_screen.dart
- apps/mobile/lib/src/screens/talks/create_talk_screen.dart
- apps/mobile/lib/src/talks/talk_replay_playback.dart
- apps/mobile/test/twin_home_shell_test.dart
- apps/mobile/pubspec.lock
- this claim

## Evidence

First real local test compilation found invalid const AppBar constructors, literal escaped newlines in replay playback Dart source, and stale fake transport interfaces. Fix these compile blockers without product redesign. Fresh dependency resolution includes previously missing LiveKit dependencies. Preserve other work and extend exact ownership only if further compiler evidence requires it. Mobile Build CI has no allocated runner. Flutter 3.47.6, Dart 3.13.5, Android 37.0, Java 17 and Gradle 9.1.0 are available locally. Use CI=true to prevent Flutter's cloud metadata environment probe.

Gateway startup repair already merged via PR #399 and verified deployed; this lane owns mobile compilation only.

## Additional compiler-owned paths (2026-10-07T16:37Z)

- apps/mobile/lib/src/screens/explore/explore_screen.dart
- apps/mobile/lib/src/screens/you/my_talks_screen.dart
- apps/mobile/lib/src/screens/you/saved_talks_screen.dart
- apps/mobile/lib/src/screens/talks/talk_screen.dart: wrong live role enum only
- apps/mobile/test/talk_screen_test.dart: same live role enum
- apps/mobile/test/agent_recovery_test.dart: onboarding fake data arguments
- apps/mobile/test/home/home_continuation_test.dart: retired Home continuation API

Analyzer confirms compile blockers in these exact paths. Product behavior and other active lanes remain preserved.

## Runtime test-owned paths (2026-10-07T16:39Z)

- apps/mobile/lib/src/talks/talk_live.dart
- apps/mobile/lib/src/talks/talk_live_audio_session.dart
- apps/mobile/test/talk_live_audio_session_test.dart
- apps/mobile/lib/src/core/live_voice_session.dart
- apps/mobile/test/live_voice_session_test.dart
- apps/mobile/lib/src/ui/components/onboarding_scaffold.dart
- apps/mobile/test/twin_identity_banner_test.dart
- apps/mobile/test/twin_chat_actions_sheet_test.dart
- apps/mobile/test/twin_share_sheet_test.dart
- apps/mobile/test/twin_production_integration_test.dart
- apps/mobile/test/twin_teaching_test.dart

Evidence: speaker role referenced by live screen but absent from model; speaker publishing/mute must preserve server canPublishAudio grant. Closing a never-started LiveVoiceSession completes an unobserved readiness future with an error. Widget tests omit required app theme, onboarding is vertically imbalanced, and legacy language-teaching expectation conflicts with dynamic language policy. Apply bounded corrections and rerun suite.

## Talk interaction regression ownership (2026-10-07T16:45Z)

- apps/mobile/lib/src/screens/talks/talk_question_sheet.dart
- apps/mobile/lib/src/screens/talks/talk_host_controls_sheets.dart
- apps/mobile/lib/src/screens/talks/talk_screen.dart: question control propagation and tested interaction wiring
- apps/mobile/test/talk_screen_test.dart: current sheet controls and interaction frames
- apps/mobile/test/app_mount_test.dart: current auth title

Local tests reproduce disposed TextEditingControllers during question/invitation dismissal, missing Host question control propagation, duplicate feedback from nested sheet Scaffolds, stale test navigation/selectors, and stale creator follow-up route expectations. Preserve product contracts; fix the lifecycle and fixture evidence rather than reintroducing retired UI.

## Verification checkpoint

All 310 Flutter tests pass locally. Flutter analyze --no-fatal-infos --no-fatal-warnings reports no errors (379 pre-existing/style notices remain). Host poll interaction scrolls clear of the fixed comment composer. Leaving a Speaker seat completes participation state before audio reconnection and reports reconnection failures as audio failures. Release APK build is in progress after installing the missing full Java 17 compiler; initial environment had JRE only.

## Resumed APK compilation

The scratch source and intermediate mobile outputs survived the inactive interval, while /tmp SDKs, JDK and home-directory caches did not. No final APK was produced. Restore tools in the conversation workspace, verify sources against the published head, and finish the actual release build. No other open PR or active mobile repair lane exists at resume.

SDK and full JDK restored; production readiness remains 200. Restore hosted dependencies directly from locked package archives with SHA-256 checks, then compile using the restored caches. No implementation scope expansion.

Restored-environment verification: all 310 tests pass in 24 seconds. The integration fixture now supplies an isolated signed-in SessionController and asserts Authorization headers, avoiding native secure-storage access. Analyzer again reports no errors with 379 non-fatal existing/style notices. APK Gradle assembly is active with Android dependencies being cached; no final artifact yet.

Release assembly remains active while Gradle restores native plugin build-tool dependencies (multiple Android/Kotlin plugin versions). Cache has reached 3.5 GB and Java compiler activity is ongoing. All 310 tests and no-error analyzer verification remain valid; no production source edits since the last successful checks.
